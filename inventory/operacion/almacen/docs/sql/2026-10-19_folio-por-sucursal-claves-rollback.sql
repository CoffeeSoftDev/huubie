-- =====================================================================
-- ROLLBACK de 2026-10-19_folio-por-sucursal-claves.sql
-- Antes: bajar el código (mdl-folios.php y Accesos › Sucursales) y correr el
-- rollback de 2026-10-19_folio-por-sucursal-renumerar.sql.
-- =====================================================================

ALTER TABLE fayxzvov_erp.branches DROP INDEX uq_branches_folio_code, DROP COLUMN folio_code;
