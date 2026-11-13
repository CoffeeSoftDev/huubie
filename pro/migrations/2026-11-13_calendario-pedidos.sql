-- =============================================================================
-- Calendario de pedidos (Pedidos › TPV › Calendario) · Etapa 4
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-13_pedidos-modulo-propio.sql y 2026-11-13_roles-reginas-pro.sql
-- Rollback:  2026-11-13_calendario-pedidos-rollback.sql
--
-- 1) La seccion `pos-calendario` nacio sin ruta y el menu la ocultaba. La
--    pagina ya existe: app/order/calendario.php.
-- 2) Palomear «ya se elaboro» = accion 'update' de la seccion. Como en alpha,
--    solo Produccion: se da a los roles `production` que ya ven el calendario
--    (hoy, Produccion de Reginas). El resto lo ve marcado y no lo cambia.
--    root la trae siempre (Permission::actions le da todas).
-- Solo filas de menu y permisos; no toca estructura ni fayxzvov_pos.
-- Busca por code: se puede volver a correr sin duplicar.
-- =============================================================================

-- 1) Ruta de la seccion.
UPDATE sections
SET route = 'app/order/calendario.php'
WHERE code = 'pos-calendario';

-- 2) La accion 'update' en la seccion (si no existe).
INSERT INTO permissions (created_at, type_permission_id, section_id, is_active)
SELECT NOW(), tp.id, s.id, 1
FROM sections s
INNER JOIN type_permissions tp ON tp.code = 'update'
WHERE s.code = 'pos-calendario'
    AND NOT EXISTS (
        SELECT 1 FROM permissions p
        WHERE p.section_id = s.id AND p.type_permission_id = tp.id
    );

-- 3) A los roles de Produccion que ya ven el calendario.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT DISTINCT pu.id, r.id
FROM sections s
INNER JOIN type_permissions tu  ON tu.code = 'update'
INNER JOIN permissions pu       ON pu.section_id = s.id AND pu.type_permission_id = tu.id
INNER JOIN type_permissions ts  ON ts.code = 'show'
INNER JOIN permissions ps       ON ps.section_id = s.id AND ps.type_permission_id = ts.id
INNER JOIN permissions_roles pr ON pr.permission_id = ps.id
INNER JOIN roles r              ON r.id = pr.role_id AND r.code = 'production'
WHERE s.code = 'pos-calendario'
    AND NOT EXISTS (
        SELECT 1 FROM permissions_roles x
        WHERE x.permission_id = pu.id AND x.role_id = r.id
    );

-- Comprobacion: la ruta nueva y 'update' solo en roles de Produccion.
SELECT s.code, s.route, tp.code AS accion, r.id AS role_id, r.name AS rol
FROM sections s
INNER JOIN permissions p        ON p.section_id = s.id
INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr  ON pr.permission_id = p.id
LEFT JOIN roles r               ON r.id = pr.role_id
WHERE s.code = 'pos-calendario'
ORDER BY tp.id, r.id;
