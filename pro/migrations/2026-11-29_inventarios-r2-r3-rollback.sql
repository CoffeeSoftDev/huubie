-- =============================================================================
-- Rollback de 2026-11-29_inventarios-r2-r3.sql
-- Fecha:  29/11/2026
-- BD:     la del .env de pro (DB_NAME, hoy fayxzvov_app) y fayxzvov_inventarios
--
-- Quita el Dashboard (y lo que se le marcó en Roles), la casilla Editar de
-- Salidas, apaga el Kárdex y borra quién editó cada salida.
-- Correr DESPUÉS de regresar el código.
-- =============================================================================

SET NAMES utf8mb4;

-- Lo marcado en Accesos › Roles para esas casillas.
DELETE rp FROM permissions_roles rp
INNER JOIN permissions p       ON p.id = rp.permission_id
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE s.code = 'inv-dashboard' OR (s.code = 'inv-salidas' AND tp.code = 'update');

DELETE p FROM permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE s.code = 'inv-dashboard' OR (s.code = 'inv-salidas' AND tp.code = 'update');

DELETE FROM sections WHERE code = 'inv-dashboard';

UPDATE sections SET is_active = 0 WHERE code = 'inv-kardex';

ALTER TABLE fayxzvov_inventarios.inventory_outflow
  DROP COLUMN `edited_at`,
  DROP COLUMN `edited_user_id`;
