-- ============================================================================
--  Migracion de productos: rfwsmqex_gvsl_produccion.almacen_productos
--                          -> fayxzvov_reginas (order_products + product_attribute)
-- ----------------------------------------------------------------------------
--  Decisiones acordadas:
--    1. Alcance ........ Solo productos activos (estadoProducto = 1) -> 435.
--    2. Duplicados ..... Se omiten los que ya existen por nombre (active=1)
--                        en reginas -> 19. Ademas se deduplican los nombres
--                        repetidos DENTRO del propio origen (se conserva el de
--                        menor idAlmacen) -> 15 filas extra descartadas.
--    3. Categorias ..... Se crea una categoria por Area del origen.
--                        BOCADILLOS ya existe (order_category.id = 10) y se
--                        reutiliza; se crean FRANCES, PASTELERIA, BIZCOCHO.
--                        Los productos sin Area quedan con category_id = NULL.
--
--  Resultado esperado: ~400 productos insertados.
--
--  Constantes de destino (reginas): companies_id = 4, subsidiaries_id = 4.
--  Patron de SKU (igual al existente): 'SKU-' + order_products.id
--
--  IMPORTANTE: haz respaldo antes de ejecutar (ver seccion 0).
--              El bloque corre dentro de una transaccion; revisa los conteos
--              de la seccion 5 antes de hacer COMMIT si lo ejecutas por pasos.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) RESPALDO PREVIO (recomendado) -- ejecutar en shell, no en este script:
--    mysqldump fayxzvov_reginas order_products product_attribute order_category \
--      > backup_reginas_productos_antes_migracion.sql
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 1) VERIFICACION PREVIA (opcional, solo lectura) -- cuantos entran por Area
-- ----------------------------------------------------------------------------
SELECT
    CASE WHEN o.Area IS NULL THEN '(sin area)' ELSE a.Nombre_Area END AS area_origen,
    COUNT(*) AS se_insertan
FROM rfwsmqex_gvsl_produccion.almacen_productos o
LEFT JOIN rfwsmqex_gvsl_produccion.almacen_area a ON a.idArea = o.Area
WHERE o.estadoProducto = 1
  AND TRIM(IFNULL(o.NombreProducto,'')) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_reginas.order_products r
      WHERE UPPER(TRIM(r.name)) = UPPER(TRIM(o.NombreProducto)) AND r.active = 1
  )
  AND o.idAlmacen = (
      SELECT MIN(o2.idAlmacen)
      FROM rfwsmqex_gvsl_produccion.almacen_productos o2
      WHERE o2.estadoProducto = 1
        AND UPPER(TRIM(o2.NombreProducto)) = UPPER(TRIM(o.NombreProducto))
  )
GROUP BY area_origen
ORDER BY area_origen;


-- ============================================================================
-- 2) MIGRACION (transaccional)
-- ============================================================================
START TRANSACTION;

-- 2.1) Crear las categorias de Area que aun no existan en reginas.
--      (BOCADILLOS ya existe como id 10 y NO se duplica gracias al NOT EXISTS.)
INSERT INTO fayxzvov_reginas.order_category (classification, subsidiaries_id, active, date_creation)
SELECT a.Nombre_Area, 4, '1', NOW()
FROM rfwsmqex_gvsl_produccion.almacen_area a
WHERE a.idArea IN (1, 2, 3, 4)            -- FRANCES, PASTELERIA, BOCADILLOS, BIZCOCHO
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_reginas.order_category c
      WHERE UPPER(TRIM(c.classification)) = UPPER(TRIM(a.Nombre_Area))
        AND c.subsidiaries_id = 4
  );

-- 2.2) Marca: ultimo id de productos antes de insertar (para localizar los nuevos).
SET @start_id = (SELECT IFNULL(MAX(id), 0) FROM fayxzvov_reginas.order_products);

-- 2.3) Insertar productos activos, no existentes en reginas y deduplicados por nombre.
INSERT INTO fayxzvov_reginas.order_products
    (name, price, category_id, date_creation, active, subsidiaries_id, description, image, companies_id)
