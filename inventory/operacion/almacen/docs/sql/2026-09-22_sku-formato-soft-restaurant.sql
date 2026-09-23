-- =====================================================================
-- SUPERADA (23/09/2026): NO correr en prod. La reemplaza
--   2026-09-23_sku-por-categoria-real.sql, que usa las categorías reales.
-- =====================================================================
-- SKU con el formato de claves de Soft Restaurant
-- Fecha: 22/09/2026
-- BD:    fayxzvov_inventory
--
-- FORMATO
--   Soft Restaurant arma la clave del producto con la clave del grupo
--   (2 dígitos) + un consecutivo dentro del grupo (3 dígitos). Medido en
--   rfwsmqex_gvsl_finanzas.soft_productos: GUARNICIONES = 19001 ARROZ,
--   19002 CHILAQUILES, 19003 CHILES TOREADOS...
--
--   Aquí el grupo es la categoría (item_category.id). El n-ésimo producto
--   de la categoría, por orden de alta, lleva <categoría><n>:
--     categoría 4, tercer producto -> 04003.
--   Un producto sin categoría va al grupo 00.
--
-- QUÉ HACE
--   Pasa al formato nuevo los SKU vacíos y los del formato anterior
--   (ITM-<id>). Un SKU capturado a mano con otro formato NO se toca.
--   El controlador (ctrl-almacen.php::skuFor) ya da de alta con esta regla.
--
-- PROD: esta migración REEMPLAZA a 2026-09-22_sku-automatico.sql, que
--   quedó pendiente allá. Basta con correr esta: llena también los vacíos.
--
-- RELLENO: GREATEST(n, LENGTH(x)) porque LPAD de MySQL RECORTA lo que
--   excede el largo (LPAD('123', 2, '0') = '12'). str_pad de PHP no recorta.
--
-- MySQL 5.7 no tiene ROW_NUMBER(): el consecutivo se cuenta con un
--   autojoin (cuántos productos de la misma categoría tienen id <= el suyo).
--
-- RESPALDO: antes de tocar nada se copian (id, item_id, sku) de las filas
--   afectadas a item_attribute_sku_bk_20260922_sr. El -rollback las regresa.
-- =====================================================================


-- 0) RESPALDO -----------------------------------------------------------
CREATE TABLE fayxzvov_inventory.item_attribute_sku_bk_20260922_sr AS
SELECT id, item_id, sku
FROM fayxzvov_inventory.item_attribute
WHERE sku IS NULL
   OR sku = ''
   OR sku LIKE 'ITM-%';


-- 1) SKU FORMATO SOFT RESTAURANT ----------------------------------------
UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.item i ON i.id = ia.item_id
  JOIN (
        SELECT i1.id, COUNT(*) AS n
          FROM fayxzvov_inventory.item i1
          JOIN fayxzvov_inventory.item i2
            ON i2.companies_id = i1.companies_id
           AND COALESCE(i2.category_id, 0) = COALESCE(i1.category_id, 0)
           AND i2.id <= i1.id
         GROUP BY i1.id
       ) seq ON seq.id = i.id
   SET ia.sku = CONCAT(
           LPAD(COALESCE(i.category_id, 0), GREATEST(2, LENGTH(COALESCE(i.category_id, 0))), '0'),
           LPAD(seq.n, GREATEST(3, LENGTH(seq.n)), '0')
       )
 WHERE ia.sku IS NULL
    OR ia.sku = ''
    OR ia.sku LIKE 'ITM-%';


-- 2) VERIFICACIÓN -------------------------------------------------------
-- Esperado: sin_sku = 0, formato_viejo = 0 y duplicados = 0.
SELECT
    SUM(sku IS NULL OR sku = '')          AS sin_sku,
    SUM(sku LIKE 'ITM-%')                 AS formato_viejo,
    COUNT(*) - COUNT(DISTINCT sku)        AS duplicados,
    (SELECT COUNT(*) FROM fayxzvov_inventory.item_attribute_sku_bk_20260922_sr) AS respaldadas
FROM fayxzvov_inventory.item_attribute;
