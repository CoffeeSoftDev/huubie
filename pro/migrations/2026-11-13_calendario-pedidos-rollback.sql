-- =============================================================================
-- Rollback de 2026-11-13_calendario-pedidos.sql
-- Fecha:  13/11/2026
-- BD:     la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Quita la accion 'update' del calendario (y a quien se le dio) y deja la
-- seccion sin ruta, como nacio: el menu vuelve a ocultarla.
-- Las marcas de «ya se elaboro» en fayxzvov_pos.sale se quedan: son datos.
-- =============================================================================

-- 1) Quien tenia la accion 'update' del calendario.
DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p       ON p.id = pr.permission_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'update'
INNER JOIN sections s          ON s.id = p.section_id AND s.code = 'pos-calendario';

-- 2) La accion misma.
DELETE p
FROM permissions p
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'update'
INNER JOIN sections s          ON s.id = p.section_id AND s.code = 'pos-calendario';

-- 3) La seccion sin ruta.
UPDATE sections
SET route = NULL
WHERE code = 'pos-calendario';

-- Comprobacion: route NULL y solo la accion 'show'.
SELECT s.code, s.route, tp.code AS accion
FROM sections s
LEFT JOIN permissions p       ON p.section_id = s.id
LEFT JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE s.code = 'pos-calendario';
