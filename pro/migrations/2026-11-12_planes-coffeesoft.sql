-- =====================================================================
-- Planes de la pagina de CoffeeSoft y precios por modulo del Personalizado
-- Fecha: 12/11/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere: 2026-11-12_clasificacion-de-planes.sql
-- Rollback: 2026-11-12_planes-coffeesoft-rollback.sql
--
--   plans.description   la frase corta debajo del nombre en la pagina de precios.
--   plans.featured      1 = sale destacado como "Mas elegido".
--   cs-starter          el cliente elige 1 modulo de todos      $299 / mes
--   cs-pro              el cliente elige 2 modulos de todos     $499 / mes
--   cs-empresarial      kit: Pedidos, Produccion, Inventarios y POS   $999 / mes
--   Personalizado       ya existe; tambien se publica en CoffeeSoft.
--
-- Precios por modulo (Personalizado): cada uno queda arriba del Starter ($299),
-- asi que dos ya cuestan mas que el Pro ($499) y cuatro mas que el Empresarial.
-- Lo ya contratado no cambia: subscription_module guarda su propio precio.
--
-- Se puede volver a correr: las columnas se agregan solo si faltan y los planes
-- se buscan por code.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'description') > 0, 'DO 0',
              'ALTER TABLE plans ADD COLUMN description VARCHAR(255) NULL DEFAULT NULL AFTER name');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'featured') > 0, 'DO 0',
              'ALTER TABLE plans ADD COLUMN featured TINYINT NOT NULL DEFAULT 0 AFTER modules_pick');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Precios mensuales sin IVA de cada modulo en el Personalizado.
UPDATE modules SET price = 379.00 WHERE name = 'Pedidos' AND (code IS NULL OR code = '');
UPDATE modules SET price = 429.00 WHERE code = 'inventarios';
UPDATE modules SET price = 479.00 WHERE code = 'produccion';
UPDATE modules SET price = 529.00 WHERE code = 'pos';
UPDATE modules SET price = 329.00 WHERE code = 'lealtad';

INSERT INTO plans (code, name, description, price, price_before, currency, billing_cycle, max_users, max_branches,
                   features, modules_mode, modules_pick, featured, trial_days, is_active, created_at)
SELECT 'cs-starter', 'Starter', 'Empieza con el módulo que más necesitas.', 299.00, NULL, 'MXN', 'monthly', 2, 1,
       JSON_ARRAY('Soporte por correo y WhatsApp', 'Capacitación inicial'),
       'pick', 1, 0, NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'cs-starter');

INSERT INTO plans (code, name, description, price, price_before, currency, billing_cycle, max_users, max_branches,
                   features, modules_mode, modules_pick, featured, trial_days, is_active, created_at)
SELECT 'cs-pro', 'Pro', 'Dos módulos que trabajan juntos.', 499.00, NULL, 'MXN', 'monthly', 5, 3,
       JSON_ARRAY('Reportes personalizados', 'Capacitación avanzada', 'Soporte por correo y WhatsApp'),
       'pick', 2, 1, NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'cs-pro');

INSERT INTO plans (code, name, description, price, price_before, currency, billing_cycle, max_users, max_branches,
                   features, modules_mode, modules_pick, featured, trial_days, is_active, created_at)
SELECT 'cs-empresarial', 'Empresarial', 'El kit para operar de la venta a la producción.', 999.00, NULL, 'MXN', 'monthly', NULL, NULL,
       JSON_ARRAY('Soporte prioritario', 'Consultoría personalizada'),
       'included', NULL, 0, NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'cs-empresarial');

UPDATE plans SET description = 'Tú eliges tus módulos, sin paquetes.'
WHERE code = 'personalizado' AND description IS NULL;

-- El kit del Empresarial.
INSERT INTO plan_module (plan_id, module_id)
SELECT p.id, m.id
FROM plans p
INNER JOIN modules m ON m.name = 'Pedidos' OR m.code IN ('produccion', 'inventarios', 'pos')
WHERE p.code = 'cs-empresarial'
  AND NOT EXISTS (SELECT 1 FROM plan_module pm WHERE pm.plan_id = p.id AND pm.module_id = m.id);

-- Los tres se publican en la pagina de CoffeeSoft.
INSERT INTO classification_plan (classification_id, plan_id)
SELECT c.id, p.id
FROM plans_classification c
INNER JOIN plans p ON p.code IN ('cs-starter', 'cs-pro', 'cs-empresarial')
WHERE c.code = 'coffeesoft'
  AND NOT EXISTS (SELECT 1 FROM classification_plan cp WHERE cp.classification_id = c.id AND cp.plan_id = p.id);
