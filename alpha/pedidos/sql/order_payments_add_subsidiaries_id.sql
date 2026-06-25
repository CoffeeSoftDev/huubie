-- Cobro cruzado entre sucursales (Opción B, Fase 1).
-- Agrega la sucursal de cobro a cada abono. El código (mdl-pedidos.php:
-- getListPayment, getDailySalesMetrics, getShiftSalesMetrics) ya referencia
-- order_payments.subsidiaries_id; sin esta columna el "Historial de Pagos"
-- y los reportes de cobranza fallan con "Unknown column 'subsidiaries_id'".
-- Ver docs/cobro-cruzado-sucursales.md.
-- Base: fayxzvov_reginas (única con order_payments).

-- 1. Esquema
ALTER TABLE fayxzvov_reginas.order_payments
  ADD COLUMN subsidiaries_id INT NULL AFTER order_id;

-- 2. Backfill: a los pagos históricos, la sucursal de su pedido.
UPDATE fayxzvov_reginas.order_payments pp
INNER JOIN fayxzvov_reginas.`order` po ON pp.order_id = po.id
SET pp.subsidiaries_id = po.subsidiaries_id
WHERE pp.subsidiaries_id IS NULL;

-- 3. Corrección del caso real 664: el abono #800 ($430) se cobró en gpe (4),
--    no en cuarta (22, sucursal del pedido).
UPDATE fayxzvov_reginas.order_payments SET subsidiaries_id = 4 WHERE id = 800;
