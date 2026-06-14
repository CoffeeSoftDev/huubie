-- ============================================================
--  Datos de ejemplo · Administrador del Tenant (fayxzvov_erp)
--  Idempotente: cada INSERT usa WHERE NOT EXISTS sobre una clave
--  natural, así se puede ejecutar varias veces sin duplicar.
--  No toca los registros preexistentes (empresa "Reginas",
--  rol "superadmin").
-- ============================================================
USE fayxzvov_erp;

/* ---------------------- Planes ---------------------- */
INSERT INTO plans (code, name, price, currency, billing_cycle, max_users, max_branches, features, trial_days, is_active, created_at)
SELECT 'starter','Plan Starter',299.00,'MXN','monthly',5,1,'["inventario"]',14,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code='starter');

INSERT INTO plans (code, name, price, currency, billing_cycle, max_users, max_branches, features, trial_days, is_active, created_at)
SELECT 'pro','Plan Pro',699.00,'MXN','monthly',20,5,'["inventario","ventas"]',14,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code='pro');

INSERT INTO plans (code, name, price, currency, billing_cycle, max_users, max_branches, features, trial_days, is_active, created_at)
SELECT 'business','Plan Business',1499.00,'MXN','monthly',100,20,'["inventario","ventas","finanzas"]',30,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code='business');

INSERT INTO plans (code, name, price, currency, billing_cycle, max_users, max_branches, features, trial_days, is_active, created_at)
SELECT 'enterprise','Plan Enterprise',24990.00,'MXN','yearly',NULL,NULL,'["todo"]',0,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code='enterprise');

/* ---------------------- Empresas ---------------------- */
INSERT INTO companies (name, database_name, ubication, rfc, status, created_at)
SELECT 'Café Aroma','fayxzvov_aroma','CDMX','CAR240101AB1','active',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name='Café Aroma');

INSERT INTO companies (name, database_name, ubication, rfc, status, created_at)
SELECT 'Pan & Co','fayxzvov_panco','Guadalajara','PCO230615XY2','active',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name='Pan & Co');

INSERT INTO companies (name, database_name, ubication, rfc, status, created_at)
SELECT 'La Terraza',NULL,'Monterrey',NULL,'pending',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name='La Terraza');

INSERT INTO companies (name, database_name, ubication, rfc, status, created_at)
SELECT 'Bistró Luna',NULL,'Puebla',NULL,'suspendend',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name='Bistró Luna');

/* ---------------------- Suscripciones ---------------------- */
INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT (SELECT id FROM companies WHERE name='Reginas' ORDER BY id LIMIT 1),
       (SELECT id FROM plans WHERE code='business' LIMIT 1),
       'active','2026-01-01','2027-01-01','2026-07-01','sub-reginas-001',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE external_reference='sub-reginas-001');

INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT (SELECT id FROM companies WHERE name='Café Aroma' ORDER BY id LIMIT 1),
       (SELECT id FROM plans WHERE code='pro' LIMIT 1),
       'active','2026-02-01','2026-08-01','2026-07-01','sub-aroma-001',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE external_reference='sub-aroma-001');

INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT (SELECT id FROM companies WHERE name='Pan & Co' ORDER BY id LIMIT 1),
       (SELECT id FROM plans WHERE code='starter' LIMIT 1),
       'trial','2026-06-01','2026-06-15',NULL,'sub-panco-001',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE external_reference='sub-panco-001');

INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT (SELECT id FROM companies WHERE name='La Terraza' ORDER BY id LIMIT 1),
       (SELECT id FROM plans WHERE code='starter' LIMIT 1),
       'trial','2026-06-05','2026-06-19',NULL,'sub-terraza-001',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE external_reference='sub-terraza-001');

/* ---------------------- Historial de pagos ---------------------- */
INSERT INTO payment_history (company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url, created_at)
SELECT (SELECT id FROM companies WHERE name='Reginas' ORDER BY id LIMIT 1),
       (SELECT id FROM subscriptions WHERE external_reference='sub-reginas-001' LIMIT 1),
       1499.00,'MXN','paid','stripe',1001,'2026-06-01','https://example.com/inv/1001.pdf',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM payment_history WHERE transaction_id=1001);

