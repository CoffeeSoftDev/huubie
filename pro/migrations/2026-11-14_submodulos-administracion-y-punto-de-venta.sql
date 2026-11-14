-- =============================================================================
-- El modulo «Punto de venta» se parte en dos submodulos: Administración y
-- Punto de venta (como SoftRestaurant: lo de oficina y lo de operacion)
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-13_pedidos-modulo-propio.sql y 2026-11-13_catalogo-en-tpv.sql
-- Rollback:  2026-11-14_submodulos-administracion-y-punto-de-venta-rollback.sql
--
-- Antes:  Punto de venta  TPV       Ventas, Pedidos, Catalogo, Calendario, Clientes,
--                                   Puntos, Ecommerce, WhatsApp
--                         Reportes  Dashboard, Tickets/Cierre, Historial
-- Despues Punto de venta  Administración  Catalogo 1, Dashboard 2, Historial 3
--                         Punto de venta  Ventas 1, Pedidos 2, Calendario 3,
--                                         Clientes 4, Tickets/Cierre 5, Puntos 6,
--                                         Ecommerce 7, WhatsApp 8
--         TPV y Reportes quedan vacios y se apagan (no se borran).
--
-- Un modulo que solo tiene submodulos se abre como tarjetas en el inicio
-- (Permission::submodules) y, ya dentro, el rail enseña las secciones del
-- submodulo elegido.
--
-- Solo filas de datos: no cambia estructura. Los codes de las secciones, sus
-- rutas y sus permisos no se tocan. Busca por code, con valores absolutos: se
-- puede volver a correr.
-- =============================================================================

-- 1) Los dos submodulos, dentro del modulo `pedidos` (Punto de venta).
INSERT INTO submodules (name, code, icon, description, orden, module_id, is_active, created_at)
SELECT x.name, x.code, x.icon, x.description, x.orden, m.id, 1, NOW()
FROM (
    SELECT 'Administración' AS name, 'pos-administracion' AS code, 'briefcase' AS icon,
           'Catálogos, reportes e historial de tu negocio.' AS description, 1 AS orden
    UNION ALL SELECT 'Punto de venta', 'pos-punto-de-venta', 'monitor',
           'Venta en mostrador, pedidos, calendario y caja del día.', 2
) x
INNER JOIN modules m ON m.code = 'pedidos'
WHERE NOT EXISTS (SELECT 1 FROM submodules s WHERE s.code = x.code);

-- Por si vienen de un rollback: encendidos.
UPDATE submodules SET is_active = 1 WHERE code IN ('pos-administracion', 'pos-punto-de-venta');

-- 2) Administración: lo de oficina.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-administracion'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = CASE s.code
        WHEN 'catalogo'      THEN 1
        WHEN 'pos-dashboard' THEN 2
        WHEN 'pos-historial' THEN 3
    END
WHERE s.code IN ('catalogo', 'pos-dashboard', 'pos-historial');

-- 3) Punto de venta: lo de operacion.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-punto-de-venta'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = CASE s.code
        WHEN 'pos-ventas'     THEN 1
        WHEN 'pos-pedidos'    THEN 2
        WHEN 'pos-calendario' THEN 3
        WHEN 'pos-clientes'   THEN 4
        WHEN 'pos-tickets'    THEN 5
        WHEN 'pos-puntos'     THEN 6
        WHEN 'pos-ecommerce'  THEN 7
        WHEN 'pos-whatsapp'   THEN 8
    END
WHERE s.code IN ('pos-ventas', 'pos-pedidos', 'pos-calendario', 'pos-clientes',
                 'pos-tickets', 'pos-puntos', 'pos-ecommerce', 'pos-whatsapp');

-- 4) TPV y Reportes quedan sin secciones: se apagan.
UPDATE submodules SET is_active = 0 WHERE code IN ('pos-tpv', 'pos-reportes');

-- Comprobacion: el menu del modulo, por submodulo y en orden.
SELECT sm.code AS submodule, sm.is_active, s.orden, s.code AS section, s.route
FROM submodules sm
INNER JOIN modules m  ON m.id = sm.module_id AND m.code = 'pedidos'
LEFT JOIN sections s  ON s.submodule_id = sm.id
ORDER BY sm.orden, sm.id, s.orden, s.id;
