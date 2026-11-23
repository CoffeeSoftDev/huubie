-- =============================================================================
-- Pedidos se parte en dos paginas: la lista y la captura
-- Fecha:     20/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-13_pedidos-modulo-propio.sql (modulo `pedidos` con su ruta)
-- Rollback:  2026-11-20_ruta-lista-pedidos-rollback.sql
--
-- La lista de pedidos paso de app/order/pedidos.php a app/order/lista-pedidos.php
-- y la captura (TPV) vive en app/order/pedido.php. El menu marca la seccion y
-- arma el rail por estas rutas (auth/ctrl/ctrl-nav.php y auth/src/js/sidebar.js):
-- sin el cambio, la lista sale sin «Pedidos» marcado y la captura con el rail
-- del inicio.
--
-- Orden en prod: ANTES de subir el codigo. pedidos.php se queda como redireccion
-- a lista-pedidos.php, asi que la ruta vieja tambien funciona un rato.
-- Solo cambia dos filas del menu; no toca estructura ni fayxzvov_pos.
-- Va por code y por la ruta de antes: se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/lista-pedidos.php'
WHERE code = 'pos-pedidos'
  AND route = 'app/order/pedidos.php';

UPDATE modules
SET route = 'app/order/lista-pedidos.php'
WHERE code = 'pedidos'
  AND route = 'app/order/pedidos.php';

-- Comprobacion: deben salir las dos filas con app/order/lista-pedidos.php.
SELECT 'sections' AS tabla, id, code, route FROM sections WHERE code = 'pos-pedidos'
UNION ALL
SELECT 'modules', id, code, route FROM modules WHERE code = 'pedidos';
