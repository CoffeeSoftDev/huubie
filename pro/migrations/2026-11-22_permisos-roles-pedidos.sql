-- =============================================================================
-- Roles y Permisos › Roles: cinco casillas nuevas de Pedidos (y una de Ventas)
-- Fecha:     22/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback:  2026-11-22_permisos-roles-pedidos-rollback.sql
--
-- Lo que antes colgaba de 'cancel' (o de ser Dueño) pasa a tener su propia
-- columna en Configuración › Roles. Los constantes están en core-order.php.
--
--   code                   sección                    antes            se da a
--   autorizar-descuento    pos-pedidos y pos-ventas   cancel           quien tiene cancel en ESA sección
--   cambiar-forma-pago     pos-pedidos                cancel           quien tiene cancel en Pedidos
--   ver-corte-z            pos-pedidos                ser Dueño        roles.code 'owner' y 'dueno'
--   editar-corte-cerrado   pos-pedidos                cancel           quien tiene cancel en Pedidos
--   reabrir-turno          pos-pedidos                cancel           quien tiene cancel en Pedidos
--
-- Así nadie gana ni pierde nada al correrla: solo se vuelve configurable.
-- El dueño de la cuenta y root las traen siempre (Permission::actions).
--
-- Se puede volver a correr: busca por code y no duplica.
-- IMPORTANTE: correr ANTES de subir el código. Sin estos permisos el código
-- nuevo le quita al Supervisor descuentos autorizados, cambiar la forma de
-- pago, tocar cortes cerrados y reabrir/recalcular turnos; y al rol Dueño
-- (no al dueño de la cuenta) el Corte Z de un día sin cerrar.
-- =============================================================================

SET NAMES utf8mb4;

-- 1) Las acciones (si no existen). order NULL: van después de Imprimir.
INSERT INTO type_permissions (name, code, `order`, created_at, is_active)
SELECT t.name, t.code, NULL, NOW(), 1
FROM (
              SELECT 'Autorizar descuento'         AS name, 'autorizar-descuento'  AS code
    UNION ALL SELECT 'Cambiar forma de pago',               'cambiar-forma-pago'
    UNION ALL SELECT 'Ver Corte Z sin cerrar',              'ver-corte-z'
    UNION ALL SELECT 'Editar corte cerrado',                'editar-corte-cerrado'
    UNION ALL SELECT 'Reabrir o recalcular turno',          'reabrir-turno'
) t
WHERE NOT EXISTS (SELECT 1 FROM type_permissions x WHERE x.code = t.code);

-- 2) En sus secciones.
INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM sections s
INNER JOIN type_permissions tp
    ON (s.code = 'pos-pedidos' AND tp.code IN ('autorizar-descuento', 'cambiar-forma-pago', 'ver-corte-z', 'editar-corte-cerrado', 'reabrir-turno'))
    OR (s.code = 'pos-ventas'  AND tp.code = 'autorizar-descuento')
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.section_id = s.id AND p.type_permission_id = tp.id
);

-- 3) Lo que colgaba de 'cancel': a los roles que hoy tienen 'cancel' en la misma sección.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT DISTINCT pn.id, pr.role_id
FROM sections s
INNER JOIN type_permissions tc  ON tc.code = 'cancel'
INNER JOIN permissions pc       ON pc.section_id = s.id AND pc.type_permission_id = tc.id
INNER JOIN permissions_roles pr ON pr.permission_id = pc.id
INNER JOIN type_permissions tn  ON tn.code IN ('autorizar-descuento', 'cambiar-forma-pago', 'editar-corte-cerrado', 'reabrir-turno')
INNER JOIN permissions pn       ON pn.section_id = s.id AND pn.type_permission_id = tn.id
WHERE s.code IN ('pos-pedidos', 'pos-ventas')
  AND NOT EXISTS (
      SELECT 1 FROM permissions_roles x
      WHERE x.permission_id = pn.id AND x.role_id = pr.role_id
  );

-- 4) El Corte Z de un día sin cerrar: a los roles Dueño ('owner' del sistema, 'dueno' de Reginas).
INSERT INTO permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM roles r
INNER JOIN sections s          ON s.code = 'pos-pedidos'
INNER JOIN type_permissions tp ON tp.code = 'ver-corte-z'
INNER JOIN permissions p       ON p.section_id = s.id AND p.type_permission_id = tp.id
WHERE r.code IN ('owner', 'dueno')
  AND NOT EXISTS (
      SELECT 1 FROM permissions_roles x
      WHERE x.permission_id = p.id AND x.role_id = r.id
  );

-- -- Comprobacion --

SELECT s.code AS seccion, tp.code AS accion, r.id AS role_id, r.name AS rol
FROM sections s
INNER JOIN permissions p        ON p.section_id = s.id
INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr  ON pr.permission_id = p.id
LEFT JOIN roles r               ON r.id = pr.role_id
WHERE tp.code IN ('autorizar-descuento', 'cambiar-forma-pago', 'ver-corte-z', 'editar-corte-cerrado', 'reabrir-turno')
ORDER BY s.code, tp.id, r.id;
