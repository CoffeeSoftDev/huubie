-- =============================================================================
-- Rollback de 2026-11-13_roles-reginas-pro.sql
-- Quita los roles Cajera, Supervisor y Produccion de Reginas y sus acciones.
-- Un rol que ya tiene usuarios asignados (users_braches) NO se borra:
-- primero se les cambia el rol en Accesos.
-- =============================================================================

SET @company_id = (SELECT id FROM companies WHERE name = 'Reginas' LIMIT 1);

DELETE pr
FROM permissions_roles pr
INNER JOIN roles r ON r.id = pr.role_id
WHERE r.company_id = @company_id
    AND r.code IN ('cashier', 'supervisor', 'production')
    AND NOT EXISTS (SELECT 1 FROM users_braches u WHERE u.role_id = r.id);

DELETE r
FROM roles r
WHERE r.company_id = @company_id
    AND r.code IN ('cashier', 'supervisor', 'production')
    AND NOT EXISTS (SELECT 1 FROM users_braches u WHERE u.role_id = r.id);

-- Comprobacion: no debe salir ninguna fila (o solo las que tienen usuarios).
SELECT id, name FROM roles
WHERE company_id = @company_id
    AND code IN ('cashier', 'supervisor', 'production');
