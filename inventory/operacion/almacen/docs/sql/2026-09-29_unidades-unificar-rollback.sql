-- =====================================================================
-- ROLLBACK :: Unidades de medida: unificar las repetidas
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa las unidades borradas con su mismo id y vuelve a apuntar cada
-- renglón a la unidad que tenía, desde las tablas de respaldo. Al final las
-- borra.
-- =====================================================================

INSERT INTO fayxzvov_inventory.unit (id, code, name, active, created_at, companies_id)
SELECT id, code, name, active, created_at, companies_id
FROM fayxzvov_inventory.bk_unit_merge_20260929;

UPDATE fayxzvov_inventory.item_attribute x
JOIN fayxzvov_inventory.bk_unit_merge_ref_20260929 r ON r.tabla = 'item_attribute' AND r.row_id = x.id
SET x.unit_id = r.unit_id;

UPDATE fayxzvov_inventory.detail_inventory_inflow x
JOIN fayxzvov_inventory.bk_unit_merge_ref_20260929 r ON r.tabla = 'detail_inventory_inflow' AND r.row_id = x.id
SET x.unit_id = r.unit_id;

UPDATE fayxzvov_inventory.detail_purchase_order x
JOIN fayxzvov_inventory.bk_unit_merge_ref_20260929 r ON r.tabla = 'detail_purchase_order' AND r.row_id = x.id
SET x.unit_id = r.unit_id;

DROP TABLE fayxzvov_inventory.bk_unit_merge_ref_20260929;
DROP TABLE fayxzvov_inventory.bk_unit_merge_20260929;