INSERT INTO payment_history (company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url, created_at)
SELECT (SELECT id FROM companies WHERE name='Café Aroma' ORDER BY id LIMIT 1),
       (SELECT id FROM subscriptions WHERE external_reference='sub-aroma-001' LIMIT 1),
       699.00,'MXN','paid','mercadopago',1002,'2026-06-02','https://example.com/inv/1002.pdf',NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM payment_history WHERE transaction_id=1002);

INSERT INTO payment_history (company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url, created_at)
SELECT (SELECT id FROM companies WHERE name='Pan & Co' ORDER BY id LIMIT 1),
       (SELECT id FROM subscriptions WHERE external_reference='sub-panco-001' LIMIT 1),
       299.00,'MXN','pending','stripe',1003,NULL,NULL,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM payment_history WHERE transaction_id=1003);

INSERT INTO payment_history (company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url, created_at)
SELECT (SELECT id FROM companies WHERE name='Reginas' ORDER BY id LIMIT 1),
       (SELECT id FROM subscriptions WHERE external_reference='sub-reginas-001' LIMIT 1),
       1499.00,'MXN','failed','stripe',1004,NULL,NULL,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM payment_history WHERE transaction_id=1004);

/* ---------------------- Cupones ---------------------- */
INSERT INTO coupons (code, description, discount_type, discount_value, max_redemptions, times_redeemed, valid_from, valid_to, is_active, created_at)
SELECT 'WELCOME20','Bienvenida 20% de descuento','percent',20,100,0,'2026-01-01','2026-12-31',1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE code='WELCOME20');

INSERT INTO coupons (code, description, discount_type, discount_value, max_redemptions, times_redeemed, valid_from, valid_to, is_active, created_at)
SELECT 'BLACKFRIDAY','Black Friday 50%','percent',50,500,0,'2026-11-01','2026-11-30',1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE code='BLACKFRIDAY');

INSERT INTO coupons (code, description, discount_type, discount_value, max_redemptions, times_redeemed, valid_from, valid_to, is_active, created_at)
SELECT 'FLAT100','Descuento fijo de $100','fixed',100,50,0,'2026-01-01','2026-12-31',1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM coupons WHERE code='FLAT100');

/* ---------------------- Canjes de cupón ---------------------- */
INSERT INTO coupon_redemptions (coupon_id, company_id, subscription_id, redeemed_at)
SELECT (SELECT id FROM coupons WHERE code='WELCOME20' LIMIT 1),
       (SELECT id FROM companies WHERE name='Café Aroma' ORDER BY id LIMIT 1),
       (SELECT id FROM subscriptions WHERE external_reference='sub-aroma-001' LIMIT 1),
       '2026-02-01 10:30:00'
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM coupon_redemptions
    WHERE coupon_id=(SELECT id FROM coupons WHERE code='WELCOME20' LIMIT 1)
      AND company_id=(SELECT id FROM companies WHERE name='Café Aroma' ORDER BY id LIMIT 1)
);

INSERT INTO coupon_redemptions (coupon_id, company_id, subscription_id, redeemed_at)
SELECT (SELECT id FROM coupons WHERE code='WELCOME20' LIMIT 1),
       (SELECT id FROM companies WHERE name='Pan & Co' ORDER BY id LIMIT 1),
       (SELECT id FROM subscriptions WHERE external_reference='sub-panco-001' LIMIT 1),
       '2026-03-01 09:15:00'
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM coupon_redemptions
    WHERE coupon_id=(SELECT id FROM coupons WHERE code='WELCOME20' LIMIT 1)
      AND company_id=(SELECT id FROM companies WHERE name='Pan & Co' ORDER BY id LIMIT 1)
);

