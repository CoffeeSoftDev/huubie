-- =============================================================================
-- Rollback de 2026-11-14_metodo-monedero.sql
-- Fecha:     14/11/2026
-- BD:        fayxzvov_pos
--
-- Quita el metodo «Monedero» SOLO si ningun pago lo uso. Con pagos hechos no
-- se borra (los pagos se quedarian sin metodo): se desactiva y ya no se
-- ofrece al cobrar.
-- =============================================================================

UPDATE payment_method
SET active = 0
WHERE code = 'PUNTOS'
    AND EXISTS (SELECT 1 FROM payment p WHERE p.payment_method_id = payment_method.id);

DELETE FROM payment_method
WHERE code = 'PUNTOS'
    AND NOT EXISTS (SELECT 1 FROM payment p WHERE p.payment_method_id = payment_method.id);

-- Comprobacion: sin fila PUNTOS, o con active 0 si ya tenia pagos.
SELECT id, name, code, kind, is_visible, active
FROM payment_method
ORDER BY IFNULL(sort, 99), id;
