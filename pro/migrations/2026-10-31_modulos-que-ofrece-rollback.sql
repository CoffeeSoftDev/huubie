-- Deshace 2026-10-31_modulos-que-ofrece.sql: los modulos pierden su lista de
-- lo que ofrecen.

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'features') = 0, 'DO 0',
              'ALTER TABLE modules DROP COLUMN features');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
