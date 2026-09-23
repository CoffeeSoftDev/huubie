-- =====================================================================
-- ROLLBACK :: SKU por categoría real
-- Fecha: 23/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa el SKU de las filas que tocó la migración, tal como estaban,
-- y borra la tabla de respaldo.
--
-- OJO: un producto dado de alta DESPUÉS de la migración ya nace con el
--   prefijo de su categoría real (ctrl-almacen.php::skuFor) y conserva el suyo.
-- =====================================================================

USE fayxzvov_inventory;

UPDATE item_attribute ia
  JOIN item_attribute_sku_bk_20260923 bk ON bk.id = ia.id
   SET ia.sku = bk.sku;

DROP TABLE item_attribute_sku_bk_20260923;
