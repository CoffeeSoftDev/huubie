-- ============================================================================
--  Actualizacion de PRECIOS y COSTOS de los productos migrados
--    Fuente:  rfwsmqex_gvsl_costsys.recetas  (precio de venta)
--    Destino: fayxzvov_reginas  (order_products.price + product_attribute.cost_unit)
-- ----------------------------------------------------------------------------
--  Decision FINAL (corregida): tanto el PRECIO como el COSTO se llenan con el
--  PRECIO DE VENTA (recetas.precioVenta). NO se usa el costo de produccion de
--  costopotencial (esa fue una primera version que se corrigio: el negocio valora
--  el costo de la merma con el precio de venta, no con el costo de produccion).
--
--    - order_products.price        <- recetas.precioVenta (MAX por nombre)
--    - product_attribute.cost_unit <- recetas.precioVenta (mismo valor)
--    - Solo se tocan productos en $0 (NULL o 0), companies_id = 4, active = 1.
--    - Match por nombre normalizado: UPPER(TRIM(...)).
--
--  Cobertura: ~331 productos (de 375 en $0). ~44 quedan en 0 (sin receta por
--  nombre) -> captura manual.
--
--  MySQL 5.7 (sin CTEs): se usa TEMPORARY TABLE -> EJECUTAR TODO EN UNA SOLA
--  SESION y con una BD por defecto seleccionada, p.ej.:
--      mysql -u root fayxzvov_reginas < este_script.sql
--  (sin la BD por defecto, el CREATE TABLE ... AS SELECT de la seccion 0.bis
--   falla con ERROR 1046 "No database selected").
--
--  IMPORTANTE: haz el respaldo de la seccion 0 ANTES de aplicar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) RESPALDO PREVIO (shell, NO en este script):
--    mysqldump -u root --no-tablespaces fayxzvov_reginas order_products product_attribute \
--      > backup_reginas_precios_antes.sql
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 0.bis) SNAPSHOT para reversion sin restaurar el dump (recomendado).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS fayxzvov_reginas._bak_precios_costos;
CREATE TABLE fayxzvov_reginas._bak_precios_costos AS
SELECT
    p.id         AS product_id,
    p.price      AS old_price,
    pa.id        AS attr_id,
    pa.cost_unit AS old_cost
FROM fayxzvov_reginas.order_products p
LEFT JOIN fayxzvov_reginas.product_attribute pa
       ON pa.product_id = p.id AND pa.active = 1
WHERE p.companies_id = 4 AND p.active = 1;


-- ----------------------------------------------------------------------------
-- 1) TABLA TEMPORAL: precio de venta por nombre (MAX si hay recetas repetidas)
-- ----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_precio;
CREATE TEMPORARY TABLE tmp_precio (
    nombre_key   VARCHAR(255) NOT NULL PRIMARY KEY,
    precio_venta DOUBLE
);
INSERT INTO tmp_precio (nombre_key, precio_venta)
SELECT UPPER(TRIM(nombre)), MAX(precioVenta)
FROM rfwsmqex_gvsl_costsys.recetas
WHERE precioVenta > 0 AND TRIM(IFNULL(nombre,'')) <> ''
GROUP BY UPPER(TRIM(nombre));


-- ----------------------------------------------------------------------------
-- 2) VERIFICACION PREVIA (solo lectura)
-- ----------------------------------------------------------------------------
SELECT
    (SELECT COUNT(*)
       FROM fayxzvov_reginas.order_products p
       INNER JOIN tmp_precio tp ON tp.nombre_key = UPPER(TRIM(p.name))
       WHERE p.companies_id = 4 AND p.active = 1
         AND (p.price IS NULL OR p.price = 0)) AS price_a_actualizar,
    (SELECT COUNT(*)
       FROM fayxzvov_reginas.product_attribute pa
       INNER JOIN fayxzvov_reginas.order_products p ON p.id = pa.product_id
       INNER JOIN tmp_precio tp ON tp.nombre_key = UPPER(TRIM(p.name))
       WHERE p.companies_id = 4 AND p.active = 1 AND pa.active = 1
         AND (pa.cost_unit IS NULL OR pa.cost_unit = 0)) AS cost_a_actualizar;


-- ============================================================================
-- 3) APLICAR (transaccional) -- price y cost_unit = precio de venta
-- ============================================================================
START TRANSACTION;

UPDATE fayxzvov_reginas.order_products p
INNER JOIN tmp_precio tp ON tp.nombre_key = UPPER(TRIM(p.name))
SET p.price = tp.precio_venta
WHERE p.companies_id = 4 AND p.active = 1
  AND (p.price IS NULL OR p.price = 0);

UPDATE fayxzvov_reginas.product_attribute pa
INNER JOIN fayxzvov_reginas.order_products p ON p.id = pa.product_id
INNER JOIN tmp_precio tp ON tp.nombre_key = UPPER(TRIM(p.name))
SET pa.cost_unit = tp.precio_venta, pa.updated_at = NOW()
WHERE p.companies_id = 4 AND p.active = 1 AND pa.active = 1
  AND (pa.cost_unit IS NULL OR pa.cost_unit = 0);


-- ============================================================================
-- 4) VERIFICACION POSTERIOR (antes de confirmar)
-- ============================================================================
SELECT
    SUM(CASE WHEN price > 0 THEN 1 ELSE 0 END)                 AS price_ok,
    SUM(CASE WHEN price IS NULL OR price = 0 THEN 1 ELSE 0 END) AS price_cero
FROM fayxzvov_reginas.order_products
WHERE companies_id = 4 AND active = 1;

SELECT
    SUM(CASE WHEN pa.cost_unit > 0 THEN 1 ELSE 0 END)                 AS cost_ok,
    SUM(CASE WHEN pa.cost_unit IS NULL OR pa.cost_unit = 0 THEN 1 ELSE 0 END) AS cost_cero
FROM fayxzvov_reginas.product_attribute pa
INNER JOIN fayxzvov_reginas.order_products p ON p.id = pa.product_id
WHERE p.companies_id = 4 AND p.active = 1 AND pa.active = 1;


-- ============================================================================
-- 5) CONFIRMAR  (si los conteos son correctos)
-- ============================================================================
COMMIT;
-- Si algo se ve mal ANTES del COMMIT:  ROLLBACK;


-- ============================================================================
-- 6) REVERSION DE EMERGENCIA (si ya se hizo COMMIT) -- usa el snapshot 0.bis
-- ----------------------------------------------------------------------------
-- UPDATE fayxzvov_reginas.order_products p
-- INNER JOIN fayxzvov_reginas._bak_precios_costos b ON b.product_id = p.id
-- SET p.price = b.old_price;
--
-- UPDATE fayxzvov_reginas.product_attribute pa
-- INNER JOIN fayxzvov_reginas._bak_precios_costos b ON b.attr_id = pa.id
-- SET pa.cost_unit = b.old_cost;
--
-- DROP TABLE fayxzvov_reginas._bak_precios_costos;
-- ============================================================================
