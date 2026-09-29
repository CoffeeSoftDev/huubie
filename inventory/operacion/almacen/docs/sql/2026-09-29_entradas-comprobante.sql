-- =====================================================================
-- Entradas: comprobante (foto o PDF de la nota / factura)
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- inventory_inflow.voucher_url   ruta del archivo RELATIVA a inventory/
--                                (uploads/entradas/ENT-0001.jpg).
--
-- Mismo patrón que inventory_shrinkage.evidence_url (Mermas), pero relativa:
-- así sirve igual en local (/huubie/inventory/) y en prod (/inventory/).
-- Lo escriben saveEntrada, updateEntrada y saveEntradaVoucher (ctrl-entradas).
-- El -rollback quita la columna (los archivos de uploads/entradas quedan).
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_inflow
    ADD COLUMN voucher_url VARCHAR(255) NULL AFTER note;
