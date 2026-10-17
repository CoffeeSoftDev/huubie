-- =====================================================================
-- ROLLBACK :: Código de cada tipo de permiso (type_permissions.code)
-- Fecha: 16/10/2026
-- BD:    fayxzvov_erp
--
-- OJO: conf/_Permissions.php identifica las acciones por este código. Sin la
-- columna, los módulos no reconocen ninguna acción y solo el Super Admin
-- puede trabajar. Si se regresa la BD hay que regresar también ese código.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'type_permissions'
                 AND INDEX_NAME   = 'uq_type_permissions_code') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.type_permissions DROP INDEX uq_type_permissions_code');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'type_permissions'
                 AND COLUMN_NAME  = 'code') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.type_permissions DROP COLUMN code');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
