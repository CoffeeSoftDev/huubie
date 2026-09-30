-- =====================================================================
-- Rollback de 2026-09-30_coffee-ia.sql
--
-- Sin estas tablas CoffeeIA vuelve a leer el .env y el archivo de prompt,
-- y queda encendido para todas las empresas.
-- =====================================================================

DROP TABLE IF EXISTS fayxzvov_erp.ia_company_access;
DROP TABLE IF EXISTS fayxzvov_erp.ia_assistants;
