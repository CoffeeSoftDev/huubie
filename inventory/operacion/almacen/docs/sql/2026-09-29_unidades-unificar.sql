-- =====================================================================
-- Unidades de medida: unificar las repetidas
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- La carga de Soft Restaurant dejó unidades repetidas con otro código:
--   PZ -> PZA (Pieza)   KILO -> KG (Kilogramo)   LITRO -> LT (Litros)   2KG -> 2 KG
--
-- `unit.code` es latin1: los códigos se comparan en BINARY (son ASCII) para que
-- corra igual desde consola o phpMyAdmin (utf8mb4).
--
-- Va por código y por empresa (no por id): en prod los ids son otros. Solo se
-- fusiona si la empresa tiene las dos. Productos, renglones de entrada y de
-- órdenes de compra que usaban la repetida pasan a la que se queda; después la
-- repetida se borra.
--
-- Respaldo para el -rollback:
--   bk_unit_merge_20260929      unidades borradas (+ keep_id, la que se quedó)
--   bk_unit_merge_ref_20260929  qué renglón apuntaba a cuál
-- =====================================================================

CREATE TABLE fayxzvov_inventory.bk_unit_merge_20260929 AS
SELECT d.id, d.code, d.name, d.active, d.created_at, d.companies_id, k.id AS keep_id
FROM fayxzvov_inventory.unit d
JOIN (
              SELECT 'PZ'    AS dup_code, 'PZA'  AS keep_code
    UNION ALL SELECT 'KILO',              'KG'
    UNION ALL SELECT 'LITRO',             'LT'
    UNION ALL SELECT '2KG',               '2 KG'
) m ON BINARY m.dup_code = BINARY d.code
JOIN fayxzvov_inventory.unit k ON BINARY k.code = BINARY m.keep_code AND k.companies_id = d.companies_id;

CREATE TABLE fayxzvov_inventory.bk_unit_merge_ref_20260929 AS
SELECT 'item_attribute' AS tabla, x.id AS row_id, x.unit_id
FROM fayxzvov_inventory.item_attribute x
JOIN fayxzvov_inventory.bk_unit_merge_20260929 b ON b.id = x.unit_id
UNION ALL
SELECT 'detail_inventory_inflow', x.id, x.unit_id
FROM fayxzvov_inventory.detail_inventory_inflow x
JOIN fayxzvov_inventory.bk_unit_merge_20260929 b ON b.id = x.unit_id
UNION ALL
SELECT 'detail_purchase_order', x.id, x.unit_id
FROM fayxzvov_inventory.detail_purchase_order x
JOIN fayxzvov_inventory.bk_unit_merge_20260929 b ON b.id = x.unit_id;

UPDATE fayxzvov_inventory.item_attribute x
JOIN fayxzvov_inventory.bk_unit_merge_20260929 b ON b.id = x.unit_id
SET x.unit_id = b.keep_id;

UPDATE fayxzvov_inventory.detail_inventory_inflow x
JOIN fayxzvov_inventory.bk_unit_merge_20260929 b ON b.id = x.unit_id
SET x.unit_id = b.keep_id;

UPDATE fayxzvov_inventory.detail_purchase_order x
JOIN fayxzvov_inventory.bk_unit_merge_20260929 b ON b.id = x.unit_id
SET x.unit_id = b.keep_id;

DELETE FROM fayxzvov_inventory.unit
WHERE id IN (SELECT id FROM fayxzvov_inventory.bk_unit_merge_20260929);
