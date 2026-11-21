-- =============================================================================
-- Rollback de 2026-11-20_ruta-lista-pedidos.sql
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Regresa la ruta de Pedidos a app/order/pedidos.php (hoy redirige a la lista).
-- Correrlo solo si tambien se regresa el codigo de las dos paginas.
-- =============================================================================

UPDATE sections
SET route = 'app/order/pedidos.php'
WHERE code = 'pos-pedidos'
  AND route = 'app/order/lista-pedidos.php';

UPDATE modules
SET route = 'app/order/pedidos.php'
WHERE code = 'pedidos'
  AND route = 'app/order/lista-pedidos.php';

-- Comprobacion: deben salir las dos filas con app/order/pedidos.php.
SELECT 'sections' AS tabla, id, code, route FROM sections WHERE code = 'pos-pedidos'
UNION ALL
SELECT 'modules', id, code, route FROM modules WHERE code = 'pedidos';
