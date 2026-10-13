-- =====================================================================
-- Pedidos: nota de solicitud por producto
-- Fecha: 13/10/2026
-- BD:    fayxzvov_inventory
--
-- detail_purchase_order.note   lo que quien pide quiere aclarar de ese
--                              producto (marca, presentación, urgencia...).
--                              Se captura en Nuevo / Editar pedido y se ve en
--                              el detalle.
--
-- CORRER ANTES de subir el código: saveOrden / editOrden (ctrl-ordenes) e
-- insertOrdenDetail / qGetOrdenDetail (mdl-ordenes) ya usan esta columna; sin
-- ella no se puede guardar ni abrir un pedido.
--
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    ADD COLUMN note VARCHAR(255) NULL AFTER subtotal;
