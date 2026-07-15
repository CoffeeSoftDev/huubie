# Fix: pedido 774 movido de corte + cierre #94 descuadrado ($683)

**Fecha:** 14/07/2026 · **Sucursal:** Regina´s cuarta (id 22) · **BD:** `fayxzvov_reginas`

## Contexto

`addPayment` (ctrl-pedidos-catalogo.php) pisaba `date_creation` del pedido con la fecha del día en cada pago/confirmación. El 13/07 alguien abrió el pedido 774 (capturado el 07/07, anticipo $683 por transferencia ese día) y la fecha se movió al 13/07. Resultado:

- El pedido desapareció del corte del 07/07 (cierre #73) y apareció en el del 13/07.
- El cierre #94 (13/07) guardó `total_transfer = 1183` (500 reales + 683 del anticipo viejo) vs $500 de los turnos.

El fix de código ya está aplicado (se quitó el pisado de `date_creation` en `addPayment`). **Desplegar ese código antes de correr esto**, o la fecha puede volver a pisarse.

> Ya aplicado en local el 14/07/2026. Este script es para el servidor.

## 1. Verificación previa

Confirmar que el servidor tiene los mismos valores antes de tocar nada:

```sql
-- Debe dar: date_creation 2026-07-13 00:00:00, daily_closure_id 73, cash_shift_id 330, pagado 683
SELECT o.id, o.date_creation, o.daily_closure_id, o.cash_shift_id, o.total_pay,
       (SELECT COALESCE(SUM(op.pay),0) FROM fayxzvov_reginas.order_payments op WHERE op.order_id = o.id) AS pagado
FROM fayxzvov_reginas.`order` o WHERE o.id = 774;

-- Debe dar: #94 total_transfer 1183 | #73 total_transfer 943 (el #73 NO se toca)
SELECT id, closure_date, total_cash, total_card, total_transfer
FROM fayxzvov_reginas.daily_closure WHERE id IN (73, 94);

-- Debe dar: #94 método 3 = 1183
SELECT daily_closure_id, payment_method_id, amount
FROM fayxzvov_reginas.closure_payment WHERE daily_closure_id = 94;

-- Debe dar: #94 status 2 = 2, status 3 = 1
SELECT daily_closure_id, status_process_id, amount
FROM fayxzvov_reginas.closure_status_proccess WHERE daily_closure_id = 94;
```

Si algún valor NO coincide, **no ejecutar el paso 2** y revisar primero.

## 2. Corrección (transacción)

Cada UPDATE lleva el valor actual esperado en el WHERE: si el dato difiere en el servidor, afecta 0 filas y no rompe nada. Cada uno debe reportar **1 row affected**; si alguno da 0, hacer `ROLLBACK`.

```sql
START TRANSACTION;

-- Regresar el pedido 774 a su fecha real de captura (07/07)
UPDATE fayxzvov_reginas.`order`
SET date_creation = '2026-07-07 00:00:00'
WHERE id = 774 AND DATE(date_creation) = '2026-07-13';

-- Quitar los $683 fantasma del cierre del 13/07
UPDATE fayxzvov_reginas.daily_closure
SET total_transfer = 500
WHERE id = 94 AND total_transfer = 1183;

UPDATE fayxzvov_reginas.closure_payment
SET amount = 500
WHERE daily_closure_id = 94 AND payment_method_id = 3 AND amount = 1183;

-- El 774 ya no cuenta como pendiente del día 13
UPDATE fayxzvov_reginas.closure_status_proccess
SET amount = 1
WHERE daily_closure_id = 94 AND status_process_id = 2 AND amount = 2;

COMMIT;
-- Si algún UPDATE afectó 0 filas: ROLLBACK;
```

El cierre #73 (07/07) **no se toca**: sus totales se calcularon cuando el 774 aún era del día 7, así que con la fecha restaurada vuelve a cuadrar solo.

## 3. Verificación posterior

```sql
-- 774: date_creation 2026-07-07 00:00:00, daily_closure_id 73
SELECT id, date_creation, daily_closure_id FROM fayxzvov_reginas.`order` WHERE id = 774;

-- #94: total_transfer 500 | #73 intacto (943)
SELECT id, total_cash, total_transfer FROM fayxzvov_reginas.daily_closure WHERE id IN (73, 94);
```

Regenerar el CORTE Z del 13/07: "ENTRÓ A CAJA" debe cuadrar con "TOTAL CAJA" ($2,600) y el P774-22 debe aparecer en el corte del 07/07, ya no en el del 13/07.
