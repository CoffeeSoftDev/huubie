# Fix: pago de $250 en efectivo del 17/08/2026 que no entró al corte (Reginas guadalupe)

## Qué pasó

| Dato | Valor |
|---|---|
| Pago | `order_payments.id = 1292` |
| Monto / método | $250.00 · **Efectivo** (`method_pay_id = 1`) |
| Fecha de cobro | `2026-08-17 10:48:02` |
| Sucursal que cobró | **4 · Reginas guadalupe** (`pp.subsidiaries_id`) |
| Pedido | `order.id = 1019`, creado el 16/08 en la sucursal **22 · Regina´s cuarta** |
| Turno donde cae | `cash_shift.id = 533` (suc. 4, 10:16:57 → 15:24:05, cajero 92) |
| Snapshot guardado del turno | `cash = 0`, `card = 0`, `transfer = 0` ← **mal** |

Es un **cobro cruzado** (pedido de cuarta, cobrado en gpe) y así quedó anotado en la
bitácora del pedido: *"Se registró un pago de $250.00 — cobro cruzado: cobrado en
Reginas guadalupe, pedido de Regina´s cuarta"*.

El pago está bien capturado. Lo que falló es el **snapshot del corte**: al cerrar el
turno 533, `closeShift()` guardó `cash = 0` en vez de `cash = 250`.

Corriendo hoy la misma consulta del cierre (`getShiftSalesMetrics`) sobre ese turno,
el resultado correcto sí sale:

```sql
SELECT pp.method_pay_id, SUM(pp.pay) AS total_paid
FROM order_payments pp
INNER JOIN `order` po ON pp.order_id = po.id
WHERE pp.date_pay >= '2026-08-17 10:16:57'
  AND pp.date_pay <= '2026-08-17 15:24:05'
  AND COALESCE(pp.subsidiaries_id, po.subsidiaries_id) = 4
  AND po.status != 4
GROUP BY pp.method_pay_id;
-- => method_pay_id 1, total_paid 250
```

No es un bug del cobro cruzado: los ~60 cobros cruzados anteriores (junio–agosto) sí
quedaron reflejados en su turno. Fue un fallo puntual de ese cierre. Ver "Endurecimiento"
al final.

## Corrección — opción 1 (recomendada): botón de la app

El módulo ya tiene el recálculo idempotente (`opc: 'recalcShift'`, solo admin `ROLID == 1`):

1. Entrar como **admin** a `alpha/pedidos` → **Corte de Caja**.
2. Fecha **17/08/2026**, sucursal **Reginas guadalupe**.
3. En la tarjeta del turno de la mañana (10:16 – 15:24), botón **"Recalcular corte"**.

Recomputa `cash/card/transfer` + las filas de `shift_payment` desde los pagos actuales.
No toca `status` ni las fechas del turno. Correrlo dos veces da el mismo resultado.

> Requisito: que `ctrl-cierre.php::recalcShift()` + `mdl-cierre.php` + `pedidos-cierre.js`
> estén desplegados en el servidor. Si allá no está esa versión, usar la opción 2.

## Corrección — opción 2: SQL por phpMyAdmin (servidor)

Mismo cálculo que hace `recalcShift`, sin ids literales: localiza el turno por la
ventana del pago, así funciona aunque los ids difieran.

### Paso 1 — verificar (solo lectura)

```sql
SELECT cs.id AS turno, cs.subsidiary_id, cs.opened_at, cs.closed_at,
       cs.cash AS cash_guardado, cs.card, cs.transfer,
       (SELECT COALESCE(SUM(pp.pay), 0)
          FROM order_payments pp
          INNER JOIN `order` po ON po.id = pp.order_id
         WHERE pp.method_pay_id = 1
           AND pp.date_pay >= cs.opened_at AND pp.date_pay <= cs.closed_at
           AND COALESCE(pp.subsidiaries_id, po.subsidiaries_id) = cs.subsidiary_id
           AND po.status != 4) AS cash_real
FROM cash_shift cs
WHERE cs.subsidiary_id = 4
  AND DATE(cs.opened_at) = '2026-08-17'
  AND cs.active = 1;
```

