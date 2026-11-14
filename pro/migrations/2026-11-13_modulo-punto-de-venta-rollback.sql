-- =============================================================================
-- Rollback de 2026-11-13_modulo-punto-de-venta.sql
-- Fecha:  13/11/2026
-- BD:     la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Le regresa al modulo `pedidos` su nombre anterior.
-- =============================================================================

UPDATE modules
SET name = 'Pedidos'
WHERE code = 'pedidos';

-- Comprobacion: name debe salir 'Pedidos'.
SELECT id, code, name, route FROM modules WHERE code = 'pedidos';
