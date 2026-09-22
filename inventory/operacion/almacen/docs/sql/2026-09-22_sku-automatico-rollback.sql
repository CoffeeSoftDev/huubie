-- =====================================================================
-- ROLLBACK :: SKU automático
-- Fecha: 22/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa el SKU de las filas que tocó la migración, tal como estaban
-- (vacío o corrido en uno), desde la tabla de respaldo, y la borra.
--
-- OJO: un producto dado de alta DESPUÉS de la migración ya nace con su SKU
--   por el controlador y no está en el respaldo, así que conserva el suyo.
-- =====================================================================

UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.item_attribute_sku_bk_20260922 bk ON bk.id = ia.id
   SET ia.sku = bk.sku;

DROP TABLE fayxzvov_inventory.item_attribute_sku_bk_20260922;
