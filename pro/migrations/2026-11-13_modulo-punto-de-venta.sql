-- =============================================================================
-- El modulo `pedidos` se llama «Punto de venta»
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-13_pedidos-modulo-propio.sql (el modulo id 2 con TPV y Reportes)
-- Rollback:  2026-11-13_modulo-punto-de-venta-rollback.sql
--
-- Solo cambia el nombre visible (tarjeta del Inicio, rail, planes). El code
-- `pedidos` no se toca: lo usan plan_module, subscription_module y permisos.
-- La seccion Pedidos (`pos-pedidos`) conserva su nombre.
-- Se busca por code: se puede volver a correr.
-- =============================================================================

UPDATE modules
SET name = 'Punto de venta'
WHERE code = 'pedidos';

-- Comprobacion: debe salir una fila con el nombre nuevo.
SELECT id, code, name, route FROM modules WHERE code = 'pedidos';
