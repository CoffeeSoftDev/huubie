-- =====================================================================
-- Datos personales en users: la tabla employees ya no existe
-- Fecha: 26/11/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-11-26_datos-personales-en-users-rollback.sql
--
-- employees (la ficha de Capital Humano) se borro y no se recupera. Lo
-- personal de cada quien pasa a su cuenta, con los mismos tipos que tenia:
--
--   users.phone            telefono (Mi perfil y Configurar empresa)
--   users.birth_date       fecha de nacimiento (tarjeta Cumpleaños del mes)
--   users.address          direccion
--   users.emergency_name   contacto de emergencia
--   users.emergency_phone  telefono del contacto de emergencia
--
-- Lo de trabajo (puesto, area y fecha de ingreso) no pasa. Sin fecha de
-- ingreso no hay Aniversarios laborales ni Nuevos ingresos del mes: esas dos
-- tarjetas del inicio se apagan.
--
-- Se puede volver a correr: las columnas se agregan solo si faltan.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone') > 0, 'DO 0',
              'ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL DEFAULT NULL AFTER last_name');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_date') > 0, 'DO 0',
              'ALTER TABLE users ADD COLUMN birth_date DATE NULL DEFAULT NULL AFTER phone');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'address') > 0, 'DO 0',
              'ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL DEFAULT NULL AFTER birth_date');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emergency_name') > 0, 'DO 0',
              'ALTER TABLE users ADD COLUMN emergency_name VARCHAR(120) NULL DEFAULT NULL AFTER address');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'emergency_phone') > 0, 'DO 0',
              'ALTER TABLE users ADD COLUMN emergency_phone VARCHAR(20) NULL DEFAULT NULL AFTER emergency_name');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Sus funciones ya no existen en el codigo (HomeLayout::FUNCTIONS): el inicio
-- ya no las ofrece. Se apagan para que Developer › Accesos › Inicio tampoco.
UPDATE home_widgets SET is_active = 0 WHERE fn IN ('aniversarios', 'ingresos');
