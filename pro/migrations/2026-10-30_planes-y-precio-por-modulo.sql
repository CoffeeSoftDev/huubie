-- =====================================================================
-- Planes de venta: precio "antes", que modulos trae cada plan y el plan
-- Personalizado, que se cobra por modulo
-- Fecha: 30/10/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-10-30_planes-y-precio-por-modulo-rollback.sql
--
--   plans.price_before    precio anterior, el que se muestra tachado ("antes $1,200").
--   plans.modules_mode    que modulos trae el plan:
--                           included  los de plan_module, a precio fijo
--                           all       todos los que se venden, tambien los que se creen despues
--                           custom    la empresa los elige y paga la suma de sus precios
--   modules.price         precio mensual del modulo en el plan Personalizado.
--   subscription_module   los modulos que eligio una suscripcion Personalizada, con
--                         el precio con el que se contrataron: si despues cambia
--                         modules.price, lo ya contratado no se mueve.
--
-- Todos los precios son mensuales y sin IVA. Developer no se vende: no entra en
-- "todos los modulos" ni en los que se pueden elegir.
--
-- El servidor crea las tablas en MyISAM por defecto (my.ini): la nueva va con
-- ENGINE=InnoDB explicito o sus llaves foraneas no existirian.
--
-- Se puede volver a correr: las columnas se agregan solo si faltan y los planes
-- se buscan por code.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'price_before') > 0, 'DO 0',
              'ALTER TABLE plans ADD COLUMN price_before DECIMAL(10,2) NULL DEFAULT NULL AFTER price');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plans' AND COLUMN_NAME = 'modules_mode') > 0, 'DO 0',
              "ALTER TABLE plans ADD COLUMN modules_mode ENUM('included','all','custom') NOT NULL DEFAULT 'included' AFTER features");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'price') > 0, 'DO 0',
              'ALTER TABLE modules ADD COLUMN price DECIMAL(10,2) NULL DEFAULT NULL AFTER description');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS subscription_module (
    id              INT(11) NOT NULL AUTO_INCREMENT,
    subscription_id INT(11) NOT NULL,
    module_id       INT(11) NOT NULL,
    price           DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at      DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY subscription_module_unique (subscription_id, module_id),
    KEY module_id (module_id),
    CONSTRAINT subscription_module_ibfk_1 FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT subscription_module_ibfk_2 FOREIGN KEY (module_id) REFERENCES modules (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pedidos en el plan Personalizado. Se busca por nombre: no tiene code.
UPDATE modules SET price = 199.00 WHERE name = 'Pedidos';

-- Los cuatro planes. Sucursales: Starter 1, Pro 3, Empresarial y Personalizado
-- sin tope (NULL). Personalizado no tiene precio fijo: sale de sus modulos.
INSERT INTO plans (code, name, price, price_before, currency, billing_cycle, max_users, max_branches, features, modules_mode, trial_days, is_active, created_at)
SELECT 'starter', 'Starter', 299.00, 1200.00, 'MXN', 'monthly', 2, 1,
       JSON_ARRAY('Sistema de pedidos o eventos', 'Soporte por correo y WhatsApp', 'Hasta 2 usuarios',
                  'Actualizaciones mensuales', 'Acceso a la comunidad de usuarios', 'Capacitación inicial',
                  'Integración con redes sociales', 'Asesoría en marketing digital', 'Informes básicos de rendimiento'),
       'included', NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'starter');

INSERT INTO plans (code, name, price, price_before, currency, billing_cycle, max_users, max_branches, features, modules_mode, trial_days, is_active, created_at)
SELECT 'pro', 'Pro', 499.00, 1200.00, 'MXN', 'monthly', 5, 3,
       JSON_ARRAY('Sistema de pedidos y eventos', 'Soporte por correo y WhatsApp', 'Hasta 5 usuarios',
                  'Automatización de procesos', 'Reportes personalizados', 'Capacitación avanzada',
                  'Integración con herramientas externas', 'Asesoría estratégica continua'),
       'included', NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'pro');

INSERT INTO plans (code, name, price, price_before, currency, billing_cycle, max_users, max_branches, features, modules_mode, trial_days, is_active, created_at)
SELECT 'empresarial', 'Empresarial', 999.00, 2500.00, 'MXN', 'monthly', NULL, NULL,
       JSON_ARRAY('Todos los módulos', 'Soporte prioritario', 'Usuarios ilimitados', 'Infraestructura dedicada',
                  'Consultoría personalizada', 'Integración con ERP/CRM', 'Informes avanzados', 'Atención exclusiva 24/7'),
       'all', NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'empresarial');

INSERT INTO plans (code, name, price, price_before, currency, billing_cycle, max_users, max_branches, features, modules_mode, trial_days, is_active, created_at)
SELECT 'personalizado', 'Personalizado', NULL, NULL, 'MXN', 'monthly', NULL, NULL,
       JSON_ARRAY('Tú escoges tus módulos', 'Se cobra de acuerdo al precio de cada módulo'),
       'custom', NULL, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'personalizado');

-- Starter y Pro traen Pedidos. Eventos se agrega a los dos cuando exista el modulo.
INSERT INTO plan_module (plan_id, module_id)
SELECT p.id, m.id
FROM plans p
INNER JOIN modules m ON m.name = 'Pedidos'
WHERE p.code IN ('starter', 'pro')
  AND NOT EXISTS (SELECT 1 FROM plan_module pm WHERE pm.plan_id = p.id AND pm.module_id = m.id);
