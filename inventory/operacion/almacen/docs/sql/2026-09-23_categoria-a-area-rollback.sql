-- =====================================================================
-- ROLLBACK :: Categoría → Área
-- Fecha: 23/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa el área de cada producto como estaba, borra las áreas que creó
-- la migración, reactiva las que desactivó y borra los dos respaldos.
--
-- OJO: un producto dado de alta DESPUÉS de la migración no está en el
--   respaldo; si apunta a un área creada, se queda sin área. El código
--   (formulario, filtros, hoja de salida) se regresa aparte, con git.
--
-- Se puede correr dos veces sin daño. El USE es obligatorio: el DELETE con
--   alias del paso 3 falla con "No database selected" sin él.
-- =====================================================================

USE fayxzvov_inventory;

-- 1) Área de cada producto, como estaba
UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.item_attribute_area_bk_20260923 bk ON bk.id = ia.id
   SET ia.warehouse_area_id = bk.warehouse_area_id;

-- 2) Nadie puede seguir apuntando a un área que se va a borrar
UPDATE fayxzvov_inventory.item_attribute ia
  JOIN fayxzvov_inventory.warehouse_area_bk_20260923 bk ON bk.id = ia.warehouse_area_id AND bk.accion = 'creada'
   SET ia.warehouse_area_id = NULL;

UPDATE fayxzvov_inventory.warehouse w
  JOIN fayxzvov_inventory.warehouse_area_bk_20260923 bk ON bk.id = w.warehouse_area_id AND bk.accion = 'creada'
   SET w.warehouse_area_id = NULL;

-- 3) Borrar las áreas creadas
DELETE wa
  FROM fayxzvov_inventory.warehouse_area wa
  JOIN fayxzvov_inventory.warehouse_area_bk_20260923 bk ON bk.id = wa.id AND bk.accion = 'creada';

-- 4) Reactivar las áreas desactivadas
UPDATE fayxzvov_inventory.warehouse_area wa
  JOIN fayxzvov_inventory.warehouse_area_bk_20260923 bk ON bk.id = wa.id AND bk.accion = 'desactivada'
   SET wa.active = bk.active_antes;

-- 5) Borrar respaldos
DROP TABLE fayxzvov_inventory.item_attribute_area_bk_20260923;
DROP TABLE fayxzvov_inventory.warehouse_area_bk_20260923;
