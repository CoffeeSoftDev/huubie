-- =====================================================================
-- ROLLBACK de 2026-10-19_catalogos-por-sucursal.sql
-- Bajar antes el código (mdl-visibilidad y los mdl que filtran por branch_id).
-- Las categorías y proveedores vuelven a ser de toda la empresa.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.item_category DROP INDEX idx_item_category_branch, DROP COLUMN branch_id;
ALTER TABLE fayxzvov_inventory.supplier      DROP INDEX idx_supplier_branch,      DROP COLUMN branch_id;
