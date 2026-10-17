-- =====================================================================
-- Color de la sidebar en los temas (themes.sidebar_color)
-- Fecha: 17/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   Un tema ya pinta la navbar (color, mode, tipo/imagen). Con esta columna
--   también pinta el rail lateral (#menu-sidebar). NULL = el rail sigue a la
--   página como hasta hoy: blanco en la clara y el oscuro de cada página
--   oscura (--dk-chrome de src/css/themes.css). Ningún tema cambia al correrla.
--   El color de los íconos del rail no se guarda: lo saca el navegador de la
--   luz del fondo (src/js/tailwind-theme.js).
--
-- CORRER ANTES de subir el código: mdl-temas.php y acceso/mdl/mdl-access.php
-- ya leen la columna; sin ella la barra se queda sin catálogo de temas.
-- Se puede volver a correr. El -rollback quita la columna.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'themes'
                 AND COLUMN_NAME  = 'sidebar_color') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.themes ADD COLUMN sidebar_color VARCHAR(20) NULL DEFAULT NULL COMMENT ''hex del rail lateral; NULL = sigue a la pagina'' AFTER secondary_color');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- VERIFICACIÓN: la columna existe y todos los temas siguen a la página.
SELECT id, code, name, color, scheme, sidebar_color
FROM fayxzvov_erp.themes
ORDER BY orden, id;
