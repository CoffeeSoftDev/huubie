-- =====================================================================
-- ROLLBACK de 2026-10-03_tablas-sin-uso.sql
-- BD: fayxzvov_erp
--
-- Restaura las 7 tablas (estructura + datos) desde el respaldo tomado antes
-- del DROP. Correr con el cliente mysql desde esta carpeta (SOURCE es un
-- comando del cliente, no de SQL):
--
--   mysql -u root fayxzvov_erp < backups/backup_fayxzvov_erp_2026-10-03_tablas-sin-uso.sql
-- =====================================================================

USE fayxzvov_erp;
SOURCE backups/backup_fayxzvov_erp_2026-10-03_tablas-sin-uso.sql;
