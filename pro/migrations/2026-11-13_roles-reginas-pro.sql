-- =============================================================================
-- Roles de Reginas en PRO: Cajera, Supervisor y Produccion (decision B)
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (las secciones pos-*)
-- Rollback:  2026-11-13_roles-reginas-pro-rollback.sql
--
-- Solo filas: 3 en roles y sus acciones en permissions_roles. No toca
-- estructura ni fayxzvov_pos. No asigna usuarios: eso se hace en Accesos.
-- Se puede volver a correr: no duplica roles ni acciones.
--
-- Alcance copiado de alpha (usr_rol_permissions):
--   Cajero 2      crea y edita pedidos, cobra, maneja su turno, imprime.
--   Supervisor 6  lo de Cajera mas cancelar, historial, dashboard y corregir
--                 ventas. Decision 4: Dueno y Supervisor corrigen lo pagado.
--   Produccion 8  solo ve el calendario (la seccion aun no tiene ruta).
-- Tipos: 1 Ver, 2 Agregar, 3 Editar, 4 Cancelar, 5 Eliminar, 6 Imprimir.
-- =============================================================================

-- Antes de correr en prod: confirmar el id de Reginas en companies.
SET @company_id = (SELECT id FROM companies WHERE name = 'Reginas' LIMIT 1);

INSERT INTO roles (code, name, is_system, is_active, company_id, created_at)
SELECT n.code, n.name, 0, 1, @company_id, NOW()
FROM (
    SELECT 'cashier'    AS code, 'Cajera'     AS name UNION ALL
    SELECT 'supervisor',         'Supervisor'         UNION ALL
    SELECT 'production',         'Producción'
) n
WHERE @company_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM roles r
        WHERE r.company_id = @company_id
            AND r.name = n.name
    );

INSERT INTO permissions_roles (role_id, permission_id)
SELECT r.id, p.id
FROM (
    SELECT 'Cajera' AS role, 'pos-pedidos' AS section, 1 AS type UNION ALL
    SELECT 'Cajera', 'pos-pedidos',    2 UNION ALL
    SELECT 'Cajera', 'pos-pedidos',    3 UNION ALL
    SELECT 'Cajera', 'pos-pedidos',    6 UNION ALL
    SELECT 'Cajera', 'pos-clientes',   1 UNION ALL
    SELECT 'Cajera', 'pos-clientes',   2 UNION ALL
    SELECT 'Cajera', 'pos-clientes',   3 UNION ALL
    SELECT 'Cajera', 'pos-calendario', 1 UNION ALL
    SELECT 'Cajera', 'pos-tickets',    1 UNION ALL
    SELECT 'Cajera', 'pos-tickets',    2 UNION ALL
    SELECT 'Cajera', 'pos-tickets',    6 UNION ALL
    SELECT 'Cajera', 'pos-ventas',     1 UNION ALL
    SELECT 'Cajera', 'pos-ventas',     2 UNION ALL
    SELECT 'Cajera', 'pos-ventas',     6 UNION ALL

    SELECT 'Supervisor', 'pos-pedidos',    1 UNION ALL
    SELECT 'Supervisor', 'pos-pedidos',    2 UNION ALL
    SELECT 'Supervisor', 'pos-pedidos',    3 UNION ALL
    SELECT 'Supervisor', 'pos-pedidos',    4 UNION ALL
    SELECT 'Supervisor', 'pos-pedidos',    6 UNION ALL
    SELECT 'Supervisor', 'pos-clientes',   1 UNION ALL
    SELECT 'Supervisor', 'pos-clientes',   2 UNION ALL
    SELECT 'Supervisor', 'pos-clientes',   3 UNION ALL
    SELECT 'Supervisor', 'pos-calendario', 1 UNION ALL
    SELECT 'Supervisor', 'pos-tickets',    1 UNION ALL
    SELECT 'Supervisor', 'pos-tickets',    2 UNION ALL
    SELECT 'Supervisor', 'pos-tickets',    4 UNION ALL
    SELECT 'Supervisor', 'pos-tickets',    6 UNION ALL
    SELECT 'Supervisor', 'pos-ventas',     1 UNION ALL
    SELECT 'Supervisor', 'pos-ventas',     2 UNION ALL
    SELECT 'Supervisor', 'pos-ventas',     3 UNION ALL
    SELECT 'Supervisor', 'pos-ventas',     4 UNION ALL
    SELECT 'Supervisor', 'pos-ventas',     6 UNION ALL
    SELECT 'Supervisor', 'pos-historial',  1 UNION ALL
    SELECT 'Supervisor', 'pos-historial',  6 UNION ALL
    SELECT 'Supervisor', 'pos-dashboard',  1 UNION ALL

    SELECT 'Producción', 'pos-calendario', 1
) m
INNER JOIN roles r
    ON r.company_id = @company_id
    AND r.name = m.role
INNER JOIN sections s
    ON s.code = m.section
INNER JOIN permissions p
    ON p.section_id = s.id
    AND p.type_permission_id = m.type
WHERE NOT EXISTS (
    SELECT 1 FROM permissions_roles x
    WHERE x.role_id = r.id
        AND x.permission_id = p.id
);

-- Comprobacion: Cajera 14, Supervisor 21, Produccion 1.
SELECT r.id, r.name, COUNT(pr.id) AS acciones
FROM roles r
LEFT JOIN permissions_roles pr ON pr.role_id = r.id
WHERE r.company_id = @company_id
    AND r.code IN ('cashier', 'supervisor', 'production')
GROUP BY r.id, r.name
ORDER BY r.id;
