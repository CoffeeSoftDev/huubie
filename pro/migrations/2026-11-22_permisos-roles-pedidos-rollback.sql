-- =============================================================================
-- Rollback de 2026-11-22_permisos-roles-pedidos.sql
-- BD: la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Correr DESPUÉS de regresar el código: con el código nuevo y sin estos
-- permisos, el Supervisor y el rol Dueño pierden lo que antes les daba
-- 'cancel' o ser Dueño.
--
-- Quita las cinco acciones (con sus permisos por sección y sus asignaciones).
-- =============================================================================

SET NAMES utf8mb4;

DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p       ON p.id = pr.permission_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE tp.code IN ('autorizar-descuento', 'cambiar-forma-pago', 'ver-corte-z', 'editar-corte-cerrado', 'reabrir-turno');

DELETE p
FROM permissions p
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE tp.code IN ('autorizar-descuento', 'cambiar-forma-pago', 'ver-corte-z', 'editar-corte-cerrado', 'reabrir-turno');

DELETE FROM type_permissions
WHERE code IN ('autorizar-descuento', 'cambiar-forma-pago', 'ver-corte-z', 'editar-corte-cerrado', 'reabrir-turno');

-- -- Comprobacion: sin filas --

SELECT tp.code, COUNT(p.id) AS permisos
FROM type_permissions tp
LEFT JOIN permissions p ON p.type_permission_id = tp.id
WHERE tp.code IN ('autorizar-descuento', 'cambiar-forma-pago', 'ver-corte-z', 'editar-corte-cerrado', 'reabrir-turno')
GROUP BY tp.code;
