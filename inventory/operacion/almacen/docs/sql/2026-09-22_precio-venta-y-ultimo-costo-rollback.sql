-- =====================================================================
-- ROLLBACK :: Precio de venta y último costo
-- Fecha: 22/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa item.price / price_without_tax / tax e item_attribute.cost_unit
-- desde los respaldos, quita la columna cost_tax y borra los respaldos.
--
-- OJO: el código nuevo escribe cost_tax en cada entrada. Si se regresa la BD
--   hay que regresar también ctrl/mdl de entradas y órdenes, o fallarán al
--   no encontrar la columna.
-- =====================================================================

UPDATE fayxzvov_inventory.item i
  JOIN fayxzvov_inventory.item_precio_bk_20260922 bk ON bk.id = i.id
   SET i.price             = bk.price,
       i.price_without_tax = bk.price_without_tax,
       i.tax               = bk.tax;

UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.item_attribute_costo_bk_20260922 bk ON bk.id = ia.id
   SET ia.cost_unit = bk.cost_unit;

ALTER TABLE fayxzvov_inventory.item_attribute DROP COLUMN cost_tax;

DROP TABLE fayxzvov_inventory.item_precio_bk_20260922;
DROP TABLE fayxzvov_inventory.item_attribute_costo_bk_20260922;
