-- =====================================================================
-- Categoría → Área (paso 1 de la reorganización categoría / área / almacén)
-- Fecha: 23/09/2026
-- BD:    fayxzvov_inventory
--
-- POR QUÉ
--   Las categorías se usaron como ubicación (ANAQUEL 1..4, REFRIGERADOR,
--   CONGELADOR) y el catálogo de Áreas quedó sin uso. Cada concepto responde
--   ahora una sola pregunta:
--     almacén   -> ¿en qué edificio y de qué sucursal?   (sin cambio)
--     área      -> ¿en qué parte del almacén?            (este script)
--     categoría -> ¿qué es?                              (paso 3, manual)
--
-- QUÉ HACE
--   1. Desactiva las áreas que nadie usa (ni producto, ni almacén) y que no
--      se llaman como una categoría: hoy Congelado / Refrigerado / Seco.
--   2. Crea un área por cada categoría activa, con el mismo nombre, salvo que
--      ya exista un área activa con ese nombre en la empresa.
--   3. A cada producto sin área le pone el área que se llama como su categoría.
--   NO cambia categorías, SKU ni stock, y NO borra columnas.
--
-- RESPALDO
--   item_attribute_area_bk_20260923 -> área de cada producto antes del cambio.
--   warehouse_area_bk_20260923      -> áreas creadas y áreas desactivadas.
--   El -rollback usa las dos y las borra.
--
-- PROD: correr este script tal cual; la regla es la misma en cualquier empresa.
-- =====================================================================


-- 0) RESPALDO -----------------------------------------------------------
CREATE TABLE fayxzvov_inventory.item_attribute_area_bk_20260923 AS
SELECT id, item_id, warehouse_area_id
FROM fayxzvov_inventory.item_attribute;

CREATE TABLE fayxzvov_inventory.warehouse_area_bk_20260923 (
    id           INT         NOT NULL PRIMARY KEY,
    accion       VARCHAR(12) NOT NULL,   -- 'creada' | 'desactivada'
    active_antes TINYINT     NULL
);


-- 1) DESACTIVAR ÁREAS SIN USO -------------------------------------------
INSERT INTO fayxzvov_inventory.warehouse_area_bk_20260923 (id, accion, active_antes)
SELECT wa.id, 'desactivada', wa.active
FROM fayxzvov_inventory.warehouse_area wa
WHERE wa.active = 1
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.item_attribute ia WHERE ia.warehouse_area_id = wa.id)
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.warehouse w      WHERE w.warehouse_area_id  = wa.id)
  AND NOT EXISTS (
        SELECT 1 FROM fayxzvov_inventory.item_category c
        WHERE c.companies_id = wa.companies_id AND c.name = wa.name AND c.active = 1
      );

UPDATE fayxzvov_inventory.warehouse_area wa
  JOIN fayxzvov_inventory.warehouse_area_bk_20260923 bk ON bk.id = wa.id AND bk.accion = 'desactivada'
   SET wa.active = 0;


-- 2) UN ÁREA POR CATEGORÍA ----------------------------------------------
SET @ultima_area := (SELECT COALESCE(MAX(id), 0) FROM fayxzvov_inventory.warehouse_area);

INSERT INTO fayxzvov_inventory.warehouse_area (name, created_at, active, companies_id)
SELECT c.name, NOW(), 1, c.companies_id
FROM fayxzvov_inventory.item_category c
WHERE c.active = 1
  AND NOT EXISTS (
        SELECT 1 FROM fayxzvov_inventory.warehouse_area wa
        WHERE wa.companies_id = c.companies_id AND wa.name = c.name AND wa.active = 1
      )
ORDER BY c.companies_id, c.id;

INSERT INTO fayxzvov_inventory.warehouse_area_bk_20260923 (id, accion, active_antes)
SELECT id, 'creada', NULL
FROM fayxzvov_inventory.warehouse_area
WHERE id > @ultima_area;


-- 3) ÁREA DE CADA PRODUCTO = SU CATEGORÍA -------------------------------
-- Un producto que ya tenía área la conserva.
UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.item i          ON i.id = ia.item_id
  JOIN fayxzvov_inventory.item_category c ON c.id = i.category_id
  JOIN (
        SELECT companies_id, name, MIN(id) AS area_id
        FROM fayxzvov_inventory.warehouse_area
        WHERE active = 1
        GROUP BY companies_id, name
       ) wa ON wa.companies_id = c.companies_id AND wa.name = c.name
   SET ia.warehouse_area_id = wa.area_id
 WHERE ia.warehouse_area_id IS NULL;


-- 4) VERIFICACIÓN -------------------------------------------------------
-- Esperado: sin_area = productos cuya categoría está inactiva o sin categoría;
-- area_distinta_a_categoria = 0.
SELECT
    COUNT(*)                                                    AS productos,
    SUM(ia.warehouse_area_id IS NOT NULL)                       AS con_area,
    SUM(ia.warehouse_area_id IS NULL)                           AS sin_area,
    SUM(wa.id IS NOT NULL AND c.id IS NOT NULL AND wa.name <> c.name) AS area_distinta_a_categoria,
    (SELECT COUNT(*) FROM fayxzvov_inventory.warehouse_area_bk_20260923 WHERE accion = 'creada')      AS areas_creadas,
    (SELECT COUNT(*) FROM fayxzvov_inventory.warehouse_area_bk_20260923 WHERE accion = 'desactivada') AS areas_desactivadas
FROM fayxzvov_inventory.item i
JOIN fayxzvov_inventory.item_attribute ia      ON ia.item_id = i.id AND ia.active = 1
LEFT JOIN fayxzvov_inventory.item_category c   ON c.id  = i.category_id
LEFT JOIN fayxzvov_inventory.warehouse_area wa ON wa.id = ia.warehouse_area_id;
