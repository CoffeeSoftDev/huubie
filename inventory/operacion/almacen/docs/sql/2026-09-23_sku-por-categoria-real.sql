-- =====================================================================
-- SKU por categoría real (paso 4 de la reorganización categoría / área / almacén)
-- Fecha: 23/09/2026
-- BD:    fayxzvov_inventory
--
-- REQUISITO: correr antes 2026-09-23_categoria-a-area.sql y
--   2026-09-23_categorias-reales.sql. El SKU toma su prefijo de la categoría,
--   así que tiene que ir después de que cada producto tenga su categoría real.
--
-- FORMATO (el de Soft Restaurant, igual que ctrl-almacen.php::skuFor)
--   id de la categoría (2 dígitos o más) + consecutivo dentro de la categoría
--   (3 dígitos o más) por orden de alta: el 3.er producto de la categoría 26
--   es 26003. Sin categoría va al grupo 00.
--
-- QUÉ HACE
--   Regenera los SKU vacíos, los ITM-<id> y los del formato numérico, que hoy
--   traen el prefijo del anaquel (01..06). Un SKU capturado a mano con otro
--   formato NO se toca.
--
-- PROD: esta migración REEMPLAZA a 2026-09-22_sku-automatico.sql y a
--   2026-09-22_sku-formato-soft-restaurant.sql. No correr ninguna de esas dos.
--   @empresa = id de "Reginas - Pasteleria" (en local es 1).
--
-- MySQL 5.7 no tiene ROW_NUMBER(): el consecutivo se cuenta con un autojoin.
-- LPAD recorta lo que excede el largo; por eso GREATEST(n, LENGTH(x)).
--
-- RESPALDO: item_attribute_sku_bk_20260923 (id, item_id, sku) de las filas
--   tocadas. El -rollback las regresa y borra la tabla.
-- =====================================================================

USE fayxzvov_inventory;

SET @empresa := 1;


-- 0) RESPALDO -----------------------------------------------------------
CREATE TABLE item_attribute_sku_bk_20260923 AS
SELECT ia.id, ia.item_id, ia.sku
FROM item_attribute ia
JOIN item i ON i.id = ia.item_id
WHERE i.companies_id = @empresa
  AND (   ia.sku IS NULL
       OR ia.sku = ''
       OR ia.sku LIKE 'ITM-%'
       OR ia.sku REGEXP '^[0-9]{5,}$');


-- 1) SKU = CATEGORÍA + CONSECUTIVO --------------------------------------
UPDATE item_attribute ia
  JOIN item_attribute_sku_bk_20260923 bk ON bk.id = ia.id
  JOIN item i ON i.id = ia.item_id
  JOIN (
        SELECT i1.id, COUNT(*) AS n
          FROM item i1
          JOIN item i2
            ON i2.companies_id = i1.companies_id
           AND COALESCE(i2.category_id, 0) = COALESCE(i1.category_id, 0)
           AND i2.id <= i1.id
         WHERE i1.companies_id = @empresa
         GROUP BY i1.id
       ) seq ON seq.id = i.id
   SET ia.sku = CONCAT(
           LPAD(COALESCE(i.category_id, 0), GREATEST(2, LENGTH(COALESCE(i.category_id, 0))), '0'),
           LPAD(seq.n, GREATEST(3, LENGTH(seq.n)), '0')
       );


-- 2) VERIFICACIÓN -------------------------------------------------------
-- Esperado: sin_sku = 0, duplicados = 0, prefijo_distinto = 0.
SELECT
    COUNT(*)                                        AS productos,
    SUM(ia.sku IS NULL OR ia.sku = '')              AS sin_sku,
    COUNT(*) - COUNT(DISTINCT ia.sku)               AS duplicados,
    SUM(bk.id IS NOT NULL
        AND LEFT(ia.sku, LENGTH(ia.sku) - 3) <> LPAD(COALESCE(i.category_id, 0), GREATEST(2, LENGTH(COALESCE(i.category_id, 0))), '0')
    )                                               AS prefijo_distinto,
    SUM(bk.id IS NOT NULL)                          AS regenerados
FROM item i
JOIN item_attribute ia ON ia.item_id = i.id AND ia.active = 1
LEFT JOIN item_attribute_sku_bk_20260923 bk ON bk.id = ia.id
WHERE i.companies_id = @empresa;
