-- ════════════════════════════════════════════════════════════════════════
--  Migracion: el historial de ENTRADAS muestra la cantidad realmente aplicada
--  Fecha: 2026-06-05
--
--  Contexto:
--   La rama ENTRADA de la vista inventory_movement exponia d.quantity (cantidad
--   REPORTADA al crear la entrada). En las ordenes de produccion la cantidad que
--   realmente entra al almacen es la CONFIRMADA (confirmed_quantity), que puede
--   diferir de la reportada. Resultado: el historial mostraba "+1" cuando al stock
--   se le habian aplicado, por ejemplo, 10 unidades, y el movimiento no cuadraba
--   con su propio snapshot stock_prev -> stock_post.
--
--   Se cambia a COALESCE(d.confirmed_quantity, d.quantity): entradas confirmadas
--   muestran la confirmada; las que nunca pasaron por confirmacion (confirmed NULL)
--   siguen mostrando la reportada, sin cambio de comportamiento.
--
--   Las demas ramas (MERMA, TRANSFERENCIA, AJUSTE) no cambian.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW inventory_movement AS
SELECT CONCAT('IN-', d.id)        AS movement_uid,
       'ENTRADA'                  AS movement_type,
       r.folio, d.product_id, COALESCE(d.confirmed_quantity, d.quantity) AS quantity,
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
