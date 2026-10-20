-- =====================================================================
-- ROLLBACK de 2026-10-20_permiso-ia.sql
-- Quita la acción 'ia': sus permisos y los de cada rol se van con ella
-- (permissions_roles cae en cascada al borrar permissions). Bajar ANTES el
-- código que la pide: sin la acción, nadie más que el Super Admin vería CoffeeIA.
-- =====================================================================

DELETE p
  FROM fayxzvov_erp.permissions p
  JOIN fayxzvov_erp.type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'ia';

DELETE FROM fayxzvov_erp.type_permissions WHERE code = 'ia';
