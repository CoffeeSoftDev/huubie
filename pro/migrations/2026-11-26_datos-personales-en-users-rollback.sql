-- Deshace 2026-11-26_datos-personales-en-users.sql.
--
-- Quita de users las columnas de datos personales: lo que se haya capturado
-- en ellas se pierde. No regresa la tabla employees (se borro a proposito) y
-- las tarjetas Aniversarios e Ingresos se quedan apagadas: su codigo ya no
-- existe.

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emergency_phone') = 0, 'DO 0',
              'ALTER TABLE users DROP COLUMN emergency_phone');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emergency_name') = 0, 'DO 0',
              'ALTER TABLE users DROP COLUMN emergency_name');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'address') = 0, 'DO 0',
              'ALTER TABLE users DROP COLUMN address');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_date') = 0, 'DO 0',
              'ALTER TABLE users DROP COLUMN birth_date');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone') = 0, 'DO 0',
              'ALTER TABLE users DROP COLUMN phone');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
