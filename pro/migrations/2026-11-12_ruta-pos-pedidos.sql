-- =============================================================================
-- Ruta de la seccion Pedidos (POS › TPV › Pedidos)
-- Fecha:     12/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (la seccion `pos-pedidos`)
-- Rollback:  2026-11-12_ruta-pos-pedidos-rollback.sql
--
-- La seccion nacio SIN ruta y el menu oculta toda seccion sin ruta
-- (auth/ctrl/ctrl-nav.php). La pagina ya existe: app/order/pedidos.php.
-- Solo cambia una fila del menu; no toca estructura ni fayxzvov_pos.
-- Se busca por code: se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/pedidos.php'
WHERE code = 'pos-pedidos';

-- Comprobacion: debe salir una fila con la ruta nueva.
SELECT id, code, name, route FROM sections WHERE code = 'pos-pedidos';
