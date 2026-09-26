USE fayxzvov_alpha;

-- Rol 8 Produccion: solo consulta el calendario de pedidos, sin cotizaciones y sin
-- operar nada. Va con id fijo: el 7 lo reserva el codigo para el Supervisor
-- Restringido aunque no exista en usr_rols, y el AUTO_INCREMENT lo asignaria aqui.
INSERT INTO usr_rols (id, rols, active, superadmin) VALUES (8, 'Producción', 1, 0);

INSERT IGNORE INTO usr_rol_permissions (usr_rols_id, permissions_id, scope)
SELECT 8, id, 'all' FROM usr_permissions WHERE code = 'view_order';

-- Usuario de prueba (contrasena: admin) en Reginas guadalupe. En el servidor los
-- usuarios reales se dan de alta desde Configuracion > Usuarios con el rol Produccion.
INSERT INTO usr_users (usr_rols_id, user, `key`, enabled, subsidiaries_id, active, fullname, date_creation, owner)
VALUES (8, 'coffee@produccion.com', MD5('admin'), 1, 4, 1, 'Coffee Producción', NOW(), 0);

INSERT INTO usr_user_subsidiaries (usr_users_id, subsidiaries_id)
SELECT id, 4 FROM usr_users WHERE user = 'coffee@produccion.com';
