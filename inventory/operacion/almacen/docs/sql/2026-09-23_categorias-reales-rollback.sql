-- =====================================================================
-- ROLLBACK :: Categorías reales
-- Fecha: 23/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa la categoría de cada producto como estaba, reactiva las
-- categorías-ubicación, borra las 12 categorías creadas y los respaldos.
--
-- OJO: un producto dado de alta DESPUÉS de la migración no está en el
--   respaldo; si apunta a una categoría creada, se queda sin categoría.
--   Se puede correr dos veces sin daño.
-- =====================================================================

USE fayxzvov_inventory;

-- 1) Categoría de cada producto, como estaba
UPDATE item i
  JOIN item_category_item_bk_20260923 bk ON bk.id = i.id
   SET i.category_id = bk.category_id;

-- 2) Nadie puede seguir apuntando a una categoría que se va a borrar
UPDATE item i
  JOIN item_category_bk_20260923 bk ON bk.id = i.category_id AND bk.accion = 'creada'
   SET i.category_id = NULL;

-- 3) Reactivar las categorías-ubicación
UPDATE item_category c
  JOIN item_category_bk_20260923 bk ON bk.id = c.id AND bk.accion = 'desactivada'
   SET c.active = bk.active_antes;

-- 4) Borrar las categorías creadas
DELETE c
  FROM item_category c
  JOIN item_category_bk_20260923 bk ON bk.id = c.id AND bk.accion = 'creada';

-- 5) Borrar respaldos
DROP TABLE item_category_item_bk_20260923;
DROP TABLE item_category_bk_20260923;
