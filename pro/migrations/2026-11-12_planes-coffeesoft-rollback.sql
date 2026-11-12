-- Deshace 2026-11-12_planes-coffeesoft.sql.
--
-- Los tres planes de CoffeeSoft solo se borran si ninguna suscripcion los usa:
-- subscriptions tiene ON DELETE CASCADE hacia plans y se llevaria su historial.
-- Los modulos vuelven a sus precios anteriores.

DELETE FROM plans
 WHERE code IN ('cs-starter', 'cs-pro', 'cs-empresarial')
   AND id NOT IN (SELECT plan_id FROM (SELECT DISTINCT plan_id FROM subscriptions WHERE plan_id IS NOT NULL) AS used);

UPDATE modules SET price = 199.00 WHERE name = 'Pedidos' AND (code IS NULL OR code = '');
UPDATE modules SET price = 249.00 WHERE code = 'inventarios';
UPDATE modules SET price = 299.00 WHERE code = 'produccion';
UPDATE modules SET price = 349.00 WHERE code = 'pos';
UPDATE modules SET price = 149.00 WHERE code = 'lealtad';

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'featured') = 0, 'DO 0',
              'ALTER TABLE plans DROP COLUMN featured');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'description') = 0, 'DO 0',
              'ALTER TABLE plans DROP COLUMN description');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
