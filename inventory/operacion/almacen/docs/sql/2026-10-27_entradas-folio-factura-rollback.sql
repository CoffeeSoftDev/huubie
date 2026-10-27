-- =====================================================================
-- ROLLBACK :: Entradas: folio de la factura del proveedor
-- Fecha: 27/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: saveEntrada y updateEntrada (ctrl-entradas), insertEntrada y
--   updateEntradaHeader (mdl-entradas) usan esta columna. Si se regresa la BD
--   hay que regresar también ese ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_inflow
    DROP COLUMN invoice_folio;
