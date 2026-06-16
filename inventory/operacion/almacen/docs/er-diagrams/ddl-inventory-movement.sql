-- =====================================================================
--  Vista inventory_movement (kardex unificado) — fayxzvov_inventory
-- ---------------------------------------------------------------------
--  inventory_movement NO es una tabla, es una VISTA: deriva cada
--  movimiento de las tablas de documentos (entradas, mermas, traspasos).
--  No se puede INSERT en ella; para sumar un tipo de movimiento se
--  redefine la vista.
--
--  Esta version agrega las 2 ramas de TRASPASO (salida origen + entrada
--  destino), portando el patron de fayxzvov_reginas (POS) adaptado al
--  esquema del ERP (item_id / branch_id) y al flujo de UN paso del ERP.
--
--  IMPORTANTE — filtro por estado RECEIVED (no por *_stock_post IS NOT NULL):
--  saveTraspaso llena origin_stock_post desde que se SOLICITA (es una
--  proyeccion, el stock fisico NO se mueve ahi), asi que filtrar por
--  origin_stock_post IS NOT NULL mostraba salidas fantasma de traspasos
--  SOLICITADOS y RECHAZADOS. El stock real solo se mueve en confirmTraspaso
--  (estado RECEIVED), por eso ambas ramas filtran ts.code = 'RECEIVED'.
--
--  Direccion del movimiento: signo de quantity (negativa = salida,
--  positiva = entrada) y prefijo del movement_uid (TR-OUT- / TR-IN-).
--
--  Aplicar:  mysql ... < ddl-inventory-movement.sql
--            (o via PHP CLI con la conexion del proyecto)
-- =====================================================================

CREATE OR REPLACE VIEW fayxzvov_inventory.inventory_movement AS

-- Rama 1: ENTRADA (inventory_inflow)
SELECT
    CONCAT('IN-', d.id)                                AS movement_uid,
    'ENTRADA'                                          AS movement_type,
    r.folio                                            AS folio,
    r.note                                             AS note,
    COALESCE(d.confirmed_quantity, d.quantity)         AS quantity,
    d.previous_stock                                   AS stock_prev,
    d.resulting_stock                                  AS stock_post,
    d.cost                                             AS cost_unit,
    d.subtotal                                         AS cost_total,
    COALESCE(r.date_inflow, CAST(r.created_at AS DATE)) AS occurred_at,
    r.created_at                                       AS created_at,
    r.status                                           AS status,
    d.item_id                                          AS item_id,
    r.warehouse_id                                     AS warehouse_id,
    r.user_id                                          AS user_id,
    r.branch_id                                        AS branch_id,
    r.companies_id                                     AS companies_id
FROM fayxzvov_inventory.detail_inventory_inflow d
JOIN fayxzvov_inventory.inventory_inflow r ON r.id = d.inventory_inflow_id
WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

UNION ALL

-- Rama 2: MERMA (inventory_shrinkage)
SELECT
    CONCAT('SH-', d.id),
    'MERMA',
    r.folio,
    r.note,
    -(d.quantity),
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
FROM fayxzvov_inventory.detail_inventory_shrinkage d
JOIN fayxzvov_inventory.inventory_shrinkage r ON r.id = d.inventory_shrinkage_id
WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

UNION ALL

-- Rama 3: TRASPASO — salida del almacen origen (NUEVA)
SELECT
    CONCAT('TR-OUT-', d.id),
    'TRANSFERENCIA',
    r.folio,
    r.note,
    -(d.quantity),
    d.origin_stock_prev,
    d.origin_stock_post,
    d.cost,
    -(d.subtotal),
    COALESCE(r.date_received, CAST(r.created_at AS DATE)),
    r.created_at,
    ts.name,
    d.item_id,
    r.origin_warehouse_id,
    r.received_user_id,
    r.origin_branch_id,
    r.companies_id
FROM fayxzvov_inventory.detail_inventory_transfer d
JOIN fayxzvov_inventory.inventory_transfer r ON r.id = d.inventory_transfer_id
JOIN fayxzvov_inventory.transfer_status ts ON ts.id = r.status_id
WHERE d.active = 1 AND r.active = 1 AND ts.code = 'RECEIVED' AND d.origin_stock_post IS NOT NULL

UNION ALL

-- Rama 4: TRASPASO — entrada al almacen destino (NUEVA)
SELECT
    CONCAT('TR-IN-', d.id),
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
FROM fayxzvov_inventory.detail_inventory_transfer d
JOIN fayxzvov_inventory.inventory_transfer r ON r.id = d.inventory_transfer_id
JOIN fayxzvov_inventory.transfer_status ts ON ts.id = r.status_id
WHERE d.active = 1 AND r.active = 1 AND ts.code = 'RECEIVED' AND d.destination_stock_post IS NOT NULL;


-- =====================================================================
--  RESPALDO — definicion ORIGINAL (2 ramas: ENTRADA + MERMA).
--  Para revertir, ejecutar este CREATE OR REPLACE.
-- =====================================================================
-- CREATE OR REPLACE VIEW fayxzvov_inventory.inventory_movement AS
-- SELECT CONCAT('IN-',d.id) AS movement_uid,'ENTRADA' AS movement_type,r.folio AS folio,r.note AS note,COALESCE(d.confirmed_quantity,d.quantity) AS quantity,d.previous_stock AS stock_prev,d.resulting_stock AS stock_post,d.cost AS cost_unit,d.subtotal AS cost_total,COALESCE(r.date_inflow,CAST(r.created_at AS DATE)) AS occurred_at,r.created_at AS created_at,r.status AS status,d.item_id AS item_id,r.warehouse_id AS warehouse_id,r.user_id AS user_id,r.branch_id AS branch_id,r.companies_id AS companies_id FROM fayxzvov_inventory.detail_inventory_inflow d JOIN fayxzvov_inventory.inventory_inflow r ON r.id=d.inventory_inflow_id WHERE d.active=1 AND r.active=1 AND r.status<>'Cancelada'
-- UNION ALL
-- SELECT CONCAT('SH-',d.id),'MERMA',r.folio,r.note,-(d.quantity),d.previous_stock,d.resulting_stock,d.cost,d.subtotal,COALESCE(r.date_shrinkage,CAST(r.created_at AS DATE)),r.created_at,r.status,d.item_id,r.warehouse_id,r.user_id,r.branch_id,r.companies_id FROM fayxzvov_inventory.detail_inventory_shrinkage d JOIN fayxzvov_inventory.inventory_shrinkage r ON r.id=d.inventory_shrinkage_id WHERE d.active=1 AND r.active=1 AND r.status<>'Cancelada';
