-- =====================================================================
-- ROLLBACK :: Pedidos: producto que se entrega en lugar del pedido
-- Fecha: 17/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: qGetOrdenDetail / updateDetailDelivered (mdl-ordenes) y approveOrden /
--   surtir (ctrl-ordenes) usan esta columna. Si se regresa la BD hay que
--   regresar también esos ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    DROP FOREIGN KEY fk_dpo_delivered_item;

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    DROP COLUMN delivered_item_id;
