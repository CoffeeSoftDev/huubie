-- =====================================================================
-- Rollback de 2026-09-30_coffeeia-config.sql
-- Sin la tabla, _IaOllama.php vuelve a leer solo el .env.
-- =====================================================================

DROP TABLE IF EXISTS fayxzvov_erp.coffeeia_config;
