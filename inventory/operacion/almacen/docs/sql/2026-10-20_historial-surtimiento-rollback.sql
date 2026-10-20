-- =====================================================================
-- ROLLBACK de 2026-10-20_historial-surtimiento.sql
-- Borra el historial de surtimiento. Bajar antes el código: surtir() y
-- getOrden usan la tabla.
-- =====================================================================

DROP TABLE IF EXISTS fayxzvov_inventory.purchase_order_supply;
