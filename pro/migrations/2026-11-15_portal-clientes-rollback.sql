-- =============================================================================
-- Rollback: Portal del cliente con comprobantes (2026-11-15_portal-clientes.sql)
-- BD:        fayxzvov_pos
--
-- Se pierden los enlaces de los clientes y la lista de comprobantes (en
-- revision, abonados y rechazados con su motivo).
--
-- NO se pierde:
--   - Los pagos que ya se abonaron desde un comprobante: siguen en payment (y
--     en receivable si eran de credito), con «Comprobante C<id>» en su
--     descripcion, y siguen contando en su corte.
--   - Los archivos de pro/storage/receipts: este script no los borra. Si ya no
--     se quieren, se borran a mano.
--
-- Bajar primero el codigo: portal.php, src/js/portal.js, ctrl/ctrl-portal.php,
-- ctrl/ctrl-comprobantes.php, ctrl/comprobante.php, mdl/mdl-portal.php y la
-- clase Receipts de src/js/clientes.js. Con el codigo arriba y sin tablas, el
-- enlace publico responde error y Clientes muestra el boton sin datos.
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.customer_receipt;
DROP TABLE IF EXISTS fayxzvov_pos.customer_portal;

-- -- Comprobacion --

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('customer_portal', 'customer_receipt');
