-- =====================================================================
-- ROLLBACK :: Permisos por sección
-- Fecha: 16/10/2026
-- BD:    fayxzvov_erp
--
-- Regresa permissions a "rol x sección x tipo" con las filas del respaldo
-- permissions_bk_20261016, vacía permissions_roles y devuelve a los roles su
-- nombre de antes (Dueño -> Administrador, Almacenista -> Operador,
-- Supervisor/Auditor -> Consulta). Borra los tipos nuevos y la sección
-- Dashboard. Solicitante se borra si nadie lo tiene asignado; si alguien lo
-- tiene, solo se apaga para no dejar a ese usuario sin rol.
--
-- Todo depende de que exista el respaldo; al final se borra, así que correrlo
-- dos veces no hace nada la segunda vez. Lo que se haya editado desde el
-- tenant después de la migración (catálogo y permisos de rol) se pierde.
-- =====================================================================

SET @has_bk = (SELECT COUNT(*) FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'permissions_bk_20261016');


-- 1) Fuera los UNIQUE nuevos (las filas de antes repiten sección + tipo) --
SET @sql = IF(@has_bk = 0 OR (SELECT COUNT(*) FROM information_schema.STATISTICS
                              WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                                AND TABLE_NAME   = 'permissions'
                                AND INDEX_NAME   = 'uq_permissions_section_type') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.permissions DROP INDEX uq_permissions_section_type');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@has_bk = 0 OR (SELECT COUNT(*) FROM information_schema.STATISTICS
                              WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                                AND TABLE_NAME   = 'permissions_roles'
                                AND INDEX_NAME   = 'uq_permissions_roles_role_permission') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.permissions_roles DROP INDEX uq_permissions_roles_role_permission');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 2) Catálogo y permisos de rol fuera -------------------------------------
SET @sql = IF(@has_bk = 0, 'DO 0', 'DELETE FROM fayxzvov_erp.permissions_roles');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@has_bk = 0, 'DO 0', 'DELETE FROM fayxzvov_erp.permissions');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 3) role_id de vuelta, con su índice y su FK como estaban -----------------
SET @sql = IF(@has_bk = 0 OR (SELECT COUNT(*) FROM information_schema.COLUMNS
                              WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                                AND TABLE_NAME   = 'permissions'
                                AND COLUMN_NAME  = 'role_id') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.permissions
                   ADD COLUMN role_id INT(11) NULL DEFAULT NULL AFTER type_permission_id,
                   ADD INDEX role_id (role_id) USING BTREE,
                   ADD CONSTRAINT permissions_ibfk_5 FOREIGN KEY (role_id)
                       REFERENCES fayxzvov_erp.roles (id) ON DELETE SET NULL ON UPDATE CASCADE');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 4) Filas de antes (sin las de secciones que ya no existan) ---------------
SET @sql = IF(@has_bk = 0, 'DO 0',
              'INSERT INTO fayxzvov_erp.permissions (id, created_at, type_permission_id, role_id, section_id, is_active)
               SELECT b.id, b.created_at, b.type_permission_id, b.role_id, b.section_id, b.is_active
               FROM fayxzvov_erp.permissions_bk_20261016 b
               JOIN fayxzvov_erp.sections s ON s.id = b.section_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 5) Roles con su nombre de antes -----------------------------------------
UPDATE fayxzvov_erp.roles SET code = 'admin',    name = 'Administrador' WHERE code = 'dueno'       AND @has_bk > 0;
UPDATE fayxzvov_erp.roles SET code = 'operador', name = 'Operador'      WHERE code = 'almacenista' AND @has_bk > 0;
UPDATE fayxzvov_erp.roles SET code = 'consulta', name = 'Consulta'      WHERE code = 'supervisor'  AND @has_bk > 0;

DELETE FROM fayxzvov_erp.roles
WHERE code = 'solicitante' AND @has_bk > 0
  AND id NOT IN (SELECT role_id FROM fayxzvov_erp.users_braches WHERE role_id IS NOT NULL);

UPDATE fayxzvov_erp.roles SET is_active = 0 WHERE code = 'solicitante' AND @has_bk > 0;


-- 6) Tipos nuevos y sección Dashboard -------------------------------------
-- Ya nadie los usa: las filas de antes solo traen los tipos de siempre.
DELETE FROM fayxzvov_erp.type_permissions
WHERE name IN ('Subir comprobante', 'Agregar conteo', 'Cancelar conteo', 'Imprimir')
  AND @has_bk > 0;

DELETE FROM fayxzvov_erp.sections
WHERE code = 'dashboard'
  AND route = 'operacion/almacen/dashboard.php'
  AND @has_bk > 0;


-- 7) El respaldo ya se usó ------------------------------------------------
DROP TABLE IF EXISTS fayxzvov_erp.permissions_bk_20261016;
