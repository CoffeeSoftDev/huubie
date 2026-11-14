-- =============================================================================
-- Ruta de la seccion Ventas (Pedidos › Ventas) — fase V1 del plan de Ventas
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (la seccion `pos-ventas`)
-- Rollback:  2026-11-14_ruta-pos-ventas-rollback.sql
--
-- La seccion nacio SIN ruta y el menu oculta toda seccion sin ruta
-- (auth/ctrl/ctrl-nav.php). La pagina ya existe: app/order/ventas.php
-- (venta de mostrador: cobra en un paso, sin pasar por Pedidos).
-- Solo cambia una fila del menu; no toca estructura ni fayxzvov_pos.
-- Se busca por code: se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/ventas.php'
WHERE code = 'pos-ventas';

-- Comprobacion: debe salir una fila con la ruta nueva.
SELECT id, code, name, route FROM sections WHERE code = 'pos-ventas';
