-- ════════════════════════════════════════════════════════════════════════
--  Migracion: ordenes de produccion entran Pendientes
--  Fecha: 2026-06-01
--
--  Contexto: las entradas con origen PRODUCCION (inflow_origin.code='PRODUCTION')
--  representan ordenes que el panadero debe revisar/producir. Por eso entran en
--  estado 'Pendiente' y NO aplican stock hasta confirmarse (confirmEntrada).
--  El resto de origenes sigue entrando 'Aplicada' y aplica stock de inmediato.
--
--  YA APLICADA en BD local (fayxzvov_reginas). Ejecutar en produccion.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Auditoria de confirmacion de ordenes de produccion.
ALTER TABLE inventory_inflow
    ADD COLUMN confirmed_user_id INT NULL AFTER user_id,
    ADD COLUMN confirmed_at DATETIME NULL AFTER confirmed_user_id;

-- 1b) El ENUM status traia 'Pendiente'/'Aplicada'/'Revertida' pero el codigo
--     (reverseEntrada -> qReverseEntrada) y el frontend usan 'Cancelada'.
--     Sin este valor, cancelar una entrada falla (o guarda '' en modo no estricto).
ALTER TABLE inventory_inflow
    MODIFY COLUMN status ENUM('Pendiente','Aplicada','Revertida','Cancelada') NOT NULL DEFAULT 'Aplicada';

-- 2) VIEW inventory_movement: la rama ENTRADA solo cuenta entradas Aplicadas
--    (Pendientes de produccion y Canceladas no son movimiento de stock real,
--    igual que las transferencias filtran por date_sent / date_received).
CREATE OR REPLACE VIEW inventory_movement AS
SELECT CONCAT('IN-', d.id)        AS movement_uid,
       'ENTRADA'                  AS movement_type,
       r.folio                    AS folio,
       d.product_id               AS product_id,
       d.quantity                 AS quantity,
       d.previous_stock           AS stock_prev,
       d.resulting_stock          AS stock_post,
       d.cost                     AS cost_unit,
       d.subtotal                 AS cost_total,
       r.date_inflow              AS occurred_at,
       r.warehouse_id             AS warehouse_id,
       r.subsidiaries_id          AS subsidiaries_id,
       r.user_id                  AS user_id,
       r.note                     AS note,
       r.status                   AS status,
       r.companies_id             AS companies_id
FROM detail_inventory_inflow d
JOIN inventory_inflow r ON r.id = d.inventory_inflow_id
WHERE d.active = 1 AND r.active = 1 AND r.status = 'Aplicada'

UNION ALL
SELECT CONCAT('SH-', d.id),
       'MERMA',
       r.folio,
       d.product_id,
       d.quantity,
       d.previous_stock,
       d.resulting_stock,
       d.cost,
       d.subtotal_loss,
       r.created_at,
       r.warehouse_id,
       r.subsidiaries_id,
       r.user_id,
       r.note,
       r.status,
       r.companies_id
FROM detail_inventory_shrinkage d
JOIN inventory_shrinkage r ON r.id = d.inventory_shrinkage_id
WHERE d.active = 1 AND r.active = 1

UNION ALL
SELECT CONCAT('TR-OUT-', d.id),
       'TRANSFERENCIA',
       r.folio,
       d.product_id,
       -(d.quantity),
       d.origin_stock_prev,
       d.origin_stock_post,
       d.cost,
       -(d.subtotal),
       r.date_sent,
       r.origin_warehouse_id,
       r.origin_subsidiaries_id,
       r.requested_user_id,
       r.note,
       ts.code,
       r.companies_id
FROM detail_inventory_transfer d
JOIN inventory_transfer r ON r.id = d.inventory_transfer_id
JOIN transfer_status ts ON ts.id = r.status_id
WHERE d.active = 1 AND r.active = 1 AND r.date_sent IS NOT NULL

UNION ALL
SELECT CONCAT('TR-IN-', d.id),
       'TRANSFERENCIA',
       r.folio,
       d.product_id,
       d.quantity,
       d.destination_stock_prev,
       d.destination_stock_post,
       d.cost,
       d.subtotal,
       r.date_received,
       r.destination_warehouse_id,
       r.destination_subsidiaries_id,
       r.received_user_id,
       r.note,
       ts.code,
       r.companies_id
FROM detail_inventory_transfer d
JOIN inventory_transfer r ON r.id = d.inventory_transfer_id
JOIN transfer_status ts ON ts.id = r.status_id
WHERE d.active = 1 AND r.active = 1 AND r.date_received IS NOT NULL

UNION ALL
SELECT CONCAT('AD-', d.id),
       'AJUSTE',
       r.folio,
       d.product_id,
       d.difference,
       d.previous_stock,
       d.resulting_stock,
       d.cost,
       d.cost_diff,
       CONCAT(r.date_adjustment, ' ', r.time_adjustment),
       r.warehouse_id,
       r.subsidiaries_id,
       r.registered_user_id,
       r.note,
       r.status,
       r.companies_id
FROM detail_inventory_adjustment d
JOIN inventory_adjustment r ON r.id = d.inventory_adjustment_id
WHERE d.active = 1 AND r.active = 1;