-- Sincroniza el contador de canjes del cupón con los registros reales.
UPDATE coupons SET times_redeemed = (
    SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = coupons.id
) WHERE code IN ('WELCOME20','BLACKFRIDAY','FLAT100');

/* ---------------------- Tipos de permiso ---------------------- */
INSERT INTO type_permissions (name, is_active, created_at)
SELECT 'Ver',1,NOW()     FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM type_permissions WHERE name='Ver');
INSERT INTO type_permissions (name, is_active, created_at)
SELECT 'Crear',1,NOW()   FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM type_permissions WHERE name='Crear');
INSERT INTO type_permissions (name, is_active, created_at)
SELECT 'Editar',1,NOW()  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM type_permissions WHERE name='Editar');
INSERT INTO type_permissions (name, is_active, created_at)
SELECT 'Eliminar',1,NOW() FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM type_permissions WHERE name='Eliminar');

/* ---------------------- Módulos ---------------------- */
INSERT INTO modules (name, code, route, orden, is_active, created_at)
SELECT 'Inventario','inventario','/inventory/operacion/almacen/',1,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code='inventario');
INSERT INTO modules (name, code, route, orden, is_active, created_at)
SELECT 'Ventas','ventas','/dev/pedidos/',2,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code='ventas');
INSERT INTO modules (name, code, route, orden, is_active, created_at)
SELECT 'Finanzas','finanzas','#',3,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code='finanzas');
INSERT INTO modules (name, code, route, orden, is_active, created_at)
SELECT 'Configuración','configuracion','/inventory/tenant/',4,1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code='configuracion');

/* ---------------------- Submódulos ---------------------- */
INSERT INTO submodules (name, code, route, orden, module_id, is_active, created_at)
SELECT 'Almacén','almacen','/inventory/operacion/almacen/',1,(SELECT id FROM modules WHERE code='inventario' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM submodules WHERE code='almacen');
INSERT INTO submodules (name, code, route, orden, module_id, is_active, created_at)
SELECT 'Compras','compras','#',2,(SELECT id FROM modules WHERE code='inventario' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM submodules WHERE code='compras');
INSERT INTO submodules (name, code, route, orden, module_id, is_active, created_at)
SELECT 'Punto de Venta','pos','/dev/pedidos/',1,(SELECT id FROM modules WHERE code='ventas' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM submodules WHERE code='pos');
INSERT INTO submodules (name, code, route, orden, module_id, is_active, created_at)
SELECT 'Cuentas por Cobrar','cxc','#',1,(SELECT id FROM modules WHERE code='finanzas' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM submodules WHERE code='cxc');

