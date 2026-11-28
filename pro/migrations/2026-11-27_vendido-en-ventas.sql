-- =============================================================================
-- «Historial» se llama «Vendido» y pasa de Administración al menú de Ventas,
-- justo debajo de la pantalla de cobro (como «Ventas» en Pulpos y «Consulta de
-- cuentas» en Soft Restaurant). Mientras se vende, el rail solo enseña las
-- secciones del submódulo Ventas: en Administración no se veía.
-- Fecha:     27/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-15_puntos-whatsapp-en-administracion.sql
-- Rollback:  2026-11-27_vendido-en-ventas-rollback.sql
--
-- Antes:  1 Ventas          Ventas 1, Pedidos 2, Calendario 3, Clientes 4,
--                           Tickets/Cierre 5, Tienda en línea 6
--         2 Administración  Catálogo 1, Dashboard 2, Historial 3, WhatsApp 4
-- Después 1 Ventas          Ventas 1, Vendido 2, Pedidos 3, Calendario 4,
--                           Clientes 5, Tickets/Cierre 6, Tienda en línea 7
--         2 Administración  Catálogo 1, Dashboard 2, WhatsApp 3
--
-- Solo filas de datos. Code (pos-historial), ruta (historial.php) e icono no
-- se tocan. Busca por code, con valores absolutos: se puede volver a correr.
-- Va a prod junto con el código (ctrl-historial.php).
--
-- Paso 4 (decisión del 27/11/2026: la Cajera ve lo mismo que el Dueño, solo
-- ver): quien vende (create en pos-ventas) recibe show y print de
-- pos-historial si no los tiene. En local le faltaban al rol 8 «Cajero».
-- Cancelar, cobrar y descargar siguen siendo de quien tiene cancel en
-- pos-ventas (Dueño y Supervisor): eso lo decide ctrl-historial.php.
-- =============================================================================

-- 1) Historial: nombre nuevo y al submódulo Ventas, en el lugar 2.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-punto-de-venta'
SET s.name         = 'Vendido',
    s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = 2
WHERE s.code = 'pos-historial';

-- 2) Las de Ventas bajan un lugar.
UPDATE sections SET orden = CASE code
    WHEN 'pos-pedidos'    THEN 3
    WHEN 'pos-calendario' THEN 4
    WHEN 'pos-clientes'   THEN 5
    WHEN 'pos-tickets'    THEN 6
    WHEN 'pos-ecommerce'  THEN 7
END
WHERE code IN ('pos-pedidos', 'pos-calendario', 'pos-clientes', 'pos-tickets', 'pos-ecommerce');

-- 3) WhatsApp sube un lugar en Administración (queda sin hueco).
UPDATE sections SET orden = 3 WHERE code = 'pos-whatsapp';

-- 4) Ver e imprimir Vendido para quien vende y aún no lo tiene.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT DISTINCT hp.id, vr.role_id
FROM permissions hp
JOIN sections hs          ON hs.id = hp.section_id AND hs.code = 'pos-historial'
JOIN type_permissions htp ON htp.id = hp.type_permission_id AND htp.code IN ('show', 'print')
JOIN sections vs          ON vs.code = 'pos-ventas'
JOIN permissions vp       ON vp.section_id = vs.id
JOIN type_permissions vtp ON vtp.id = vp.type_permission_id AND vtp.code = 'create'
JOIN permissions_roles vr ON vr.permission_id = vp.id
WHERE NOT EXISTS (
    SELECT 1 FROM permissions_roles x
    WHERE x.permission_id = hp.id AND x.role_id = vr.role_id
);

-- Comprobación: show/print de Vendido con los mismos roles que venden.
SELECT s.code AS section, tp.code AS action, GROUP_CONCAT(pr.role_id ORDER BY pr.role_id) AS roles
FROM permissions p
JOIN sections s          ON s.id = p.section_id
JOIN type_permissions tp ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr ON pr.permission_id = p.id
WHERE (s.code = 'pos-historial' AND tp.code IN ('show', 'print'))
   OR (s.code = 'pos-ventas' AND tp.code = 'create')
GROUP BY s.code, tp.code
ORDER BY s.code, tp.code;

-- Comprobación: el menú del módulo, por submódulo y en orden.
SELECT sm.code AS submodule, s.orden, s.code AS section, s.name, s.route
FROM submodules sm
INNER JOIN modules m ON m.id = sm.module_id AND m.code = 'pedidos'
INNER JOIN sections s ON s.submodule_id = sm.id
WHERE sm.is_active = 1
ORDER BY sm.orden, sm.id, s.orden, s.id;
