-- =====================================================================
-- ROLLBACK :: Configuración > Accesos: roles, datos de sucursal y bitácora
-- Fecha: 17/10/2026
-- BD:    fayxzvov_erp
--
-- OJO: borra la tabla audit_log ENTERA, y con ella todo el rastro de quién
-- hizo qué en Configuración. Es lo único de esta migración que no se puede
-- reconstruir. Si la bitácora ya importa, respáldala antes:
--
--     mysqldump -u root fayxzvov_erp audit_log > audit_log.sql
--
-- También quita teléfono, correo, responsable y orden de las sucursales, la
-- descripción de los roles, y la acción "Eliminar" de Configuración >
-- Accesos (a todos los roles que la tengan). Si se regresa la BD hay que
-- regresar también admin/accesos, conf/_Auditoria.php y los ctrl que la usan.
-- Se puede volver a correr.
-- =====================================================================

DROP TABLE IF EXISTS fayxzvov_erp.audit_log;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'order') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches DROP COLUMN `order`');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'manager_id') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches DROP COLUMN manager_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'email') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches DROP COLUMN email');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'phone') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches DROP COLUMN phone');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'description') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.roles DROP COLUMN description');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

DELETE pr
  FROM fayxzvov_erp.permissions_roles pr
  JOIN fayxzvov_erp.permissions p       ON p.id = pr.permission_id
  JOIN fayxzvov_erp.sections s          ON s.id = p.section_id AND s.code = 'configuracion-accesos'
  JOIN fayxzvov_erp.type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'eliminar';

DELETE p
  FROM fayxzvov_erp.permissions p
  JOIN fayxzvov_erp.sections s          ON s.id = p.section_id AND s.code = 'configuracion-accesos'
  JOIN fayxzvov_erp.type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'eliminar';