/* ---------------------- Secciones ---------------------- */
INSERT INTO sections (name, code, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Entradas','entradas','/inventory/operacion/almacen/entradas.php',1,
       (SELECT id FROM modules WHERE code='inventario' LIMIT 1),
       (SELECT id FROM submodules WHERE code='almacen' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sections WHERE code='entradas');
INSERT INTO sections (name, code, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Salidas','salidas','/inventory/operacion/almacen/salidas.php',2,
       (SELECT id FROM modules WHERE code='inventario' LIMIT 1),
       (SELECT id FROM submodules WHERE code='almacen' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sections WHERE code='salidas');
INSERT INTO sections (name, code, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Stock','stock','/inventory/operacion/almacen/stock.php',3,
       (SELECT id FROM modules WHERE code='inventario' LIMIT 1),
       (SELECT id FROM submodules WHERE code='almacen' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sections WHERE code='stock');
INSERT INTO sections (name, code, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Órdenes','ordenes','/inventory/operacion/almacen/ordenes.php',1,
       (SELECT id FROM modules WHERE code='inventario' LIMIT 1),
       (SELECT id FROM submodules WHERE code='compras' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sections WHERE code='ordenes');
INSERT INTO sections (name, code, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Pedidos','pedidos','/dev/pedidos/',1,
       (SELECT id FROM modules WHERE code='ventas' LIMIT 1),
       (SELECT id FROM submodules WHERE code='pos' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM sections WHERE code='pedidos');

/* ---------------------- Roles ---------------------- */
INSERT INTO roles (code, name, is_system, is_active, created_at)
SELECT 'admin','Administrador',0,1,NOW() FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code='admin');
INSERT INTO roles (code, name, is_system, is_active, created_at)
SELECT 'operador','Operador',0,1,NOW()   FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code='operador');
INSERT INTO roles (code, name, is_system, is_active, created_at)
SELECT 'consulta','Consulta',0,1,NOW()   FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM roles WHERE code='consulta');

/* ---------------------- Permisos (rol × sección × tipo) ---------------------- */
INSERT INTO permissions (role_id, section_id, type_permission_id, is_active, created_at)
SELECT (SELECT id FROM roles WHERE code='admin' LIMIT 1),
       (SELECT id FROM sections WHERE code='entradas' LIMIT 1),
       (SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM permissions
    WHERE role_id=(SELECT id FROM roles WHERE code='admin' LIMIT 1)
      AND section_id=(SELECT id FROM sections WHERE code='entradas' LIMIT 1)
      AND type_permission_id=(SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1));

INSERT INTO permissions (role_id, section_id, type_permission_id, is_active, created_at)
SELECT (SELECT id FROM roles WHERE code='admin' LIMIT 1),
       (SELECT id FROM sections WHERE code='entradas' LIMIT 1),
       (SELECT id FROM type_permissions WHERE name='Crear' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM permissions
    WHERE role_id=(SELECT id FROM roles WHERE code='admin' LIMIT 1)
      AND section_id=(SELECT id FROM sections WHERE code='entradas' LIMIT 1)
      AND type_permission_id=(SELECT id FROM type_permissions WHERE name='Crear' LIMIT 1));

INSERT INTO permissions (role_id, section_id, type_permission_id, is_active, created_at)
SELECT (SELECT id FROM roles WHERE code='admin' LIMIT 1),
       (SELECT id FROM sections WHERE code='entradas' LIMIT 1),
       (SELECT id FROM type_permissions WHERE name='Editar' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM permissions
    WHERE role_id=(SELECT id FROM roles WHERE code='admin' LIMIT 1)
      AND section_id=(SELECT id FROM sections WHERE code='entradas' LIMIT 1)
      AND type_permission_id=(SELECT id FROM type_permissions WHERE name='Editar' LIMIT 1));

INSERT INTO permissions (role_id, section_id, type_permission_id, is_active, created_at)
SELECT (SELECT id FROM roles WHERE code='operador' LIMIT 1),
       (SELECT id FROM sections WHERE code='entradas' LIMIT 1),
       (SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM permissions
    WHERE role_id=(SELECT id FROM roles WHERE code='operador' LIMIT 1)
      AND section_id=(SELECT id FROM sections WHERE code='entradas' LIMIT 1)
      AND type_permission_id=(SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1));

INSERT INTO permissions (role_id, section_id, type_permission_id, is_active, created_at)
SELECT (SELECT id FROM roles WHERE code='operador' LIMIT 1),
       (SELECT id FROM sections WHERE code='salidas' LIMIT 1),
       (SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM permissions
    WHERE role_id=(SELECT id FROM roles WHERE code='operador' LIMIT 1)
      AND section_id=(SELECT id FROM sections WHERE code='salidas' LIMIT 1)
      AND type_permission_id=(SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1));

INSERT INTO permissions (role_id, section_id, type_permission_id, is_active, created_at)
SELECT (SELECT id FROM roles WHERE code='consulta' LIMIT 1),
       (SELECT id FROM sections WHERE code='stock' LIMIT 1),
       (SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1),1,NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM permissions
    WHERE role_id=(SELECT id FROM roles WHERE code='consulta' LIMIT 1)
      AND section_id=(SELECT id FROM sections WHERE code='stock' LIMIT 1)
      AND type_permission_id=(SELECT id FROM type_permissions WHERE name='Ver' LIMIT 1));
