-- =====================================================================
-- ROLLBACK :: Producto inventariable
-- Fecha: 27/09/2026
-- BD:    fayxzvov_inventory
--
-- Quita la columna is_inventoriable.
--
-- OJO: addMaterial, editMaterial y getMaterialById (almacen) la leen y la
--   escriben. Si se regresa la BD hay que regresar también ese ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.item_attribute DROP COLUMN is_inventoriable;
