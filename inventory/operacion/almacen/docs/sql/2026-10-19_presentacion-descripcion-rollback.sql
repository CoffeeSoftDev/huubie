-- =====================================================================
-- ROLLBACK de 2026-10-19_presentacion-descripcion.sql
-- Quita la descripción propia de las presentaciones. Bajar antes el código
-- que la lee y la escribe (ctrl-almacen).
-- =====================================================================

ALTER TABLE fayxzvov_inventory.item_presentation
    DROP COLUMN description;
