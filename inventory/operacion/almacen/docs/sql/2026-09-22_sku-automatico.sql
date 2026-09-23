-- =====================================================================
-- SUPERADA (23/09/2026): NO correr en prod. La reemplaza
--   2026-09-23_sku-por-categoria-real.sql, que usa las categorías reales.
-- =====================================================================
-- SKU automático: cada producto lleva ITM-<su id>
-- Fecha: 22/09/2026
-- BD:    fayxzvov_inventory
--
-- SÍNTOMA
--   En Almacén > Productos, 122 de 123 productos salían con SKU "-" y el
--   único que tenía uno no coincidía con su id (el producto 123 = ITM-124).
--
-- CAUSA
--   1) La carga masiva de insumos (2026-06-17_carga_insumos_reginas.sql) creó
--      las filas de item_attribute sin SKU.
--   2) getNextSku() calculaba MAX(item.id) + 1, pero se llamaba DESPUÉS de
--      insertar el producto: para entonces MAX(id) ya era el producto nuevo,
--      así que cada SKU salía corrido en uno.
--
-- QUÉ HACE
--   El controlador ya arma el SKU con el id propio del producto
--   (ctrl-almacen.php::skuFor). Esta migración pone los datos viejos en la
--   misma regla:
--     a) corrige los SKU corridos en uno (ITM-<id+1> -> ITM-<id>);
--     b) llena los que están vacíos con ITM-<id>.
--   Un SKU capturado a mano con otro formato NO se toca.
--
--   Sin a) el siguiente producto (id 124) nacería con ITM-124, que hoy ya lo
--   tiene el 123: dos productos con el mismo SKU.
--
-- RELLENO A 3 DÍGITOS: igual que str_pad(..., 3) del PHP. Se usa
--   GREATEST(3, LENGTH(id)) porque LPAD de MySQL RECORTA lo que excede el
--   largo: LPAD('1234', 3, '0') = '123'. str_pad de PHP no recorta.
--
-- RESPALDO: antes de tocar nada se copian (id, item_id, sku) de las filas
--   afectadas a item_attribute_sku_bk_20260922. El -rollback las regresa.
-- =====================================================================


-- 0) RESPALDO -----------------------------------------------------------
CREATE TABLE fayxzvov_inventory.item_attribute_sku_bk_20260922 AS
SELECT id, item_id, sku
FROM fayxzvov_inventory.item_attribute
WHERE sku IS NULL
   OR sku = ''
   OR sku = CONCAT('ITM-', LPAD(item_id + 1, GREATEST(3, LENGTH(item_id + 1)), '0'));


-- 1) SKU CORRIDOS EN UNO ------------------------------------------------
UPDATE fayxzvov_inventory.item_attribute
   SET sku = CONCAT('ITM-', LPAD(item_id, GREATEST(3, LENGTH(item_id)), '0'))
 WHERE sku = CONCAT('ITM-', LPAD(item_id + 1, GREATEST(3, LENGTH(item_id + 1)), '0'));


-- 2) SKU VACÍOS ---------------------------------------------------------
UPDATE fayxzvov_inventory.item_attribute
   SET sku = CONCAT('ITM-', LPAD(item_id, GREATEST(3, LENGTH(item_id)), '0'))
 WHERE sku IS NULL OR sku = '';


-- 3) VERIFICACIÓN -------------------------------------------------------
-- Esperado: sin_sku = 0 y duplicados = 0.
SELECT
    SUM(sku IS NULL OR sku = '')          AS sin_sku,
    COUNT(*) - COUNT(DISTINCT sku)        AS duplicados,
    (SELECT COUNT(*) FROM fayxzvov_inventory.item_attribute_sku_bk_20260922) AS respaldadas
FROM fayxzvov_inventory.item_attribute;
