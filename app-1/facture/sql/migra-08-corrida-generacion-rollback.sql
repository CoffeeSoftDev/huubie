-- ============================================================================
--  Rollback de la migracion 08 — quita el registro de corridas
--
--  Se suelta primero la referencia del ticket y despues la tabla: al reves la FK
--  no deja. Los papeles quedan como estaban, pero el 70/30 con el que se
--  armaron vuelve a no constar en ningun lado.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropTicketRunColumn;

DELIMITER $$

CREATE PROCEDURE dropTicketRunColumn()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA    = DATABASE()
           AND TABLE_NAME      = 'virtual_ticket'
           AND CONSTRAINT_NAME = 'fk_vt_run'
    ) THEN
        ALTER TABLE virtual_ticket DROP FOREIGN KEY fk_vt_run;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND COLUMN_NAME  = 'generation_run_id'
    ) THEN
        ALTER TABLE virtual_ticket DROP COLUMN generation_run_id;
    END IF;
END$$

DELIMITER ;

CALL dropTicketRunColumn();

DROP PROCEDURE IF EXISTS dropTicketRunColumn;

DROP TABLE IF EXISTS generation_run;
