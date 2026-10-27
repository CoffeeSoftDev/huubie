-- =====================================================================
-- Entradas: folio de la factura del proveedor
-- Fecha: 27/10/2026
-- BD:    fayxzvov_inventory
--
-- inventory_inflow.invoice_folio   folio de la factura con que llegó la
--                                  entrada (A-1187, F 0042...). Opcional.
--
-- Lo escriben saveEntrada y updateEntrada (ctrl-entradas); se ve en el
-- detalle y en el comprobante impreso. El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_inflow
    ADD COLUMN invoice_folio VARCHAR(50) NULL AFTER voucher_url;
