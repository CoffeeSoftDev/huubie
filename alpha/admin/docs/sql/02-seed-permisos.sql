USE fayxzvov_alpha;

-- Rol 1 Administrador: todo, alcance total.
INSERT IGNORE INTO usr_rol_permissions (usr_rols_id, permissions_id, scope)
SELECT 1, id, 'all' FROM usr_permissions;

-- Rol 2 Cajero: opera su sucursal. Puede corregir un pedido liquidado (con contrasena).
INSERT IGNORE INTO usr_rol_permissions (usr_rols_id, permissions_id, scope)
SELECT 2, id, CASE WHEN has_scope = 1 THEN 'own' ELSE 'all' END
FROM usr_permissions
WHERE code IN ('view_order','create_order','edit_order','edit_paid_order',
               'register_payment','delete_discount','manage_shift','switch_subsidiary');

-- Rol 3 Vendedor: igual que cajero, sin el pedido liquidado.
INSERT IGNORE INTO usr_rol_permissions (usr_rols_id, permissions_id, scope)
SELECT 3, id, CASE WHEN has_scope = 1 THEN 'own' ELSE 'all' END
FROM usr_permissions
WHERE code IN ('view_order','create_order','edit_order',
               'register_payment','delete_discount','manage_shift','switch_subsidiary');

-- Rol 4 Lectura: solo consulta de su sucursal. Nadie lo tiene hoy.
INSERT IGNORE INTO usr_rol_permissions (usr_rols_id, permissions_id, scope)
SELECT 4, id, 'own' FROM usr_permissions WHERE code = 'view_order';

-- Rol 6 Supervisor: consulta y correcciones sobre cualquier sucursal, sin borrar ni cerrar.
INSERT IGNORE INTO usr_rol_permissions (usr_rols_id, permissions_id, scope)
SELECT 6, id, 'all'
FROM usr_permissions
WHERE code IN ('view_order','create_order','edit_order','delete_blocked_line',
               'edit_payment_method','edit_delivery','manage_shift','switch_subsidiary');
