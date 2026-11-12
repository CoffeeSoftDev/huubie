-- Deshace 2026-11-12_clasificacion-de-planes.sql.
--
-- Los planes 'pick' pasan a 'included' antes de quitar ese valor del ENUM; se
-- quedan sin modulos fijos (plan_module vacio) hasta que se les elijan.
-- plans_classification vuelve a como estaba (MyISAM, sin code ni fechas); solo
-- se borran las tres clasificaciones que sembro la migracion.

DROP TABLE IF EXISTS classification_plan;

UPDATE plans SET modules_mode = 'included' WHERE modules_mode = 'pick';

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'modules_pick') = 0, 'DO 0',
              'ALTER TABLE plans DROP COLUMN modules_pick');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'modules_mode'
                 AND COLUMN_TYPE LIKE '%pick%') = 0, 'DO 0',
              "ALTER TABLE plans MODIFY modules_mode ENUM('included','all','custom') NOT NULL DEFAULT 'included'");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans_classification' AND COLUMN_NAME = 'code') = 0, 'DO 0',
              "DELETE FROM plans_classification WHERE code IN ('huubie-pedidos', 'huubie-eventos', 'coffeesoft')");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans_classification' AND COLUMN_NAME = 'code') = 0, 'DO 0',
              "ALTER TABLE plans_classification
                  DROP INDEX code,
                  DROP COLUMN code,
                  DROP COLUMN created_at,
                  DROP COLUMN updated_at,
                  MODIFY id INT(11) NOT NULL,
                  MODIFY name VARCHAR(255) NULL DEFAULT NULL,
                  MODIFY active VARCHAR(255) NULL DEFAULT '1',
                  ENGINE = MyISAM");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
