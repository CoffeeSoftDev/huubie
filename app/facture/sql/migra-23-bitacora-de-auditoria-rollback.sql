-- ============================================================================
--  Rollback de la migracion 23 — se va la bitacora de auditoria
--
--  OJO: borra la tabla ENTERA, y con ella todo el rastro de quien hizo que. Es la
--  unica migracion del modulo cuyo rollback destruye datos que no se pueden
--  reconstruir desde ningun otro lado. Si la bitacora ya tiene renglones que
--  importan, respaldala antes:
--
--      mysqldump -u root fayxzvov_facturacion audit_log > audit_log.sql
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP TABLE IF EXISTS audit_log;
