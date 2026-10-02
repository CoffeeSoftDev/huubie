-- ============================================================================
--  Rollback de la migracion 19 — se van los usuarios de la terminal Wansoft
--
--  Despues de esto la pantalla de acceso de facture2 ya no tiene contra que
--  comparar el PIN: el login responde error hasta volver a correr la 19.
--
--  Se borran en orden inverso a las FK: primero quien apunta, luego a quien.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `role_permission`;
DROP TABLE IF EXISTS `permission`;
DROP TABLE IF EXISTS `role`;
