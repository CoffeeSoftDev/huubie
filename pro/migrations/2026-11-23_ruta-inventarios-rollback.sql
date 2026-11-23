-- =============================================================================
-- Rollback de 2026-11-23_ruta-inventarios.sql
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Regresa Inventarios a «Próximamente» (route NULL).
-- =============================================================================

UPDATE modules
SET route = NULL
WHERE code = 'inventarios'
  AND route = 'app/inventarios';

-- Comprobacion: debe salir la fila con route NULL.
SELECT id, code, route, is_active FROM modules WHERE code = 'inventarios';
