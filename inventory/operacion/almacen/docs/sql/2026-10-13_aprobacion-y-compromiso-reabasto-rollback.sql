-- =====================================================================
-- ROLLBACK :: Pedidos: nota de aprobación y fecha compromiso del reabasto
-- Fecha: 13/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: approveOrden, fulfillOrden y updateCompromiso (ctrl-ordenes) y
--   updateOrdenStatusApprove / updateOrdenCompromiso / qGetOrden (mdl-ordenes) usan
--   estas columnas. Si se regresa la BD hay que regresar también esos ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    DROP COLUMN approval_note,
    DROP COLUMN expected_date_at,
    DROP COLUMN expected_date_user_id;
