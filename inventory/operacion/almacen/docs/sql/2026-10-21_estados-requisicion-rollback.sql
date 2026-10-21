-- =====================================================================
-- ROLLBACK de 2026-10-21_estados-requisicion.sql
-- Borra los colores de los estados de la requisición. Requisiciones y Surtir
-- vuelven a los colores fijos del código; la pestaña Estados requisición del
-- Catálogo queda vacía (bajar antes ese código).
-- =====================================================================

DROP TABLE IF EXISTS fayxzvov_inventory.requisition_status;
