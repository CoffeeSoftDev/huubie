-- =============================================================================
-- Rollback de 2026-11-23_secciones-inventarios.sql
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Quita las 9 secciones inv-*, sus casillas y lo que se haya marcado en
-- Accesos › Roles para ellas. Las acciones ver-costos, aplicar-ajuste y
-- producir se borran solo si ninguna otra seccion las usa.
-- Inventarios vuelve a no tener secciones: lo ve todo el que tenga el plan.
-- =============================================================================

SET NAMES utf8mb4;

DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id
WHERE s.code IN ('inv-stock', 'inv-entradas', 'inv-salidas', 'inv-traspasos', 'inv-requisiciones', 'inv-surtir', 'inv-kardex', 'inv-reportes', 'inv-catalogo');

DELETE p
FROM permissions p
INNER JOIN sections s ON s.id = p.section_id
WHERE s.code IN ('inv-stock', 'inv-entradas', 'inv-salidas', 'inv-traspasos', 'inv-requisiciones', 'inv-surtir', 'inv-kardex', 'inv-reportes', 'inv-catalogo');

DELETE FROM sections
WHERE code IN ('inv-stock', 'inv-entradas', 'inv-salidas', 'inv-traspasos', 'inv-requisiciones', 'inv-surtir', 'inv-kardex', 'inv-reportes', 'inv-catalogo');

DELETE tp
FROM type_permissions tp
WHERE tp.code IN ('ver-costos', 'aplicar-ajuste', 'producir')
  AND NOT EXISTS (SELECT 1 FROM permissions p WHERE p.type_permission_id = tp.id);

-- Comprobacion: sin filas.
SELECT s.id, s.code FROM sections s INNER JOIN modules m ON m.id = s.module_id AND m.code = 'inventarios';
SELECT id, code FROM type_permissions WHERE code IN ('ver-costos', 'aplicar-ajuste', 'producir');
