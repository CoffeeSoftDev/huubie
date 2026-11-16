-- =============================================================================
-- Rollback: Ruta de WhatsApp (2026-11-15_ruta-pos-whatsapp.sql)
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Deja la seccion sin ruta: el menu la vuelve a ocultar.
-- =============================================================================

UPDATE sections
SET route = NULL
WHERE code = 'pos-whatsapp';

SELECT id, code, name, route FROM sections WHERE code = 'pos-whatsapp';
