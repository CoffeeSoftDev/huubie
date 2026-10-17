-- =====================================================================
-- ROLLBACK :: Color de la sidebar en los temas (themes.sidebar_color)
-- Fecha: 17/10/2026
-- BD:    fayxzvov_erp
--
-- OJO: tenant/mdl/mdl-temas.php y acceso/mdl/mdl-access.php leen esta
-- columna. Sin ella la barra se queda sin temas y Personalización no lista
-- nada. Si se regresa la BD hay que regresar también ese código.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'themes'
                 AND COLUMN_NAME  = 'sidebar_color') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.themes DROP COLUMN sidebar_color');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
