-- =====================================================================
-- ROLLBACK de 2026-10-19_salida-presentacion.sql
-- Quita la presentación capturada de los renglones de salida (el stock no
-- cambia: siempre se guardó en el producto base). Bajar antes el código
-- que las usa (getSalidaDetail e insertSalidaDetail en mdl-salidas).
-- =====================================================================

ALTER TABLE fayxzvov_inventory.detail_inventory_shrinkage
    DROP COLUMN presentation_quantity,
    DROP COLUMN item_presentation_id;
