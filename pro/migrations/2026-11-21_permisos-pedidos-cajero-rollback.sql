-- =============================================================================
-- Rollback de 2026-11-21_permisos-pedidos-cajero.sql
-- BD: la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Correr DESPUÉS de regresar el código: con el código nuevo y sin estos
-- permisos, el Supervisor pierde la bitácora y Capturó/Produjo.
--
-- Quita las dos acciones de Pedidos (con sus asignaciones) y el 'update' de
-- `pos-clientes` a la Cajera (roles.code = 'cashier'), que antes no lo tenía.
-- =============================================================================

SET NAMES utf8mb4;

DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p       ON p.id = pr.permission_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE tp.code IN ('ver-bitacora', 'ver-capturo-produjo');

DELETE p
FROM permissions p
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE tp.code IN ('ver-bitacora', 'ver-capturo-produjo');

DELETE FROM type_permissions
WHERE code IN ('ver-bitacora', 'ver-capturo-produjo');

DELETE pr
FROM permissions_roles pr
INNER JOIN roles r             ON r.id = pr.role_id AND r.code = 'cashier'
INNER JOIN permissions p       ON p.id = pr.permission_id
INNER JOIN sections s          ON s.id = p.section_id AND s.code = 'pos-clientes'
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'update';

-- -- Comprobacion: sin filas --

SELECT tp.code, COUNT(p.id) AS permisos
FROM type_permissions tp
LEFT JOIN permissions p ON p.type_permission_id = tp.id
WHERE tp.code IN ('ver-bitacora', 'ver-capturo-produjo')
GROUP BY tp.code;
