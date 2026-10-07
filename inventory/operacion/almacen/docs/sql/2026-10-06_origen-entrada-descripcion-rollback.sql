-- =====================================================================
-- ROLLBACK :: Orígenes de entrada: descripción
-- Fecha: 06/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: lsInflowOrigins (mdl-entradas) y el campo Descripción de
--   Catálogo > Origen entradas (jsonInflow, catalogo.js) usan esta columna.
--   Si se regresa la BD hay que regresar también esos mdl/js.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inflow_origin
    DROP COLUMN description;
