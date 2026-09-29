-- =====================================================================
-- ROLLBACK :: Entradas: quién editó la entrada
-- Fecha: 28/09/2026
-- BD:    fayxzvov_inventory
--
-- OJO: updateEntrada y qGetEntrada (ctrl/mdl-entradas) usan estas columnas.
--   Si se regresa la BD hay que regresar también ese ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_inflow
    DROP KEY idx_inflow_edited_user,
    DROP COLUMN edited_user_id,
    DROP COLUMN edited_at;
