-- =============================================================================
-- Forma de pago «Monedero» — fase V3 del plan de Ventas (credito y monedero)
-- Fecha:     14/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-06_crear-fayxzvov-pos.sql (payment_method, customer.wallet, receivable)
-- Rollback:  2026-11-14_metodo-monedero-rollback.sql
--
-- 1. El monedero es el saldo a favor del cliente (customer.wallet). Para pagar
--    con el hace falta un metodo de pago: se agrega «Monedero» (code PUNTOS,
--    kind 'puntos'), de plantilla (company_id NULL) como los otros tres.
-- 2. Nace OCULTO (is_visible 0): las ventanas de cobro de Pedidos y del
--    Historial listan solo los visibles, asi que no lo ofrecen. «Vender» lo
--    busca por su codigo y lo muestra solo si el cliente tiene saldo.
-- 3. No es efectivo (is_cash 0): no mueve el efectivo esperado del corte.
-- 4. El credito no necesita datos nuevos: usa receivable (kind 'cargo' y
--    'abono') y customer.credit_enabled / credit_limit, que ya existen.
-- Sin cambios de estructura. Se puede volver a correr (NOT EXISTS).
-- =============================================================================

INSERT INTO payment_method (name, code, kind, commission, sort, is_cash, is_visible, earns_points, company_id, active)
SELECT 'Monedero', 'PUNTOS', 'puntos', 0, 5, 0, 0, 0, NULL, 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM payment_method WHERE code = 'PUNTOS');

-- Comprobacion: los metodos de plantilla; Monedero debe salir con is_visible 0.
SELECT id, name, code, kind, sort, is_cash, is_visible, company_id, active
FROM payment_method
ORDER BY IFNULL(sort, 99), id;
