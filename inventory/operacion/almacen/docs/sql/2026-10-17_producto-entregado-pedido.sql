-- =====================================================================
-- Pedidos: producto que se entrega en lugar del pedido
-- Fecha: 17/10/2026
-- BD:    fayxzvov_inventory
--
-- detail_purchase_order.delivered_item_id   el producto que el almacén
--                              entrega en lugar del pedido (Revisar y aprobar >
--                              «Producto a entregar»: uno de la misma categoría
--                              con stock). NULL = se entrega lo pedido.
--                              item_id sigue siendo lo que pidió la sucursal.
--                              La salida SI- y el reabasto REAB- usan este
--                              producto; el detalle muestra «Se entregó».
--
-- CORRER ANTES de subir el código: qGetOrdenDetail (mdl-ordenes) ya lee esta
-- columna; sin ella no se puede abrir, aprobar ni surtir ningún pedido.
--
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    ADD COLUMN delivered_item_id INT(11) NULL DEFAULT NULL AFTER item_id,
    ADD CONSTRAINT fk_dpo_delivered_item FOREIGN KEY (delivered_item_id) REFERENCES fayxzvov_inventory.item (id);
