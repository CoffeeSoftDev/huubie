-- =====================================================================
-- ROLLBACK de 2026-10-27_enlace-requisicion.sql
-- Quita la llave del enlace para compartir. Bajar antes el código: shareOrden y
-- getComprobante usan la columna. Los enlaces ya enviados dejan de abrir.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    DROP INDEX uq_purchase_order_share_token,
    DROP COLUMN share_token;
