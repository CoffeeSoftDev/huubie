-- =====================================================================
-- Código de cada tipo de permiso (type_permissions.code)
-- Fecha: 16/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   Los módulos revisan las acciones del rol por código y no por nombre
--   (conf/_Permissions.php): 'ver', 'agregar', 'editar', 'cancelar',
--   'eliminar', 'subir-comprobante', 'agregar-conteo', 'cancelar-conteo',
--   'imprimir'. Así el nombre se puede cambiar en el tenant (por ejemplo
--   "Cancelar" -> "Dar de baja") sin que nadie pierda el permiso. El tenant
--   le pone código a los tipos nuevos al crearlos y no lo vuelve a tocar.
--
-- CORRER DESPUÉS de 2026-10-16_permisos-por-seccion.sql (crea los tipos
-- Subir comprobante, Agregar conteo, Cancelar conteo e Imprimir).
-- Se puede volver a correr. El -rollback quita la columna.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'type_permissions'
                 AND COLUMN_NAME  = 'code') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.type_permissions ADD COLUMN code VARCHAR(40) NULL DEFAULT NULL AFTER name');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE fayxzvov_erp.type_permissions
   SET code = CASE name
                  WHEN 'Ver'               THEN 'ver'
                  WHEN 'Agregar'           THEN 'agregar'
                  WHEN 'Editar'            THEN 'editar'
                  WHEN 'Cancelar'          THEN 'cancelar'
                  WHEN 'Eliminar'          THEN 'eliminar'
                  WHEN 'Tabular'           THEN 'tabular'
                  WHEN 'Subir comprobante' THEN 'subir-comprobante'
                  WHEN 'Agregar conteo'    THEN 'agregar-conteo'
                  WHEN 'Cancelar conteo'   THEN 'cancelar-conteo'
                  WHEN 'Imprimir'          THEN 'imprimir'
              END
 WHERE code IS NULL;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'type_permissions'
                 AND INDEX_NAME   = 'uq_type_permissions_code') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.type_permissions ADD UNIQUE KEY uq_type_permissions_code (code)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- VERIFICACIÓN: ningún tipo activo sin código.
SELECT id, name, code, `order`, is_active
FROM fayxzvov_erp.type_permissions
ORDER BY `order`, id;
