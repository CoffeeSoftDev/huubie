-- =====================================================================
-- ROLLBACK :: Merma -> Salida: tipo de movimiento del kárdex
-- Fecha: 06/10/2026
-- BD:    fayxzvov_inventory
--
-- Regresa el bloque 2 de inventory_movement a 'MERMA'. Los otros cuatro
-- bloques quedan igual.
--
-- OJO: ctrl-stock, ctrl/mdl-movimientos y movimientos.js buscan 'SALIDA'.
--   Si se regresa la BD hay que regresar también ese código.
-- =====================================================================

CREATE OR REPLACE VIEW `fayxzvov_inventory`.`inventory_movement` AS

SELECT CONCAT('IN-', d.id)                                 AS movement_uid,
       'ENTRADA'                                           AS movement_type,
       r.folio                                             AS folio,
       r.note                                              AS note,
       COALESCE(d.confirmed_quantity, d.quantity)          AS quantity,
       d.previous_stock                                    AS stock_prev,
       d.resulting_stock                                   AS stock_post,
       d.cost                                              AS cost_unit,
       d.subtotal                                          AS cost_total,
       COALESCE(r.date_inflow, CAST(r.created_at AS DATE)) AS occurred_at,
       r.created_at                                        AS created_at,
       r.status                                            AS status,
       d.item_id                                           AS item_id,
       r.warehouse_id                                      AS warehouse_id,
       r.user_id                                           AS user_id,
       r.branch_id                                         AS branch_id,
       r.companies_id                                      AS companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_inflow` d
  JOIN `fayxzvov_inventory`.`inventory_inflow` r ON r.id = d.inventory_inflow_id
 WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

UNION ALL

SELECT CONCAT('SH-', d.id),
       'MERMA',
       r.folio,
       r.note,
       -d.quantity,
       d.previous_stock,
       d.resulting_stock,
       d.cost,
       d.subtotal,
       COALESCE(r.date_shrinkage, CAST(r.created_at AS DATE)),
       r.created_at,
       r.status,
       d.item_id,
       r.warehouse_id,
       r.user_id,
       r.branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_shrinkage` d
  JOIN `fayxzvov_inventory`.`inventory_shrinkage` r ON r.id = d.inventory_shrinkage_id
 WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

UNION ALL

SELECT CONCAT('TR-OUT-', d.id),
       'TRANSFERENCIA',
       r.folio,
       r.note,
       -d.quantity,
       d.origin_stock_prev,
       d.origin_stock_post,
       d.cost,
       -d.subtotal,
       COALESCE(r.date_received, CAST(r.created_at AS DATE)),
       r.created_at,
       ts.name,
       d.item_id,
       r.origin_warehouse_id,
       r.received_user_id,
       r.origin_branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_transfer` d
  JOIN `fayxzvov_inventory`.`inventory_transfer` r ON r.id = d.inventory_transfer_id
  JOIN `fayxzvov_inventory`.`transfer_status` ts   ON ts.id = r.status_id
 WHERE d.active = 1 AND r.active = 1 AND ts.code = 'RECEIVED' AND d.origin_stock_post IS NOT NULL

UNION ALL

SELECT CONCAT('TR-IN-', d.id),
       'TRANSFERENCIA',
       r.folio,
       r.note,
       d.quantity,
       d.destination_stock_prev,
       d.destination_stock_post,
       d.cost,
       d.subtotal,
       COALESCE(r.date_received, CAST(r.created_at AS DATE)),
       r.created_at,
       ts.name,
       d.item_id,
       r.destination_warehouse_id,
       r.received_user_id,
       r.destination_branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_transfer` d
  JOIN `fayxzvov_inventory`.`inventory_transfer` r ON r.id = d.inventory_transfer_id
  JOIN `fayxzvov_inventory`.`transfer_status` ts   ON ts.id = r.status_id
 WHERE d.active = 1 AND r.active = 1 AND ts.code = 'RECEIVED' AND d.destination_stock_post IS NOT NULL

UNION ALL

SELECT CONCAT('ADJ-', d.id),
       'AJUSTE',
       r.folio,
       r.note,
       d.difference,
       d.previous_stock,
       d.resulting_stock,
       d.cost,
       d.cost_diff,
       COALESCE(CAST(r.authorized_at AS DATE), r.date_adjustment),
       COALESCE(r.authorized_at, r.created_at),
       r.status,
       d.item_id,
       r.warehouse_id,
       COALESCE(r.authorized_user_id, r.registered_user_id),
       r.branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_adjustment` d
  JOIN `fayxzvov_inventory`.`inventory_adjustment` r ON r.id = d.inventory_adjustment_id
 WHERE d.active = 1 AND r.active = 1 AND r.status = 'Aplicado' AND d.difference <> 0;
