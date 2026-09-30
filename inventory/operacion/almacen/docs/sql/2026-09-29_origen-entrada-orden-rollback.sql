-- =====================================================================
-- ROLLBACK :: Orígenes de entrada: orden manual
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- OJO: listInflow, getMaxInflowSort, sortInflow (ctrl/mdl-catalogo) y
--   lsInflowOrigins (mdl-entradas) usan esta columna. Si se regresa la BD hay
--   que regresar también esos ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inflow_origin
    DROP COLUMN sort_order;
