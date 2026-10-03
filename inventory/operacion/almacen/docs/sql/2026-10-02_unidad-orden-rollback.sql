-- =====================================================================
-- ROLLBACK :: Unidades de medida: orden manual
-- Fecha: 02/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: listUnit, getMaxUnitSort, sortUnit (ctrl/mdl-catalogo), lsUnits
--   (mdl-almacen) y lsUnidades (mdl-entradas) usan esta columna. Si se regresa
--   la BD hay que regresar también esos ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.unit
    DROP COLUMN sort_order;
