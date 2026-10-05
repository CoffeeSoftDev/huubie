-- ============================================================================
--  Rollback de la migracion 24 — se va el sello de los tickets
--
--  Borra la tabla ENTERA: los dias impresos vuelven a poder rehacerse o
--  eliminarse. Se pierde quien imprimio cada dia y cuando.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP TABLE IF EXISTS ticket_seal;
