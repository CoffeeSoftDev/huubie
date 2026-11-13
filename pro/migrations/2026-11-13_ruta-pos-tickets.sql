-- =============================================================================
-- Ruta de la seccion Tickets/Cierre (POS › Reportes › Tickets/Cierre)
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (la seccion `pos-tickets`)
-- Rollback:  2026-11-13_ruta-pos-tickets-rollback.sql
--
-- La seccion nacio SIN ruta y el menu oculta toda seccion sin ruta
-- (auth/ctrl/ctrl-nav.php). La pagina ya existe: app/order/cortes.php
-- (historia de turnos y cierres del dia, con recalcular turno).
-- Solo cambia una fila del menu; no toca estructura ni fayxzvov_pos.
-- Se busca por code: se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/cortes.php'
WHERE code = 'pos-tickets';

-- Comprobacion: debe salir una fila con la ruta nueva.
SELECT id, code, name, route FROM sections WHERE code = 'pos-tickets';
