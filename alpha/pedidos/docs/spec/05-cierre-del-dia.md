# 05 — Cierre del día (corte Z), reapertura, recálculo y días pendientes

El cierre del día (`daily_closure`) consolida **todos los turnos** de una fecha/sucursal en un
corte Z. Es la operación contable más delicada del módulo y donde se concentran los descuadres.

Controlador: `ctrl-cierre.php` · Front: `pedidos-cierre.js` (`Cierre`) + `order-reports.js` (visor).

---

## 5.1 Pre-cierre / checklist (`opc: showCierre`)

**Propósito.** Antes de cerrar, mostrar si se puede (`can_close`) y por qué no.

**Checks.**
| key | Bloqueante | Qué valida |
|---|---|---|
| `no_existing` | Sí | no existe ya un cierre para la fecha/sucursal |
| `shifts_closed` | Sí | no quedan turnos abiertos |
| `orphan_orders` | No | pedidos sin turno asignado (advertencia) |
| `pending_balance` | No | pedidos con saldo pendiente (advertencia) |
| `payments_ok` | No | resumen de formas de pago |

Devuelve además `summary` (ventas, pedidos, turnos, efectivo/tarjeta/transf, descuento) y el
detalle de turnos.

**⚠ Nota crítica.**
- **Los pedidos huérfanos (sin turno) son advertencia NO bloqueante.** Se permite cerrar el día
  dejando pedidos sin turno, que luego el corte reparte por ventana de tiempo. Combinado con el
  doble mecanismo de vinculación (04), esos huérfanos son precisamente los que "descuadran"
  (auditoría: 45 pedidos). Debería poder **bloquearse** o forzar su asignación antes de cerrar.
- El `summary` del pre-cierre se calcula con un método (`getConsolidatedMetrics`/
  `getConsolidatedPayments`) y el cierre real (`addCierre`) recalcula con otros; que la vista previa
  y el cierre definitivo usen rutas distintas es un riesgo de "veo un número, se guarda otro".

---

## 5.2 Ejecutar el cierre (`opc: addCierre`)

**Propósito.** Crear el `daily_closure` y congelar el corte Z.

**Precondiciones.** Sucursal específica (no `'0'`); sin cierre previo (409); sin turnos abiertos (400).

**Flujo.**
1. `getConsolidatedMetrics` → `total_sales`, `total_orders`, `total_shifts`.
2. `getConsolidatedPayments` → efectivo/tarjeta/transferencia.
3. `getConsolidatedStatuses` → conteos por estado. `getDiscountTotal` → descuentos.
4. `createClosure(...)` (guarda `total`, `subtotal=total`, `tax=0`, totales por método, descuento,
   `status=0`, `is_legacy=0`, `closure_date`).
5. Inserta `closure_payment` (3 métodos) y `closure_status_proccess` (por estado).
6. `updateOrdersClosure` → marca los pedidos del día con `daily_closure_id`.

**Postcondiciones.** Día cerrado: no se pueden abrir turnos ni crear pedidos para esa fecha/sucursal.

**⚠ Nota crítica.**
- **El snapshot guardado (`daily_closure`) y lo que el visor muestra pueden diferir.** `addCierre`
  congela cash/card/transfer; pero `getCierre` (5.4) explícitamente lee los pagos **en vivo** porque
  si un pago se edita/elimina tras cerrar, el snapshot queda obsoleto. Resultado: **el corte
  guardado es una foto que envejece** y ya no es la fuente de verdad; el reporte prefiere recalcular.
  Entonces, ¿para qué se guarda? Definir: o el snapshot es inmutable y contable (y se prohíbe editar
  pagos de días cerrados), o no se guarda y todo se recalcula. Hoy conviven ambas ideas → descuadre.
- **No es transaccional.** `createClosure` + 3 `closure_payment` + N `closure_status` +
  `updateOrdersClosure` corren sin transacción; un fallo intermedio deja un cierre a medias.
- **`getMaxClosureId()` tras el INSERT** — misma carrera que turnos/pedidos.
- **`tax=0`, `subtotal=total`** hardcodeados: el modelo prevé impuestos pero nunca los calcula.
  Columnas muertas o feature pendiente.
- **Edición de pagos de días cerrados no está prohibida.** El propio comentario del código lo asume
  ("si un pago se edita... después de cerrar"). Falta el candado: un día cerrado debería congelar
  sus pagos, o registrar el ajuste como movimiento nuevo, no mutando el pasado.

---

## 5.3 Días pendientes (`opc: getPendingDays`)

**Propósito.** Avisar de días pasados (últimos 15) con turnos pero sin cierre, y bloquear la
operación de hoy hasta cerrarlos.

**⚠ Nota crítica.**
- Ventana fija de **15 días**: un día sin cerrar más viejo desaparece del aviso pero sigue sin
  cerrar (deuda contable silenciosa). Considerar no acotar, o escalar el aviso.

---

## 5.4 Visor del corte Z (`opc: getCierre`)

**Propósito.** Reporte completo del corte de una fecha (para imprimir/consultar), en vivo.

**Qué arma.** Detalle de turnos, conteos por estado, transacciones por método, desglose de pedidos,
resumen de cuentas, ventas por categoría, y **tres cubetas de dinero**:
- `amount` — cobros de pedidos **del día**.
- `prev_*` — abonos cobrados hoy de pedidos de **días anteriores**.
- `cross_payments` — **cobros cruzados** (pagos de pedidos de otra sucursal cobrados aquí).

