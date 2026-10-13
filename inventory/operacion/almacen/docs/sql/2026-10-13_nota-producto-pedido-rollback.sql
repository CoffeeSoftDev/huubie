-- =====================================================================
-- ROLLBACK :: Pedidos: nota de solicitud por producto
-- Fecha: 13/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: saveOrden / editOrden (ctrl-ordenes) e insertOrdenDetail /
--   qGetOrdenDetail (mdl-ordenes) usan esta columna. Si se regresa la BD hay
--   que regresar también esos ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    DROP COLUMN note;
