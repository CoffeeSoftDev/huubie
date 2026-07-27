-- ============================================================================
-- Alta del modulo Facturador SAT en el rail de navegacion de inventory/
--
-- Base de datos: fayxzvov_erp
-- Genera: 1 modulo + 6 secciones + permisos para superadmin (role_id 1) y
--         administrador (role_id 2), tipo de permiso "Acceso" (id 1).
--
-- El sidebar (acceso/src/js/sidebar.js -> ctrl-access.php opc=menu) resuelve el
-- modulo por prefijo de ruta contra modules.route. Con route = 'operacion/facturador'
-- cualquier pagina bajo esa carpeta muestra las 6 secciones de abajo.
-- No colisiona con 'operacion/almacen' porque el match es segmento a segmento.
--
-- NO EJECUTADO. Revisar y aplicar manualmente.
-- ============================================================================

START TRANSACTION;

-- -- Modulo --------------------------------------------------------------

INSERT INTO `modules` (`name`, `code`, `icon`, `description`, `created_at`, `orden`, `route`, `is_active`)
VALUES ('Facturador', 'facturador', 'receipt-text', 'Facturador SAT: cargas del POS, tickets, generador de tickets virtuales y catalogos', NOW(), 4, 'operacion/facturador', 1);

SET @module_id = LAST_INSERT_ID();

-- -- Secciones -----------------------------------------------------------
-- La seccion "Inicio" apunta a la carpeta (con slash final) igual que la
-- seccion "Admin" de almacen, para que el hub sea alcanzable desde el rail.

INSERT INTO `sections` (`name`, `code`, `icon`, `created_at`, `orden`, `route`, `is_active`, `module_id`, `submodule_id`)
VALUES
    ('Inicio',    'fac-inicio',    'house',            NOW(), 1, 'operacion/facturador/',              1, @module_id, NULL),
    ('Resumen',   'fac-resumen',   'layout-dashboard', NOW(), 2, 'operacion/facturador/resumen.php',   1, @module_id, NULL),
    ('Cargas',    'fac-cargas',    'upload-cloud',     NOW(), 3, 'operacion/facturador/cargas.php',    1, @module_id, NULL),
    ('Tickets',   'fac-tickets',   'receipt',          NOW(), 4, 'operacion/facturador/tickets.php',   1, @module_id, NULL),
    ('Generador', 'fac-generador', 'printer',          NOW(), 5, 'operacion/facturador/generador.php', 1, @module_id, NULL),
    ('Catalogos', 'fac-catalogos', 'library',          NOW(), 6, 'operacion/facturador/catalogos.php', 1, @module_id, NULL);

-- -- Permisos ------------------------------------------------------------
-- type_permission_id = 1 (Acceso) para role_id 1 (Super Admin) y 2 (Administrador).
-- Se resuelven los section_id por `code` para no depender de ids fijos.

INSERT INTO `permissions` (`created_at`, `type_permission_id`, `role_id`, `section_id`, `is_active`)
SELECT NOW(), 1, r.role_id, s.id, 1
FROM `sections` s
CROSS JOIN (SELECT 1 AS role_id UNION ALL SELECT 2) r
WHERE s.module_id = @module_id
  AND s.code IN ('fac-inicio', 'fac-resumen', 'fac-cargas', 'fac-tickets', 'fac-generador', 'fac-catalogos');

COMMIT;

-- ============================================================================
-- Verificacion (ejecutar despues del COMMIT)
-- ============================================================================
-- SELECT m.id, m.name, m.route, m.is_active FROM modules m WHERE m.code = 'facturador';
--
-- SELECT s.id, s.orden, s.code, s.name, s.icon, s.route
-- FROM sections s JOIN modules m ON m.id = s.module_id
-- WHERE m.code = 'facturador' ORDER BY s.orden;
--
-- SELECT p.role_id, s.code, p.type_permission_id, p.is_active
-- FROM permissions p JOIN sections s ON s.id = p.section_id
-- JOIN modules m ON m.id = s.module_id
-- WHERE m.code = 'facturador' ORDER BY p.role_id, s.orden;

-- ============================================================================
-- Rollback manual
-- ============================================================================
-- DELETE p FROM permissions p
-- JOIN sections s ON s.id = p.section_id
-- JOIN modules  m ON m.id = s.module_id
-- WHERE m.code = 'facturador';
--
-- DELETE s FROM sections s JOIN modules m ON m.id = s.module_id WHERE m.code = 'facturador';
-- DELETE FROM modules WHERE code = 'facturador';
