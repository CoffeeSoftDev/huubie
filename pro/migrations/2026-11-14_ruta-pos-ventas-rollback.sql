-- =============================================================================
-- Rollback de 2026-11-14_ruta-pos-ventas.sql
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Deja la seccion `pos-ventas` sin ruta, como nacio: el menu la vuelve a
-- ocultar. Las ventas ya cobradas no se tocan (viven en fayxzvov_pos).
-- =============================================================================

UPDATE sections
SET route = NULL
WHERE code = 'pos-ventas';

-- Comprobacion: la ruta debe salir en NULL.
SELECT id, code, name, route FROM sections WHERE code = 'pos-ventas';
