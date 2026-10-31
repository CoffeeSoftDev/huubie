-- =====================================================================
-- Lo que ofrece cada modulo, para venderlo en Facturacion › Modulos
-- Fecha: 31/10/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-10-31_modulos-que-ofrece-rollback.sql
--
--   modules.features   JSON con la lista de lo que incluye el modulo (como
--                      plans.features). NULL = sin lista.
--
-- Sin esta columna Facturacion › Modulos funciona igual, solo sin la lista.
-- Se puede volver a correr.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'features') > 0, 'DO 0',
              'ALTER TABLE modules ADD COLUMN features JSON NULL DEFAULT NULL AFTER price');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
