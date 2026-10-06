-- =====================================================================
-- ROLLBACK :: Salidas: folio M-0001 -> S-0001
-- Fecha: 06/10/2026
-- BD:    fayxzvov_inventory
--
-- Regresa a M- todos los folios S-, también los que se crearon después de
-- la migración (siguen la misma numeración, así que no chocan).
--
-- OJO: saveSalida (ctrl-salidas) arma el folio con S-. Si se regresa la BD
--   hay que regresar también ese ctrl a M-.
-- =====================================================================

UPDATE fayxzvov_inventory.inventory_shrinkage
   SET folio = CONCAT('M-', SUBSTRING(folio, 3))
 WHERE folio LIKE 'S-%';
