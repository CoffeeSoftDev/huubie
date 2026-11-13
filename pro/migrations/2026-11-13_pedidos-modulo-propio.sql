-- =============================================================================
-- Lo que era POS (TPV y Reportes) pasa al modulo Pedidos, el que venden los planes
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql, 2026-11-12_ruta-pos-pedidos.sql,
--            2026-11-13_catalogo-en-tpv.sql y 2026-11-13_ruta-pos-tickets.sql
-- Rollback:  2026-11-13_pedidos-modulo-propio-rollback.sql
--
-- Por que: los planes venden el modulo `pedidos` (plan_module / subscription_module),
-- pero sus pantallas colgaban de POS. Plan::allows() revisa el modulo de la seccion:
-- una empresa que compro Pedidos y no POS (Reginas) no podia entrar, y el modulo
-- Pedidos, sin ruta, salia "Proximamente" en el inicio y apagado en el rail.
--
-- Antes:  Pedidos   route NULL, sin submodulos ni secciones
--         POS       TPV       Ventas, Pedidos, Catalogo, Calendario, Clientes,
--                             Puntos, Ecommerce, WhatsApp
--                   Reportes  Dashboard, Tickets/Cierre, Historial
--                   Catalogo  vacio y apagado
-- Despues Pedidos   route app/order/pedidos.php, con esos mismos submodulos y
--                   secciones, en el mismo orden
--         POS       sin secciones: el inicio lo enseña apagado ("Proximamente")
--
-- Los codes (pos-*) NO cambian: los usan las paginas y los ctrl. Las acciones de
-- cada seccion y los permisos que ya tenian se conservan.
--
-- Permisos nuevos (los de Reginas ya estaban):
--   Dueño del sistema (code owner)   todo el modulo, como el Dueño de Reginas
--   Cajera de CoffeeSoft             lo mismo que la Cajera de Reginas
-- El plan sigue siendo la puerta: con el rol solo entra quien compro Pedidos.
--
-- Solo filas de datos: no cambia estructura. Busca por code y nombre, con valores
-- absolutos e INSERT IGNORE (uq_permissions_roles_role_permission): se puede
-- volver a correr.
-- =============================================================================

-- 1) La ruta del modulo: el inicio y el rail ya tienen a donde mandar.
UPDATE modules
SET route = 'app/order/pedidos.php'
WHERE code = 'pedidos';

-- 2) Los submodulos de POS pasan a Pedidos.
UPDATE submodules sm
INNER JOIN modules m ON m.code = 'pedidos'
SET sm.module_id = m.id
WHERE sm.code IN ('pos-tpv', 'pos-reportes', 'pos-catalogo');

-- 3) Y sus secciones con ellos.
UPDATE sections s
INNER JOIN submodules sm ON sm.id = s.submodule_id
SET s.module_id = sm.module_id
WHERE sm.code IN ('pos-tpv', 'pos-reportes', 'pos-catalogo');

-- 4) Pedidos dentro de TPV, en su lugar 2 (por si quedo suelta).
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-tpv'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = 2
WHERE s.code = 'pos-pedidos';

-- 5) Dueño del sistema: todas las acciones del modulo.
INSERT IGNORE INTO permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
INNER JOIN sections s ON s.id = p.section_id AND s.is_active = 1
INNER JOIN modules m  ON m.id = s.module_id AND m.code = 'pedidos'
INNER JOIN roles r    ON r.code = 'owner' AND r.is_system = 1
WHERE p.is_active = 1;

-- 6) Cajera de CoffeeSoft: lo mismo que la Cajera de Reginas.
INSERT IGNORE INTO permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM (
              SELECT 'pos-pedidos' AS sec, 'show' AS tp
    UNION ALL SELECT 'pos-pedidos',    'create'
    UNION ALL SELECT 'pos-pedidos',    'update'
    UNION ALL SELECT 'pos-pedidos',    'print'
    UNION ALL SELECT 'pos-ventas',     'show'
    UNION ALL SELECT 'pos-ventas',     'create'
    UNION ALL SELECT 'pos-ventas',     'print'
    UNION ALL SELECT 'pos-calendario', 'show'
    UNION ALL SELECT 'pos-clientes',   'show'
    UNION ALL SELECT 'pos-clientes',   'create'
    UNION ALL SELECT 'pos-clientes',   'update'
    UNION ALL SELECT 'pos-tickets',    'show'
    UNION ALL SELECT 'pos-tickets',    'create'
    UNION ALL SELECT 'pos-tickets',    'print'
) x
INNER JOIN sections s          ON s.code = x.sec
INNER JOIN type_permissions tp ON tp.code = x.tp
INNER JOIN permissions p       ON p.section_id = s.id AND p.type_permission_id = tp.id AND p.is_active = 1
INNER JOIN companies c         ON c.name = 'CoffeeSoft'
INNER JOIN roles r             ON r.company_id = c.id AND r.name = 'Cajera';

-- Comprobacion 1: el menu del modulo Pedidos, en orden. POS no debe salir.
SELECT m.code AS module, m.route AS module_route, sm.code AS submodule, s.orden, s.code AS section, s.route
FROM sections s
INNER JOIN modules m     ON m.id = s.module_id
LEFT JOIN submodules sm  ON sm.id = s.submodule_id
WHERE m.code IN ('pedidos', 'pos')
ORDER BY m.code, sm.orden, s.orden, s.id;

-- Comprobacion 2: quien tiene secciones del modulo Pedidos, cuantas y cuantas acciones.
SELECT r.id, r.name, COALESCE(c.name, '(sistema)') AS company,
       COUNT(DISTINCT s.id) AS sections, COUNT(*) AS actions
FROM permissions_roles pr
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id
INNER JOIN modules m     ON m.id = s.module_id AND m.code = 'pedidos'
INNER JOIN roles r       ON r.id = pr.role_id
LEFT JOIN companies c    ON c.id = r.company_id
GROUP BY r.id, r.name, c.name
ORDER BY r.id;