Debe salir el turno de la mañana con `cash_guardado = 0` y `cash_real = 250`.
**Si `cash_real` no da 250, detente**: el caso en el servidor no es el mismo.

### Paso 2 — corregir (transacción con guarda)

```sql
START TRANSACTION;

SET @shift := (
    SELECT cs.id FROM cash_shift cs
    WHERE cs.subsidiary_id = 4
      AND cs.active = 1
      AND cs.status = 'closed'
      AND '2026-08-17 10:48:02' BETWEEN cs.opened_at AND cs.closed_at
    LIMIT 1
);

SET @cash := (
    SELECT COALESCE(SUM(pp.pay), 0)
    FROM order_payments pp
    INNER JOIN `order` po ON po.id = pp.order_id
    INNER JOIN cash_shift cs ON cs.id = @shift
    WHERE pp.method_pay_id = 1
      AND pp.date_pay >= cs.opened_at AND pp.date_pay <= cs.closed_at
      AND COALESCE(pp.subsidiaries_id, po.subsidiaries_id) = cs.subsidiary_id
      AND po.status != 4
);

-- Guardas: solo aplica si encontró el turno y el efectivo real es 250.
UPDATE cash_shift
   SET cash = @cash
 WHERE id = @shift AND @shift IS NOT NULL AND @cash = 250;

UPDATE shift_payment
   SET amount = @cash
 WHERE cash_shift_id = @shift AND payment_method_id = 1
   AND @shift IS NOT NULL AND @cash = 250;

-- Revisar que las 2 filas afectadas sean 1 y 1 antes de confirmar.
SELECT @shift AS turno, @cash AS cash_nuevo,
       (SELECT cash FROM cash_shift WHERE id = @shift) AS cash_en_turno,
       (SELECT amount FROM shift_payment WHERE cash_shift_id = @shift AND payment_method_id = 1) AS cash_en_desglose;

COMMIT;   -- o ROLLBACK; si algo no cuadra
```

`total_sales` y `total_orders` del turno se quedan en 0 y está bien: en ese turno no se
creó ningún pedido, solo se cobró el abono de un pedido de otra sucursal.

## Pendiente aparte: el cierre del día

El cierre diario `daily_closure` de gpe del 17/08 (`id = 198` en local) tiene
`total_cash = 0` y **no se corrige con lo anterior**: `getConsolidatedPayments()` solo
cuenta pagos de pedidos **creados ese día en esa sucursal**, y el pedido 1019 es del 16
y de cuarta. Ese abono se reporta por separado vía `getDailyPrevPaymentsByMethod()`
(sección de abonos a pedidos de días anteriores). Decidir si el corte del día debe
sumarlo es un cambio de criterio, no un fix de datos.

## Endurecimiento sugerido (no aplicado)

`closeShift()` no valida que la consulta de pagos haya salido bien: si `_Read` falla,
el `foreach` no entra y el turno se cierra con `cash/card/transfer = 0` sin avisar a
nadie. Vale la pena que registre en `error.log` (o bloquee el cierre) cuando la métrica
de pagos venga vacía habiendo pagos en la ventana del turno.

## Bug aparte detectado

`ctrl/ctrl-cierre.php:81` llama a `getConsolidatedPayments([$date, $subsidiaries_id])`
con **2** parámetros, pero la consulta espera **4**. Truena con
`SQLSTATE[HY093]: Invalid parameter number` (visible en `ctrl/error.log`) y el checklist
previo al cierre del día siempre muestra *"Efectivo: $0.00 | Tarjeta: $0.00 | Transf: $0.00"*.
Las otras dos llamadas (líneas 140 y 292) sí pasan los 4. Es cosmético (no guarda nada),
pero está roto.
