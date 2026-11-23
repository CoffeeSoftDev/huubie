-- =============================================================================
-- Rollback de 2026-11-23_inventarios-paginas.sql
-- Las 9 secciones inv-* vuelven a la plantilla (app/inventarios/?vista=X).
-- OJO: index.php ya no manda a la plantilla; con este rollback las rutas
-- abren templates/inventarios.html solo si index.php vuelve a su version
-- anterior.
-- =============================================================================

SET NAMES utf8mb4;

UPDATE sections s
INNER JOIN (
              SELECT 'inv-stock' AS code, 'app/inventarios/?vista=stock' AS route
    UNION ALL SELECT 'inv-entradas',      'app/inventarios/?vista=entradas'
    UNION ALL SELECT 'inv-salidas',       'app/inventarios/?vista=salidas'
    UNION ALL SELECT 'inv-traspasos',     'app/inventarios/?vista=traspasos'
    UNION ALL SELECT 'inv-requisiciones', 'app/inventarios/?vista=requisiciones'
    UNION ALL SELECT 'inv-surtir',        'app/inventarios/?vista=surtir'
    UNION ALL SELECT 'inv-kardex',        'app/inventarios/?vista=movimientos'
    UNION ALL SELECT 'inv-reportes',      'app/inventarios/?vista=reportes'
    UNION ALL SELECT 'inv-catalogo',      'app/inventarios/?vista=catalogo'
) t ON t.code = s.code
SET s.route = t.route;

SELECT s.orden, s.code, s.route
FROM sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'inventarios'
ORDER BY s.orden, s.id;
