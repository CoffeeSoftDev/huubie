-- =====================================================================
-- ROLLBACK de 2026-10-03_temas-por-empresa.sql
-- BD: fayxzvov_erp
--
-- Borra la tabla company_themes. OJO: themes() / saveTheme() (ctrl-access)
-- y las acciones de Empresas en tenant la leen; si se regresa la BD hay que
-- regresar también ese código.
-- =====================================================================

DROP TABLE IF EXISTS fayxzvov_erp.company_themes;
