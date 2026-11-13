-- =============================================================================
-- Reversa de 2026-11-12_ruta-pos-pedidos.sql
-- Fecha:     12/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- La seccion vuelve a quedarse sin ruta y el menu la oculta otra vez.
-- =============================================================================

UPDATE sections
SET route = NULL
WHERE code = 'pos-pedidos';

SELECT id, code, name, route FROM sections WHERE code = 'pos-pedidos';
