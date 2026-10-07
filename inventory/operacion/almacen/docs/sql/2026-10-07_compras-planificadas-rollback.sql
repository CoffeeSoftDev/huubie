-- =====================================================================
-- ROLLBACK :: Compras: rutina, programadas y esporádicas
-- Fecha: 07/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: compras.php (ctrl/mdl-compras) usa estas columnas. Si se regresa la BD
--   hay que quitar también esa pantalla. Las compras ya guardadas (folio CP-)
--   se quedan en purchase_order sin nombre ni tipo; Órdenes y Solicitudes las
--   siguen dejando fuera por el folio.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    DROP FOREIGN KEY fk_po_origin;

ALTER TABLE fayxzvov_inventory.purchase_order
    DROP KEY idx_po_purchase_type,
    DROP KEY idx_po_series,
    DROP KEY idx_po_origin,
    DROP KEY idx_po_captured_user,
    DROP COLUMN name,
    DROP COLUMN purchase_type,
    DROP COLUMN series_code,
    DROP COLUMN weekdays,
    DROP COLUMN buyer_name,
    DROP COLUMN origin_purchase_order_id,
    DROP COLUMN printed_at,
    DROP COLUMN captured_at,
    DROP COLUMN captured_user_id;

ALTER TABLE fayxzvov_inventory.detail_purchase_order
    DROP COLUMN purchase_place;
