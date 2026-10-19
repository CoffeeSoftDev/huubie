-- =====================================================================
-- ROLLBACK de 2026-10-18_motivo-paso-a-presentacion.sql
-- Quita el motivo solo si ningún ajuste lo usa (FK de inventory_adjustment).
-- =====================================================================

DELETE r
FROM fayxzvov_inventory.adjustment_reason r
LEFT JOIN fayxzvov_inventory.inventory_adjustment a ON a.adjustment_reason_id = r.id
WHERE r.code = 'PRESENTACION'
  AND a.id IS NULL;
