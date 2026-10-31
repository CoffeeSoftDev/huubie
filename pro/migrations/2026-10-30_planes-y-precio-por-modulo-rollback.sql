-- Deshace 2026-10-30_planes-y-precio-por-modulo.sql.
--
-- Los cuatro planes solo se borran si ninguna suscripcion los usa: subscriptions
-- tiene ON DELETE CASCADE hacia plans y borrar el plan se llevaria las
-- suscripciones (y con ellas su historial). Los que sigan en uso se quedan;
-- pierden el precio "antes" y el modo de modulos junto con las columnas.

DROP TABLE IF EXISTS subscription_module;

DELETE FROM plans
 WHERE code IN ('starter', 'pro', 'empresarial', 'personalizado')
   AND id NOT IN (SELECT plan_id FROM (SELECT DISTINCT plan_id FROM subscriptions WHERE plan_id IS NOT NULL) AS used);

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'price') = 0, 'DO 0',
              'ALTER TABLE modules DROP COLUMN price');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'modules_mode') = 0, 'DO 0',
              'ALTER TABLE plans DROP COLUMN modules_mode');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'price_before') = 0, 'DO 0',
              'ALTER TABLE plans DROP COLUMN price_before');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
