-- =============================================================================
-- Rollback de 2026-11-28_catalogo-de-insumos.sql
-- Fecha:  28/11/2026
-- BD:     la del .env de pro (DB_NAME, hoy fayxzvov_app) y fayxzvov_inventarios
--
-- Borra los grupos de insumos y el proveedor habitual de cada insumo, y los
-- catálogos vuelven a llamarse «Catálogo». Correr DESPUÉS de regresar el código.
-- =============================================================================

SET NAMES utf8mb4;

ALTER TABLE fayxzvov_inventarios.product_inventory
  DROP FOREIGN KEY `product_inventory_ibfk_4`,
  DROP FOREIGN KEY `product_inventory_ibfk_5`;

ALTER TABLE fayxzvov_inventarios.product_inventory
  DROP KEY `supply_group_id`,
  DROP KEY `supplier_id`,
  DROP COLUMN `supply_group_id`,
  DROP COLUMN `supplier_id`;

DROP TABLE fayxzvov_inventarios.supply_group;

UPDATE sections SET name = 'Catálogo' WHERE code IN ('catalogo', 'inv-catalogo');
