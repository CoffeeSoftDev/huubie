# Fix — Descuadre Corte Z #103 (16-jul-2026, sucursal 4)

**Fecha:** 2026-07-17
**Módulos:** `alpha/order-visor` (reusa backend de `alpha/pedidos`)
**Archivos tocados:** `alpha/pedidos/ctrl/ctrl-cierre.php`, `alpha/pedidos/src/js/pedidos-cierre.js`

---

## Síntoma

En el Corte Z folio 103 el reporte se contradecía consigo mismo:

| Bloque del reporte | Total en caja |
|---|---|
| Tabla "Corte de Caja X (turnos)" | **$3,705** ✅ |
| Bloque "Métodos de Pago / EN CAJA" | **$4,705** ❌ |

Diferencia: **$1,000**.

## Causa raíz

El dinero **real** que entró a la caja de la sucursal 4 el 16-jul fue **$3,705**
(efectivo $695 · tarjeta $1,960 · transfer $1,050), confirmado por los 7 pagos
crudos y por la suma de los dos turnos (#375 + #379).

El bloque "Métodos de Pago" del Corte Z **ya cerrado** se calculaba desde el
**snapshot congelado** del `daily_closure` (`res.payments.*.amount = total_cash/card/transfer`),
mientras que la tabla de turnos y el resto del reporte se calculan **en vivo**.

El $1,000 de más en `total_transfer` ($2,050 en vez de $1,050) corresponde al
**pago 1017**: anticipo de $1,000 en transferencia del **pedido 830** (suc 4).
Ese pago tiene una **fecha imposible**: `date_pay = 14-jul`, anterior a la
creación actual del pedido (`date_creation = 16-jul`). Es el bug de anticipos
conocido (el `date_creation` del pedido se pisa con una fecha posterior y el
anticipo conserva su fecha original). Al momento del cierre el pago entraba al
corte del 16; hoy su fecha lo deja fuera, pero el `daily_closure` es un snapshot
que no se recalcula y conservó el $1,000, inflando el bloque de métodos hasta $4,705.

> **No fue una eliminación de pago.** La bitácora `order_histories` registra las
> eliminaciones (`type='payment'`, `title='Eliminar'`) y no hay ninguna el 16-17 jul
> (la última es del 19-jun). El binlog de MySQL está apagado (`log_bin=OFF`), así que
> el cambio de fecha no se puede reconstruir; la única huella es la fecha imposible.
> Es un patrón sistémico: ~40 pagos históricos tienen `date_pay` anterior a la
> creación de su pedido.

Segundo matiz (no era bug, es criterio): el desglose del Corte Z separa
**pedidos del día** (`amount`, en vivo) de **abonos a pedidos anteriores**
(`prev_amount`). El efectivo del día ($695) eran abonos a pedidos del 13-jul,
por eso aparecía como "Abonos ant." y no en la línea de pedidos del día.

## Correcciones

### 1. Corte Z calcula los métodos de pago en vivo (no desde el snapshot)

`ctrl-cierre.php` → `getCierre()`, array `payments`: `amount` ahora usa
`$liveCash / $liveCard / $liveTransfer` (recomputados con `getConsolidatedPayments`)
en lugar de `$closure['total_cash/card/transfer']`.

- Días **sin ediciones** post-cierre: snapshot y vivo coinciden → ningún cambio.
- Días **con pagos editados/eliminados** tras el cierre: el reporte refleja el
  estado real y deja de contradecir la tabla de turnos.
- Es el mismo criterio que el modo "pendiente" ya usaba → ambos modos coherentes.
- El snapshot histórico en la BD **no se toca** (queda como registro contable).

Resultado en el folio 103:

| Método | Pedidos del día (vivo) | Abonos ant. | Total |
|---|---|---|---|
| Efectivo | 0 | 695 | **695** |
| Tarjeta | 1,700 | 260 | **1,960** |
| Transfer. | 1,050 | 0 | **1,050** |
| **EN CAJA** | | | **3,705** ✅ |

### 2. Fecha del pedido original en "Abonos de pedidos anteriores"

Bajo el folio de cada abono se muestra la fecha de creación del pedido
(formato `DD/MM/YYYY`), para ubicar de qué día es el ticket.

- `ctrl-cierre.php`: se expone `order_date` en el array `prev_payments`
  (la query `getDailyPrevPayments` ya traía `o.date_creation`).
- `pedidos-cierre.js` → `filaAbonoPrev`: fecha bajo el folio + clase `.cz-fecha-orig`.

Ejemplo (folio 103):

| Pedido | Fecha | Abono | Método |
|---|---|---|---|
| P822 | 13/07/2026 | $420 | Efectivo |
| P829 | 13/07/2026 | $275 | Efectivo |
| P834 | 15/07/2026 | $260 | Tarjeta (cruzado) |

---

## Cómo rastrear casos como este

**Eliminaciones reales de pago** (sí quedan en bitácora):

```sql
SELECT id, action, date_action, order_id, usr_users_id
FROM fayxzvov_reginas.order_histories
WHERE type='payment' AND title='Eliminar'
ORDER BY date_action DESC;
```

**Pagos con fecha imposible** (anticipos con `date_creation` pisado — el caso real):

```sql
SELECT pp.id AS pay_id, pp.order_id, pp.pay, pp.method_pay_id,
       pp.date_pay, o.date_creation
FROM fayxzvov_reginas.order_payments pp
JOIN fayxzvov_reginas.`order` o ON o.id = pp.order_id
WHERE pp.date_pay < o.date_creation AND o.is_legacy = 0
ORDER BY pp.date_pay DESC;
```

**Limitación:** `order_histories` registra creación y eliminación de pagos, pero
NO las ediciones de fecha/método ni el pisado de `date_creation`. Con `log_bin=OFF`
y `general_log=OFF` (config actual), esos cambios no se pueden reconstruir a nivel
de BD: la única huella es la fecha imposible detectable con la query de arriba.

## Notas

- El registro `daily_closure` #103 sigue guardando `total_transfer = 2050` en la
  BD; ya no afecta la vista (el reporte se calcula en vivo). Si se quiere limpiar
  el dato histórico, aplicar un `UPDATE` manual dejándolo en $1,050.
- Al probar: recargar con **Ctrl+F5** para saltar la caché del JS.
- Ruta de verificación: Visor de Cierre → Corte Z → 16-jul → sucursal 4 →
  "Métodos de Pago / EN CAJA" debe marcar **$3,705**.
