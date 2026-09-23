-- =====================================================================
-- ROLLBACK :: SKU con el formato de claves de Soft Restaurant
-- Fecha: 22/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa el SKU de las filas que tocó la migración, tal como estaban
-- (vacío o ITM-<id>), desde la tabla de respaldo, y la borra.
--
-- OJO: un producto dado de alta DESPUÉS de la migración ya nace con el
--   formato nuevo por el controlador y no está en el respaldo, así que
--   conserva el suyo. Regresar también el código a ITM-<id> es aparte.
-- =====================================================================

UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.item_attribute_sku_bk_20260922_sr bk ON bk.id = ia.id
   SET ia.sku = bk.sku;

DROP TABLE fayxzvov_inventory.item_attribute_sku_bk_20260922_sr;
