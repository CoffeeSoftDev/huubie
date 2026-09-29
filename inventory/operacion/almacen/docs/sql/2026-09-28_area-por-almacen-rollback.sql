-- =====================================================================
-- ROLLBACK :: Área = lugar dentro de un almacén; la categoría ya no apunta a almacén
-- Fecha: 28/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa item_category.warehouse_id (con los valores del respaldo) y quita
-- warehouse_area.warehouse_id.
--
-- OJO: el catálogo de Áreas (ctrl/mdl-catalogo), el asistente IA
--   (ctrl-almacen::altaCatalogoIA) y el Destino de Entradas escriben o leen
--   warehouse_area.warehouse_id. Si se regresa la BD hay que regresar ese código.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.item_category
    ADD COLUMN warehouse_id INT NULL AFTER name,
    ADD KEY idx_item_category_warehouse (warehouse_id),
    ADD CONSTRAINT fk_item_category_warehouse FOREIGN KEY (warehouse_id)
        REFERENCES fayxzvov_inventory.warehouse (id);

UPDATE fayxzvov_inventory.item_category c
  JOIN fayxzvov_inventory.item_category_warehouse_bk_20260928 bk ON bk.id = c.id
   SET c.warehouse_id = bk.warehouse_id;

DROP TABLE fayxzvov_inventory.item_category_warehouse_bk_20260928;

ALTER TABLE fayxzvov_inventory.warehouse_area
    DROP FOREIGN KEY fk_warehouse_area_warehouse;

ALTER TABLE fayxzvov_inventory.warehouse_area
    DROP KEY idx_warehouse_area_warehouse,
    DROP COLUMN warehouse_id;
