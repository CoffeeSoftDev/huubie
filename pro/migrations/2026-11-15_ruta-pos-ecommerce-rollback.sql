-- =============================================================================
-- Rollback: Ruta de Tienda en linea (2026-11-15_ruta-pos-ecommerce.sql)
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Deja la seccion como nacio: sin ruta (el menu la oculta) y llamada «Ecommerce».
-- =============================================================================

UPDATE sections
SET route = NULL,
    name  = 'Ecommerce'
WHERE code = 'pos-ecommerce';

SELECT id, code, name, route FROM sections WHERE code = 'pos-ecommerce';
