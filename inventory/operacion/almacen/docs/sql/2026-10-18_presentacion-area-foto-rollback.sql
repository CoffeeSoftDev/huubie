-- =====================================================================
-- ROLLBACK de 2026-10-18_presentacion-area-foto.sql
-- Quita el área y la foto propias de las presentaciones (los archivos de
-- uploads/presentaciones/ se quedan en disco). Bajar antes el código que
-- las lee (lsPresentaciones en ctrl-almacen).
-- =====================================================================

ALTER TABLE fayxzvov_inventory.item_presentation
    DROP COLUMN image,
    DROP COLUMN warehouse_area_id;
