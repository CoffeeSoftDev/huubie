-- ─────────────────────────────────────────────────────────────────────
-- Migracion: inventory_movement (TABLA fisica vacia) -> VISTA unificada
-- Fecha: 2026-06-07
-- Motivo: el "Historial de movimientos" del Visor de Stock lee de
--         fayxzvov_inventory.inventory_movement, pero ningun flujo
--         (entradas, salidas/mermas) escribia jamas en esa tabla, asi que
--         siempre salia "Sin movimientos". Igual que el modulo de referencia
--         (app/inventarios), el kardex debe ser una VISTA que se alimenta
--         sola de los detalles ya registrados por entradas y salidas.
--
-- Solo cubre los modulos que existen en este esquema: ENTRADA (inventory_inflow)
-- y MERMA (inventory_shrinkage). Cuando se agreguen traspasos/ajustes, se
-- suman aqui con su propio UNION ALL.
-- ─────────────────────────────────────────────────────────────────────

USE `fayxzvov_inventory`;

-- La tabla estaba vacia (nadie la poblaba); se reemplaza por la vista.
DROP TABLE IF EXISTS `inventory_movement`;

CREATE OR REPLACE VIEW `inventory_movement` AS
    -- ── ENTRADAS (ingreso, cantidad positiva) ──
    SELECT
        CONCAT('IN-', d.id)                          AS movement_uid,
        'ENTRADA'                                    AS movement_type,
        r.folio                                      AS folio,
        r.note                                       AS note,
        COALESCE(d.confirmed_quantity, d.quantity)   AS quantity,
        d.previous_stock                             AS stock_prev,
        d.resulting_stock                            AS stock_post,
        d.cost                                       AS cost_unit,
        d.subtotal                                   AS cost_total,
        COALESCE(r.date_inflow, DATE(r.created_at))  AS occurred_at,
        r.created_at                                 AS created_at,
        r.status                                     AS status,
        d.item_id                                    AS item_id,
        r.warehouse_id                               AS warehouse_id,
        r.user_id                                    AS user_id,
        r.branch_id                                  AS branch_id,
        r.companies_id                               AS companies_id
    FROM `detail_inventory_inflow` d
    JOIN `inventory_inflow` r ON r.id = d.inventory_inflow_id
    WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

    UNION ALL

    -- ── SALIDAS / MERMAS (egreso, cantidad negativa) ──
    SELECT
        CONCAT('SH-', d.id),
        'MERMA',
        r.folio,
        r.note,
        -d.quantity,
        d.previous_stock,
        d.resulting_stock,
        d.cost,
        d.subtotal,
        COALESCE(r.date_shrinkage, DATE(r.created_at)),
        r.created_at,
        r.status,
        d.item_id,
        r.warehouse_id,
        r.user_id,
        r.branch_id,
        r.companies_id
    FROM `detail_inventory_shrinkage` d
    JOIN `inventory_shrinkage` r ON r.id = d.inventory_shrinkage_id
    WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada';
