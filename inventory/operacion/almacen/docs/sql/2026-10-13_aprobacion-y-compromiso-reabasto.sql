-- =====================================================================
-- Pedidos: nota de aprobación y fecha compromiso del reabasto
-- Fecha: 13/10/2026
-- BD:    fayxzvov_inventory
--
-- purchase_order.approval_note           lo que escribe el almacenista al
--                                        aprobar (Revisar y aprobar).
-- purchase_order.expected_date_user_id   quién capturó la fecha compromiso
-- purchase_order.expected_date_at        y cuándo. La fecha compromiso es la
--                                        columna que ya existía, expected_date:
--                                        cuándo se espera registrar la compra
--                                        del reabasto (REAB-).
--
-- CORRER ANTES de subir el código: approveOrden, fulfillOrden y
-- updateCompromiso (ctrl-ordenes) escriben estas columnas; sin ellas `_CUD`
-- falla sin avisar y la aprobación o el compromiso no se guardan.
--
-- El -rollback quita las tres columnas.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    ADD COLUMN expected_date_user_id INT NULL AFTER expected_date,
    ADD COLUMN expected_date_at DATETIME NULL AFTER expected_date_user_id,
    ADD COLUMN approval_note VARCHAR(255) NULL AFTER reject_reason;
