-- =============================================================================
-- Ruta de la seccion Clientes (Pedidos › Clientes)
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (la seccion `pos-clientes`)
-- Rollback:  2026-11-13_ruta-pos-clientes-rollback.sql
--
-- La seccion nacio SIN ruta y el menu oculta toda seccion sin ruta
-- (auth/ctrl/ctrl-nav.php). La pagina ya existe: app/order/clientes.php
-- (directorio de la sucursal: alta, edicion, baja logica e historial).
-- Solo cambia una fila del menu; no toca estructura ni fayxzvov_pos.
-- Se busca por code: se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/clientes.php'
WHERE code = 'pos-clientes';

-- Comprobacion: debe salir una fila con la ruta nueva.
SELECT id, code, name, route FROM sections WHERE code = 'pos-clientes';
