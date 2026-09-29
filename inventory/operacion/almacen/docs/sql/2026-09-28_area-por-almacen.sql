-- =====================================================================
-- Área = lugar dentro de un almacén; la categoría ya no apunta a almacén
-- Fecha: 28/09/2026
-- BD:    fayxzvov_inventory
--
-- Regla acordada:
--   Categoría (item_category)  = qué es el producto. No se liga a almacén ni a área.
--   Almacén   (warehouse)      = dónde se cuenta el stock.
--   Área      (warehouse_area) = lugar dentro de UN almacén (vitrina, refrigerador...).
--
-- 1) warehouse_area.warehouse_id   almacén al que pertenece el área. Las áreas
--    existentes se asignan al almacén por defecto de su empresa (activo,
--    is_default primero, luego el id más bajo).
--
-- 2) item_category.warehouse_id se borra. Ningún ctrl/mdl/js la lee ni la
--    escribe (revisado 28/09/2026) y ninguna vista la usa. Antes de borrarla
--    se respaldan las categorías que la tengan llena.
--
-- Queda viva warehouse.warehouse_area_id (la leen los selects de almacén de
-- entradas, traspasos, órdenes y stock); se quita en otra migración.
-- =====================================================================

-- 1) ÁREA -> ALMACÉN ----------------------------------------------------------
ALTER TABLE fayxzvov_inventory.warehouse_area
    ADD COLUMN warehouse_id INT NULL AFTER companies_id,
    ADD KEY idx_warehouse_area_warehouse (warehouse_id),
    ADD CONSTRAINT fk_warehouse_area_warehouse FOREIGN KEY (warehouse_id)
        REFERENCES fayxzvov_inventory.warehouse (id);

UPDATE fayxzvov_inventory.warehouse_area wa
   SET wa.warehouse_id = (
       SELECT w.id
         FROM fayxzvov_inventory.warehouse w
        WHERE w.companies_id = wa.companies_id
        ORDER BY w.active DESC, w.is_default DESC, w.id ASC
        LIMIT 1
   )
 WHERE wa.warehouse_id IS NULL;


-- 2) CATEGORÍA SIN ALMACÉN ----------------------------------------------------
CREATE TABLE fayxzvov_inventory.item_category_warehouse_bk_20260928 AS
SELECT id, warehouse_id
  FROM fayxzvov_inventory.item_category
 WHERE warehouse_id IS NOT NULL;

ALTER TABLE fayxzvov_inventory.item_category
    DROP FOREIGN KEY fk_item_category_warehouse;

ALTER TABLE fayxzvov_inventory.item_category
    DROP KEY idx_item_category_warehouse,
    DROP COLUMN warehouse_id;