SELECT
    TRIM(o.NombreProducto),
    IFNULL(o.price, 0),
    (   -- mapeo Area -> order_category.id (NULL si el producto no tiene Area)
        SELECT c.id
        FROM fayxzvov_reginas.order_category c
        JOIN rfwsmqex_gvsl_produccion.almacen_area a
             ON UPPER(TRIM(a.Nombre_Area)) = UPPER(TRIM(c.classification))
        WHERE a.idArea = o.Area AND c.subsidiaries_id = 4
        LIMIT 1
    ),
    NOW(),
    1,            -- active
    4,            -- subsidiaries_id
    NULL,         -- description
    NULL,         -- image
    4             -- companies_id
FROM rfwsmqex_gvsl_produccion.almacen_productos o
WHERE o.estadoProducto = 1
  AND TRIM(IFNULL(o.NombreProducto,'')) <> ''
  -- omitir los que ya existen por nombre en reginas
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_reginas.order_products r
      WHERE UPPER(TRIM(r.name)) = UPPER(TRIM(o.NombreProducto)) AND r.active = 1
  )
  -- deduplicar nombres repetidos dentro del origen (conservar menor idAlmacen).
  -- *** Para incluir TODAS las repeticiones del origen, elimina este AND. ***
  AND o.idAlmacen = (
      SELECT MIN(o2.idAlmacen)
      FROM rfwsmqex_gvsl_produccion.almacen_productos o2
      WHERE o2.estadoProducto = 1
        AND UPPER(TRIM(o2.NombreProducto)) = UPPER(TRIM(o.NombreProducto))
  );

-- 2.4) Crear el product_attribute (SKU + costo) de cada producto recien insertado.
--      SKU = 'SKU-' + id, igual al patron existente en reginas.
INSERT INTO fayxzvov_reginas.product_attribute
    (sku, description, cost_unit, stock_min, stock_max, created_at, updated_at, active, product_id, companies_id)
SELECT
    CONCAT('SKU-', p.id),
    NULL,
    IFNULL(p.price, 0),   -- costo unitario = precio del origen (0 si venia NULL)
    0,                    -- stock_min
    0,                    -- stock_max
    NOW(), NOW(),
    1,                    -- active
    p.id,
    4                     -- companies_id
FROM fayxzvov_reginas.order_products p
WHERE p.id > @start_id;


-- ============================================================================
-- 3) VERIFICACION POSTERIOR (antes de confirmar)
-- ============================================================================
SELECT
    (SELECT COUNT(*) FROM fayxzvov_reginas.order_products   WHERE id > @start_id) AS productos_insertados,
    (SELECT COUNT(*) FROM fayxzvov_reginas.product_attribute WHERE product_id > @start_id) AS atributos_insertados;

-- Distribucion por categoria de lo recien insertado:
SELECT IFNULL(c.classification, '(sin categoria)') AS categoria, COUNT(*) AS n
FROM fayxzvov_reginas.order_products p
LEFT JOIN fayxzvov_reginas.order_category c ON c.id = p.category_id
WHERE p.id > @start_id
GROUP BY categoria
ORDER BY n DESC;


-- ============================================================================
-- 4) CONFIRMAR  (si los conteos son correctos)
-- ============================================================================
COMMIT;
-- En caso de detectar algo mal ANTES del COMMIT:  ROLLBACK;


-- ============================================================================
-- 5) REVERSION DE EMERGENCIA (si ya se hizo COMMIT)
--    Ejecutar con el mismo @start_id capturado arriba; si ya cerraste sesion,
--    sustituye @start_id por el valor numerico que arrojo la seccion 2.2.
-- ----------------------------------------------------------------------------
-- DELETE FROM fayxzvov_reginas.product_attribute WHERE product_id > @start_id;
-- DELETE FROM fayxzvov_reginas.order_products     WHERE id > @start_id;
-- -- y, si quieres revertir tambien las categorias creadas:
-- DELETE FROM fayxzvov_reginas.order_category
-- WHERE subsidiaries_id = 4
--   AND classification IN ('FRANCES','PASTELERIA','BIZCOCHO')
--   AND id NOT IN (SELECT DISTINCT category_id FROM fayxzvov_reginas.order_products WHERE category_id IS NOT NULL);
-- ============================================================================
