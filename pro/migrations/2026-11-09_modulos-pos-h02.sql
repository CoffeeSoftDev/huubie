-- =============================================================================
-- Menu de modulos segun la historia H-02 (ADMIN · MENU)
-- Fecha:     09/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulo-catalogo.sql (la seccion `catalogo`)
-- Rollback:  2026-11-09_modulos-pos-h02-rollback.sql
--
-- Home de modulos:  POS · Inventarios · Configuracion
--   POS
--     TPV       Ventas, Pedidos, Calendario, Clientes, Puntos, Ecommerce, WhatsApp
--     Reportes  Dashboard, Tickets/Cierre, Historial
--     Catalogo  la seccion `catalogo` que ya existia (sale del modulo Catalogo)
--
-- Las secciones nuevas van SIN ruta: sus paginas no existen y el menu oculta
-- toda seccion sin ruta (auth/ctrl/ctrl-nav.php). Se les pone al construirlas.
-- El modulo Catalogo (code 'catalogo') se apaga: ya vive dentro de POS.
-- Los permisos se dan al Dueño de Reginas; los demas roles, en Accesos.
-- Todo se busca por code: se puede volver a correr.
-- =============================================================================

-- 1) Modulo Configuracion. Inventarios y POS ya existen.
INSERT INTO modules (name, code, icon, description, orden, is_active, created_at)
SELECT 'Configuración', 'configuracion', 'settings',
       'Ajustes de la empresa y sus sucursales.',
       7, 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'configuracion');

-- 2) Submodulos de POS.
INSERT INTO submodules (name, code, icon, description, orden, module_id, is_active, created_at)
SELECT x.name, x.code, x.icon, x.description, x.orden, m.id, 1, NOW()
FROM (
    SELECT 'TPV' AS name, 'pos-tpv' AS code, 'monitor' AS icon,
           'Terminal punto de venta: ventas, pedidos y clientes' AS description, 1 AS orden
    UNION ALL SELECT 'Reportes', 'pos-reportes', 'trending-up', 'Dashboard, tickets, cierres e historial', 2
    UNION ALL SELECT 'Catálogo', 'pos-catalogo', 'book-open', 'Productos, modificadores, paquetes y métodos de pago', 3
) x
INNER JOIN modules m ON m.code = 'pos'
WHERE NOT EXISTS (SELECT 1 FROM submodules s WHERE s.code = x.code);

-- 3) Secciones nuevas, sin ruta.
INSERT INTO sections (name, code, icon, route, orden, module_id, submodule_id, is_active, created_at)
SELECT x.name, x.code, x.icon, NULL, x.orden, m.id, sm.id, 1, NOW()
FROM (
    SELECT 'pos-tpv' AS sub, 'Ventas' AS name, 'pos-ventas' AS code, 'shopping-bag' AS icon, 1 AS orden
    UNION ALL SELECT 'pos-tpv',      'Pedidos',        'pos-pedidos',    'clipboard-list',   2
    UNION ALL SELECT 'pos-tpv',      'Calendario',     'pos-calendario', 'calendar-days',    3
    UNION ALL SELECT 'pos-tpv',      'Clientes',       'pos-clientes',   'users',            4
    UNION ALL SELECT 'pos-tpv',      'Puntos',         'pos-puntos',     'gift',             5
    UNION ALL SELECT 'pos-tpv',      'Ecommerce',      'pos-ecommerce',  'store',            6
    UNION ALL SELECT 'pos-tpv',      'WhatsApp',       'pos-whatsapp',   'message-circle',   7
    UNION ALL SELECT 'pos-reportes', 'Dashboard',      'pos-dashboard',  'layout-dashboard', 1
    UNION ALL SELECT 'pos-reportes', 'Tickets/Cierre', 'pos-tickets',    'receipt',          2
    UNION ALL SELECT 'pos-reportes', 'Historial',      'pos-historial',  'history',          3
) x
INNER JOIN modules m     ON m.code = 'pos'
INNER JOIN submodules sm ON sm.code = x.sub AND sm.module_id = m.id
WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.code = x.code);

-- 4) La seccion `catalogo` pasa a POS › Catalogo y el modulo Catalogo se apaga.
UPDATE sections s
INNER JOIN modules m     ON m.code = 'pos'
INNER JOIN submodules sm ON sm.code = 'pos-catalogo' AND sm.module_id = m.id
   SET s.module_id = m.id, s.submodule_id = sm.id, s.orden = 1
 WHERE s.code = 'catalogo';

UPDATE modules SET is_active = 0 WHERE code = 'catalogo';

-- 5) Acciones de cada seccion nueva (type_permissions.code).
INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM (
              SELECT 'pos-ventas' AS sec, 'show' AS tp
    UNION ALL SELECT 'pos-ventas',     'create'
    UNION ALL SELECT 'pos-ventas',     'update'
    UNION ALL SELECT 'pos-ventas',     'cancel'
    UNION ALL SELECT 'pos-ventas',     'print'
    UNION ALL SELECT 'pos-pedidos',    'show'
    UNION ALL SELECT 'pos-pedidos',    'create'
    UNION ALL SELECT 'pos-pedidos',    'update'
    UNION ALL SELECT 'pos-pedidos',    'cancel'
    UNION ALL SELECT 'pos-pedidos',    'delete'
    UNION ALL SELECT 'pos-pedidos',    'print'
    UNION ALL SELECT 'pos-calendario', 'show'
    UNION ALL SELECT 'pos-clientes',   'show'
    UNION ALL SELECT 'pos-clientes',   'create'
    UNION ALL SELECT 'pos-clientes',   'update'
    UNION ALL SELECT 'pos-clientes',   'delete'
    UNION ALL SELECT 'pos-puntos',     'show'
    UNION ALL SELECT 'pos-puntos',     'create'
    UNION ALL SELECT 'pos-puntos',     'update'
    UNION ALL SELECT 'pos-ecommerce',  'show'
    UNION ALL SELECT 'pos-ecommerce',  'update'
    UNION ALL SELECT 'pos-whatsapp',   'show'
    UNION ALL SELECT 'pos-whatsapp',   'create'
    UNION ALL SELECT 'pos-dashboard',  'show'
    UNION ALL SELECT 'pos-tickets',    'show'
    UNION ALL SELECT 'pos-tickets',    'create'
    UNION ALL SELECT 'pos-tickets',    'cancel'
    UNION ALL SELECT 'pos-tickets',    'print'
    UNION ALL SELECT 'pos-historial',  'show'
    UNION ALL SELECT 'pos-historial',  'print'
) x
INNER JOIN sections s          ON s.code = x.sec
INNER JOIN type_permissions tp ON tp.code = x.tp
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.section_id = s.id AND p.type_permission_id = tp.id
);

-- 6) Todo POS al Dueño de Reginas (incluye `catalogo`, que ya lo tenia).
INSERT INTO permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
INNER JOIN sections s  ON s.id = p.section_id
INNER JOIN modules m   ON m.id = s.module_id AND m.code = 'pos'
INNER JOIN companies c ON c.name = 'Reginas'
INNER JOIN roles r     ON r.company_id = c.id AND r.code = 'dueno' AND r.is_active = 1
WHERE NOT EXISTS (
    SELECT 1 FROM permissions_roles pr
    WHERE pr.permission_id = p.id AND pr.role_id = r.id
);
