-- =====================================================================
-- ROLLBACK :: Entradas: comprobante
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- OJO: saveEntrada, updateEntrada, saveEntradaVoucher (ctrl-entradas) y
--   updateEntradaVoucher (mdl-entradas) usan esta columna. Si se regresa la BD
--   hay que regresar también ese ctrl/mdl. Los archivos de
--   inventory/uploads/entradas/ no se borran.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_inflow
    DROP COLUMN voucher_url;
