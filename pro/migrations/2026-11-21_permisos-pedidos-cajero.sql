-- =============================================================================
-- Pedidos TPV › Lista de pedidos: lo que se le apaga a la Cajera, como permisos
-- Fecha:     21/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback:  2026-11-21_permisos-pedidos-cajero-rollback.sql
--
-- 1) Dos acciones nuevas de la sección `pos-pedidos` (type_permissions). Salen
--    como columnas en Configuración › Roles: ahí se deciden por perfil, sin
--    tocar código.
--      ver-bitacora          tarjeta Bitácora del detalle   (core::SEE_LOG)
--      ver-capturo-produjo   renglones Capturó y Produjo    (core::SEE_STAFF)
--    Se dan a los roles que ya tienen 'cancel' en Pedidos (Dueño y Supervisor).
--    El dueño de la cuenta y root las traen siempre (Permission::actions).
--    La Cajera se queda sin ellas: no ve la bitácora ni quién capturó o produjo.
-- 2) La Cajera (roles.code = 'cashier') edita clientes: 'update' de
--    `pos-clientes` (el lápiz «Editar» en el módulo Clientes). El crédito
--    sigue siendo solo del Dueño ('delete').
--
-- Se puede volver a correr: busca por code y no duplica.
-- IMPORTANTE: correr ANTES de subir el código. Sin estos permisos el código
-- nuevo le quita también al Supervisor la bitácora y Capturó/Produjo (el
-- dueño de la cuenta y root no dependen de esto).
-- =============================================================================

SET NAMES utf8mb4;

-- 1) Las dos acciones (si no existen). order NULL: van después de Imprimir.
INSERT INTO type_permissions (name, code, `order`, created_at, is_active)
SELECT t.name, t.code, NULL, NOW(), 1
FROM (
              SELECT 'Ver bitácora'          AS name, 'ver-bitacora'        AS code
    UNION ALL SELECT 'Ver capturó y produjo',         'ver-capturo-produjo'
) t
WHERE NOT EXISTS (SELECT 1 FROM type_permissions x WHERE x.code = t.code);

-- En la sección Pedidos.
INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM sections s
INNER JOIN type_permissions tp ON tp.code IN ('ver-bitacora', 'ver-capturo-produjo')
WHERE s.code = 'pos-pedidos'
  AND NOT EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.section_id = s.id AND p.type_permission_id = tp.id
  );

-- A los roles que ya tienen 'cancel' en Pedidos (Dueño y Supervisor).
INSERT INTO permissions_roles (permission_id, role_id)
SELECT DISTINCT pn.id, pr.role_id
FROM sections s
INNER JOIN type_permissions tc  ON tc.code = 'cancel'
INNER JOIN permissions pc       ON pc.section_id = s.id AND pc.type_permission_id = tc.id
INNER JOIN permissions_roles pr ON pr.permission_id = pc.id
INNER JOIN type_permissions tn  ON tn.code IN ('ver-bitacora', 'ver-capturo-produjo')
INNER JOIN permissions pn       ON pn.section_id = s.id AND pn.type_permission_id = tn.id
WHERE s.code = 'pos-pedidos'
  AND NOT EXISTS (
      SELECT 1 FROM permissions_roles x
      WHERE x.permission_id = pn.id AND x.role_id = pr.role_id
  );

-- 2) La Cajera edita clientes.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM roles r
INNER JOIN sections s          ON s.code = 'pos-clientes'
INNER JOIN type_permissions tp ON tp.code = 'update'
INNER JOIN permissions p       ON p.section_id = s.id AND p.type_permission_id = tp.id
WHERE r.code = 'cashier'
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
WHERE (s.code = 'pos-pedidos' AND tp.code IN ('ver-bitacora', 'ver-capturo-produjo'))
   OR (s.code = 'pos-clientes' AND tp.code = 'update')
ORDER BY s.code, tp.id, r.id;
