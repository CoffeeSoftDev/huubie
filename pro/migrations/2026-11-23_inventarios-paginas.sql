-- =============================================================================
-- Inventarios: las secciones con pagina real
-- Fecha:     23/11/2026 · rev 24/11/2026 (etapa 2: Traspasos y Kárdex)
--            rev 27/11/2026 (Catálogo de inventario)
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-23_secciones-inventarios.sql (las 9 secciones inv-*)
--            2026-11-22_crear-fayxzvov-inventarios.sql (la base del modulo)
-- Rollback:  2026-11-23_inventarios-paginas-rollback.sql
--
-- Las 9 secciones apuntaban a la plantilla (app/inventarios/?vista=X). El
-- modulo real (ctrl/mdl como Catalogo, sobre los productos del Catalogo con
-- inventario) ya trae seis paginas:
--   etapa 1  inv-stock     -> app/inventarios/stock.php
--            inv-entradas  -> app/inventarios/entradas.php
--            inv-salidas   -> app/inventarios/salidas.php
--   etapa 2  inv-traspasos -> app/inventarios/traspasos.php
--            inv-kardex    -> app/inventarios/kardex.php
--   etapa 3  inv-catalogo  -> app/inventarios/catalogo.php
-- Las otras 3 se quedan sin pagina (route NULL): el rail las pinta como
-- «Próximamente» hasta su etapa.
--
-- Orden en prod: DESPUES de subir app/inventarios/ (las 6 paginas, ctrl/,
-- mdl/, layout/, src/). Solo cambia filas del menu. Va por code: se puede
-- volver a correr.
-- =============================================================================

SET NAMES utf8mb4;

UPDATE sections SET route = 'app/inventarios/stock.php'     WHERE code = 'inv-stock';
UPDATE sections SET route = 'app/inventarios/entradas.php'  WHERE code = 'inv-entradas';
UPDATE sections SET route = 'app/inventarios/salidas.php'   WHERE code = 'inv-salidas';
UPDATE sections SET route = 'app/inventarios/traspasos.php' WHERE code = 'inv-traspasos';
UPDATE sections SET route = 'app/inventarios/kardex.php'    WHERE code = 'inv-kardex';
UPDATE sections SET route = 'app/inventarios/catalogo.php'  WHERE code = 'inv-catalogo';

UPDATE sections
SET route = NULL
WHERE code IN ('inv-requisiciones', 'inv-surtir', 'inv-reportes');

-- Comprobacion: 6 con pagina y 3 en NULL.
SELECT s.orden, s.code, s.name, s.route
FROM sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'inventarios'
ORDER BY s.orden, s.id;
