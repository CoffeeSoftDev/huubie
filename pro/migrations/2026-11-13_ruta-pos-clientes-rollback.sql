-- =============================================================================
-- Rollback de 2026-11-13_ruta-pos-clientes.sql
-- Fecha:  13/11/2026
-- BD:     la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Deja la seccion sin ruta, como nacio: el menu vuelve a ocultarla.
-- =============================================================================

UPDATE sections
SET route = NULL
WHERE code = 'pos-clientes';

-- Comprobacion: route debe salir NULL.
SELECT id, code, name, route FROM sections WHERE code = 'pos-clientes';
