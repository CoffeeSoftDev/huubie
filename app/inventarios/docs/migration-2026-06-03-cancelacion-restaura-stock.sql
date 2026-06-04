-- ════════════════════════════════════════════════════════════════════════
--  Migracion: cancelacion coherente en mermas y ajustes
--  Fecha: 2026-06-03
--
--  Contexto:
--   1) Ajustes: el ENUM status era ('Pendiente','Aplicado','Revertido'). Se
--      unifica el vocabulario de cancelacion con el resto del inventario
--      (entradas/mermas usan 'Cancelada'); en ajustes, masculino: 'Cancelado'.
--      qReverseAjuste ahora escribe 'Cancelado'. La tabla estaba vacia.
--   2) inventory_movement: las ramas MERMA y AJUSTE no filtraban por estado, asi
--      que una merma/ajuste cancelado seguia contando como movimiento de stock.
--      Como cancelar ahora restaura el stock (ctrl cancelMerma), ya no es
--      movimiento real: se filtran por estado 'Aplicada'/'Aplicado', igual que la
--      rama ENTRADA.
--
--  YA APLICADA en BD local (fayxzvov_reginas). Ejecutar en produccion.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Ajustes: Revertido -> Cancelado.
UPDATE inventory_adjustment SET status = 'Aplicado' WHERE status = '';          -- por si hubo truncamiento previo
UPDATE inventory_adjustment SET status = 'Aplicado' WHERE status = 'Revertido'; -- temporal para poder cambiar el ENUM
ALTER TABLE inventory_adjustment
    MODIFY COLUMN status ENUM('Pendiente','Aplicado','Cancelado') NOT NULL DEFAULT 'Aplicado';

-- 2) VIEW inventory_movement: MERMA solo cuenta 'Aplicada', AJUSTE solo 'Aplicado'.
CREATE OR REPLACE VIEW inventory_movement AS
SELECT CONCAT('IN-', d.id)        AS movement_uid,
       'ENTRADA'                  AS movement_type,
       r.folio, d.product_id, d.quantity,
       d.previous_stock AS stock_prev, d.resulting_stock AS stock_post,
       d.cost AS cost_unit, d.subtotal AS cost_total,
       r.date_inflow AS occurred_at, r.warehouse_id, r.subsidiaries_id,
       r.user_id, r.note, r.status, r.companies_id
FROM detail_inventory_inflow d
JOIN inventory_inflow r ON r.id = d.inventory_inflow_id
WHERE d.active = 1 AND r.active = 1 AND r.status = 'Aplicada'

UNION ALL
SELECT CONCAT('SH-', d.id), 'MERMA', r.folio, d.product_id, d.quantity,
       d.previous_stock, d.resulting_stock, d.cost, d.subtotal_loss,
       r.created_at, r.warehouse_id, r.subsidiaries_id, r.user_id, r.note,
       r.status, r.companies_id
FROM detail_inventory_shrinkage d
JOIN inventory_shrinkage r ON r.id = d.inventory_shrinkage_id
WHERE d.active = 1 AND r.active = 1 AND r.status = 'Aplicada'

UNION ALL
SELECT CONCAT('TR-OUT-', d.id), 'TRANSFERENCIA', r.folio, d.product_id,
       -(d.quantity), d.origin_stock_prev, d.origin_stock_post, d.cost,
       -(d.subtotal), r.date_sent, r.origin_warehouse_id, r.origin_subsidiaries_id,
       r.requested_user_id, r.note, ts.code, r.companies_id
FROM detail_inventory_transfer d
JOIN inventory_transfer r ON r.id = d.inventory_transfer_id
JOIN transfer_status ts ON ts.id = r.status_id
WHERE d.active = 1 AND r.active = 1 AND r.date_sent IS NOT NULL

UNION ALL
SELECT CONCAT('TR-IN-', d.id), 'TRANSFERENCIA', r.folio, d.product_id,
       d.quantity, d.destination_stock_prev, d.destination_stock_post, d.cost,
       d.subtotal, r.date_received, r.destination_warehouse_id, r.destination_subsidiaries_id,
       r.received_user_id, r.note, ts.code, r.companies_id
FROM detail_inventory_transfer d
JOIN inventory_transfer r ON r.id = d.inventory_transfer_id
JOIN transfer_status ts ON ts.id = r.status_id
WHERE d.active = 1 AND r.active = 1 AND r.date_received IS NOT NULL

UNION ALL
SELECT CONCAT('AD-', d.id), 'AJUSTE', r.folio, d.product_id, d.difference,
       d.previous_stock, d.resulting_stock, d.cost, d.cost_diff,
       CONCAT(r.date_adjustment, ' ', r.time_adjustment), r.warehouse_id,
       r.subsidiaries_id, r.registered_user_id, r.note, r.status, r.companies_id
FROM detail_inventory_adjustment d
JOIN inventory_adjustment r ON r.id = d.inventory_adjustment_id
WHERE d.active = 1 AND r.active = 1 AND r.status = 'Aplicado';
