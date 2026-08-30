-- ============================================================================
--  Rollback de la migracion 09 — el cargo vuelve a vivir solo en su folio
--
--  Se suelta primero la FK y despues las columnas: al reves MySQL no deja. Los
--  cargos que estaban mudados vuelven a contar para su folio original en cuanto
--  la columna desaparece, porque el COALESCE del modelo se queda sin la mitad
--  que lo mudaba. Los papeles ya generados NO se rehacen solos: el ticket
--  guardado congelo su total, asi que hay que volver a correr el cierre del dia
--  para que las cifras vuelvan a cuadrar contra el nuevo universo.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropPaymentAssignedFolio;

DELIMITER $$

CREATE PROCEDURE dropPaymentAssignedFolio()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA    = DATABASE()
           AND TABLE_NAME      = 'detail_sale_payment'
           AND CONSTRAINT_NAME = 'fk_payment_reassign_run'
    ) THEN
        ALTER TABLE detail_sale_payment DROP FOREIGN KEY fk_payment_reassign_run;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale_payment'
           AND COLUMN_NAME  = 'reassignment_run_id'
    ) THEN
        ALTER TABLE detail_sale_payment DROP COLUMN reassignment_run_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale_payment'
           AND COLUMN_NAME  = 'assigned_folio'
    ) THEN
        ALTER TABLE detail_sale_payment DROP COLUMN assigned_folio;
    END IF;
END$$

DELIMITER ;

CALL dropPaymentAssignedFolio();

DROP PROCEDURE IF EXISTS dropPaymentAssignedFolio;
