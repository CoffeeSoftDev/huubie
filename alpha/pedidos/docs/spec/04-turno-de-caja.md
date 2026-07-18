# 04 — Turno de caja (apertura y corte de turno)

El turno (`cash_shift`) es la unidad operativa de caja: un cajero **abre** turno al empezar,
todo pedido nace atado a él (`order.cash_shift_id`), y al terminar hace el **corte de turno**
(`closeShift`). Varios turnos de un mismo día se consolidan luego en el cierre del día (ver 05).

Controlador: `ctrl-pedidos.php` (openShift/closeShift/getShift*) + `pedidos-cierre.js` (`Cierre`).

---

## 4.1 Apertura de turno (`opc: openShift`)

**Propósito.** Habilitar la caja de una sucursal para capturar y cobrar pedidos.

**Precondiciones / candados.**
- Roles 1/2/3/6/7 abren sobre la sucursal del modal; si no llega, sobre `SUB`.
- **No** puede haber otro turno abierto en esa sucursal → **409**.
- **El día de hoy no debe estar cerrado** en esa sucursal (`getDailyClosureByClosureDate`) → **423**.

**Flujo.** `createCashShift(subsidiary_id, employee_id, shift_name, opened_at=NOW, opening_amount,
status='open', active=1)` → recupera el id con `getMaxCashShift`.

**Reglas de negocio.**
- **El turno siempre nace hoy** (`opened_at = NOW`): no hay forma de abrir turnos de días pasados.
- `opening_amount` = fondo de caja inicial (capturado en el modal).

**⚠ Nota crítica.**
- **`getMaxCashShift()` tras el INSERT** repite el patrón de carrera de `addOrder`: dos aperturas
  concurrentes leen el mismo `MAX(id)`. Usar `lastInsertId`.
- **El candado "solo un turno abierto por sucursal" no está garantizado por la BD.** Es una
  verificación en PHP (`getOpenShiftBySubsidiary` antes del INSERT); dos peticiones simultáneas
  pueden pasar ambas la verificación y crear dos turnos abiertos. Falta un índice único parcial
  (o transacción con bloqueo) sobre `(subsidiary_id, status='open')`.
- **`opening_amount` (fondo de caja) se captura pero no participa en el corte.** El corte reporta
  ventas por método, no un arqueo `fondo + efectivo esperado vs contado`. Es media función: se pide
  el dato pero no se usa para cuadrar la caja física. Revisar si debe entrar al corte.

---

## 4.2 Corte de turno (`opc: closeShift`)

**Propósito.** Cerrar el turno, calcular sus métricas y persistir el desglose.

**Flujo.**
1. Valida que el turno exista y esté `open` (si no, 404/409).
2. `getShiftSalesMetrics(shift_id, opened_at, closed_at, subsidiary_id)` calcula:
   - `total_sales` = `SUM(total_pay)` de los pedidos del turno (status ≠ 4).
   - `cash/card/transfer` = `SUM(order_payments.pay)` por método **cuyo `date_pay` cae en la
     ventana** `[opened_at, closed_at]`, atribuidos por
     `COALESCE(pago.subsidiaries_id, pedido.subsidiaries_id)`.
   - conteos por status (1, 2, 4).
3. `closeCashShift(...)` guarda en `cash_shift`: `closed_at`, totales y `total_orders`.
4. Inserta desglose en `shift_payment` (3 filas: método 1/2/3) y `shift_status_process`
   (status 1/2/4).
5. `updateOrdersCashShift(shift_id, opened_at, closed_at, subsidiary_id)` **re-vincula** pedidos
   al turno por ventana de tiempo.
6. `notifyShiftClosed` — WhatsApp con el resumen (nunca debe tumbar el cierre).

**Postcondiciones.** Turno `closed`, con su desglose guardado; pedidos vinculados.

**⚠ Nota crítica (núcleo del descuadre).**
- **`total_sales` (Σ total de pedidos) NO es igual a `cash+card+transfer` (Σ dinero recibido).**
  Un pedido de $1,000 con abono de $300 suma **1,000** a `total_sales` pero **300** a los métodos.
  El "total" del turno y la suma de formas de pago **nunca cuadran por diseño**. El visor de
  reportes ya lo compensa mostrando `total caja = cash+card+transfer`, pero el dato `total_sales`
  guardado en `cash_shift` sigue siendo engañoso. **Definir qué significa "total del turno"**
  (¿venta facturada o dinero en caja?) y guardar ambos con nombres claros
  (`total_ordered` vs `total_collected`).
- **Dos criterios distintos en la misma métrica.** Los pedidos se cuentan por
  `cash_shift_id`/ventana de creación; los pagos por `date_pay` en la ventana del turno. Un abono
  hecho hoy a un pedido de ayer entra en `cash/card/transfer` de **este** turno, pero ese pedido no
  entra en `total_orders`. La foto de "ventas" y la de "cobros" no hablan del mismo conjunto.
- **Doble mecanismo de vinculación pedido↔turno.** El pedido ya nace con `cash_shift_id`
  (apartado 02), pero `closeShift` vuelve a vincular por ventana de tiempo
  (`updateOrdersCashShift`) incluyendo huérfanos (`cash_shift_id IS NULL`). Dos fuentes de verdad
  para "a qué turno pertenece un pedido"; si difieren, el corte de turno y el corte Z pueden contar
  distinto. Elegir **una** (el `cash_shift_id` de creación) y tratar los huérfanos como excepción
  explícita, no como regla del cálculo.
- **`shift_status_process` guarda status 1, 2 y 4 pero NO el 3 (Pagado).** El desglose por estado
  del turno omite los pedidos pagados. Si un reporte suma esas filas creyendo que son "todos los
  pedidos", falta el estado más importante. Confirmar que es intencional.
- **El corte no es idempotente ni transaccional.** Si `createShiftPayment`/`updateOrdersCashShift`
  falla a mitad, el turno queda `closed` con desglose incompleto y no hay rollback ni forma de
  reintentar el corte (a diferencia del cierre, que sí tiene `recalcShift`). Envolver en transacción.
- **`getMaxCashShift`/`opened_at`/`closed_at`** trabajan con `date('Y-m-d H:i:s')` del servidor;
  cuidado con la zona horaria (el MCP muestra UTC +6h vs hora local guardada UTC-6). No es bug del
  código, pero cualquier consulta manual de auditoría debe comparar columna contra columna, no
  contra literales.

---

## 4.3 Consulta de turnos (`getShiftsByDate`, `getOpenShifts`, `getShiftMetrics`, `getShiftOrders`, `checkOpenShift`)

**Propósito.** Alimentar la UI de `Cierre` (pedidos-cierre.js): listar turnos de una fecha, ver el
detalle/métricas de un turno y sus pedidos, y saber si hay turno abierto.

**⚠ Nota crítica.**
- `getShiftMetrics` recalcula al vuelo con `getShiftSalesMetrics`, mientras que un turno **cerrado**
  ya tiene sus totales congelados en `cash_shift`/`shift_payment`. Ver un turno cerrado puede
  mostrar números **distintos** a los que se guardaron si entre medio se editó un pago o se movió
  una fecha. Definir: los turnos cerrados se **leen** de lo guardado; solo los abiertos se recalculan.
- `getShiftsByDate` repite el bloque de resolución de sucursal por rol (4.ª copia del check
  `[1,2,3,6,7]`). Centralizar (ver 01/08).
- El indicador de "turno abierto" del listado (punto verde) se resuelve por separado en
  `listOrders`; otra consulta más del estado de turno que ya se calcula en varios lados.
