-- =============================================================================
-- Rollback de 2026-11-14_ruta-pos-puntos.sql
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Deja la seccion sin ruta: el menu la oculta. Las tarjetas, los tipos y los
-- puntos ya abonados no se tocan (viven en fayxzvov_pos).
-- =============================================================================

UPDATE sections
SET route = NULL
WHERE code = 'pos-puntos';

-- Comprobacion: sin ruta.
SELECT id, code, name, route FROM sections WHERE code = 'pos-puntos';