Admite `preview=1` (solo admin) para ver el corte de un día **aún no cerrado** (marcado `pending`),
sintetizando el cierre con el mismo criterio que usaría `addCierre`.

**⚠ Nota crítica.**
- **`getCierre` es un método de ~470 líneas que orquesta ~15 queries** (`listShiftsDetail`,
  `getConsolidatedStatuses`, `getPaymentTransactions`, `getOrdersBreakdown`, `getOrdersSummary`,
  `getSalesByCategory`, `getCashShiftsSummary`, `getConsolidatedPayments`, `getDailyPrevPayments`,
  `getDailyPrevPaymentsByMethod`, `getDailyCrossPayments`…). Es el corazón del descuadre y es
  **ilegible/inmantenible**. Descomponer en sub-métodos con nombre y, sobre todo, **documentar el
  modelo de atribución de dinero** (día / previo / cruzado) como especificación cerrada.
- **Naming engañoso:** `delivered_count` se llena con `status == 3` (Pagado) y luego se reporta como
  `pagadas`. Estado 3 no es "entregado". Corregir el nombre.
- **`venta_bruta == venta_neta`** (ambas = `total_ventas − descuentos`). Uno de los dos campos no
  significa lo que su nombre dice (la "bruta" debería ser sin descuento). Confunde a quien lee el
  reporte.
- **Este visor recalcula todo en vivo** mientras el corte guardado (5.2) queda congelado → dos
  verdades para el mismo día (ver nota de 5.2).

---

## 5.5 Corte de caja X (`opc: showCorteCaja`, `lsCorteCaja`)

**Propósito.** Un corte parcial/de caja más simple (arqueo) distinto del corte Z.

**⚠ Nota crítica.**
- **`saldo_final` se define distinto que en el corte Z.** Aquí `saldo_final = fondo + efectivo`
  (solo efectivo, lógico para arqueo de cajón). En `getCierre` es `fondo + efectivo + tarjeta +
  transferencia`. **Dos definiciones de "saldo final"** en el mismo módulo, ambas llamadas igual →
  confusión garantizada al comparar reportes. Renombrar (`saldo_en_cajon` vs `total_cobrado`).
- Duplica el armado de HTML en el controlador (`lsCorteCaja` arma celdas con clases Tailwind), mismo
  antipatrón que `listOrders` (01).

---

## 5.6 Reapertura de cierre (`opc: statusCierre`)

**Propósito.** Que un admin reabra un cierre para corregir.

**Flujo.** Solo `ROLID==1`, exige `reason`. Marca `daily_closure.status=1` (reabierto),
guarda `reopened_by`/`reopen_reason`/`reopened_at`, y `updateOrdersUnlink` desliga los pedidos.

**⚠ Nota crítica.**
- **Reabrir desliga los pedidos pero deja el registro `daily_closure` existente.** `addCierre`
  bloquea si ya existe un cierre para la fecha (409): tras reabrir, **no queda claro cómo se vuelve
  a cerrar limpio** (¿se crea otro `daily_closure`? ¿se actualiza el reabierto?). Revisar el ciclo
  reabrir → re-cerrar de punta a punta; hoy parece un callejón sin salida documentado.
- **Los turnos NO se reabren** al reabrir el día. Si el descuadre venía de un turno, hay que
  recalcularlo aparte (5.7) y el enlace turno↔cierre queda en un estado intermedio.

---

## 5.7 Recálculo de turno (`opc: recalcShift`)

**Propósito.** Regenerar `cash/card/transfer`, `total_sales`, `total_orders` y `shift_payment` de un
turno desde los pagos actuales, **sin** tocar status ni fechas. Idempotente. Solo admin.

**⚠ Nota crítica.**
- **`recalcShift` arregla el turno pero NO el `daily_closure` que lo consolidó.** El propio mensaje
  avisa "revisa también el cierre del día" — es decir, deja el arreglo a medias y confía en que el
  admin recuerde recalcular/rehacer el corte Z a mano. Falta un `recalcClosure` equivalente (o que
  recalcShift propague al cierre). Es la herramienta correcta para el problema equivocado a solas.
- Existe `recalcShift` (turno) pero **no** un recálculo de cierre: la operación más descuadrada
  (corte Z) es justamente la que no tiene botón de "recalcular". Priorizar.

---

## Resumen del problema contable (para 08)

El descuadre no es un solo bug, es un **modelo de atribución de dinero sin cerrar**:
1. `total_sales` (venta) vs `cash+card+transfer` (cobro) miden cosas distintas y se presentan juntas.
2. Dos vías de cobro escriben `order_payments` distinto (con/sin `subsidiaries_id`).
3. Doble vinculación pedido↔turno (por `cash_shift_id` y por ventana de tiempo).
4. Snapshot congelado (`daily_closure`) vs recálculo en vivo (`getCierre`) → dos verdades.
5. Pagos editables después de cerrar, sin candado.
6. Cobro cruzado + abonos previos: reglas correctas conceptualmente pero implementadas en 15 queries
   frágiles y solo en una de las dos vías de cobro.
