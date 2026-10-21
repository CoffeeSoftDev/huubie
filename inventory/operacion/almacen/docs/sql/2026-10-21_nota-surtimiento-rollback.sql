-- =====================================================================
-- ROLLBACK de 2026-10-21_nota-surtimiento.sql
-- Quita la nota del surtimiento. Bajar antes el código: surtir() y getOrden
-- usan la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order_supply DROP COLUMN note;
