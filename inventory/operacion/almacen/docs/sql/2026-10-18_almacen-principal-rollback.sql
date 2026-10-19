-- =====================================================================
-- ROLLBACK de 2026-10-18_almacen-principal.sql
-- Quita la marca de almacén principal. Bajar antes el código que la lee
-- (Catálogo › Almacenes y Pedidos).
-- =====================================================================

ALTER TABLE fayxzvov_inventory.warehouse DROP COLUMN is_main;
