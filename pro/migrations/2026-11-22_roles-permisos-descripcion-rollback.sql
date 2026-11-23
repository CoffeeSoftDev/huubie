-- =============================================================================
-- Rollback de 2026-11-22_roles-permisos-descripcion.sql
-- BD: la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- 1) Regresa a los roles de empresa los permisos de Developer que se borraron
--    (desde rollback_20261122_developer_grants) y tira esa copia.
-- 2) Quita permissions.description (con todos los textos escritos, también
--    los que root haya escrito después en Accesos).
--
-- Se puede correr antes o después de regresar el código: el código nuevo
-- trabaja sin la columna y el viejo no la usa.
-- =============================================================================

SET NAMES utf8mb4;

-- 1) Los permisos de Developer, si la copia existe.
SET @bak := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rollback_20261122_developer_grants'
);
SET @sql := IF(@bak = 1,
    'INSERT IGNORE INTO permissions_roles (id, permission_id, role_id) SELECT b.id, b.permission_id, b.role_id FROM rollback_20261122_developer_grants b INNER JOIN permissions p ON p.id = b.permission_id INNER JOIN roles r ON r.id = b.role_id',
    'SELECT ''sin copia de Developer'' AS aviso');
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;

DROP TABLE IF EXISTS rollback_20261122_developer_grants;

-- 2) La columna, si existe.
SET @has := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'description'
);
SET @sql := IF(@has = 1,
    'ALTER TABLE permissions DROP COLUMN description',
    'SELECT ''permissions.description no existe'' AS aviso');
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;

-- -- Comprobacion: 0 --

SELECT COUNT(*) AS columna_description
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'description';
