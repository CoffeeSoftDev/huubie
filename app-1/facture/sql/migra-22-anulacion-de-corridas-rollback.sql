-- ============================================================================
--  Rollback de la migracion 22 — la corrida vuelve a no saber que se anulo
--
--  Se van la FK, su indice y las cinco columnas de la anulacion. Lo que se pierde
--  es QUIEN, CUANDO, POR QUE y QUE CORRIDA la sustituyo.
--
--  `active` NO se toca. Las corridas anuladas se quedan en active = 0 y siguen
--  fuera de todos los lectores, que es lo correcto: devolverlas a 1 reviviria el
--  doble conteo del dia rehecho —el defecto que esta migracion vino a cerrar— y
--  haria volver a una corrida eliminada cuyos tickets ya no existen.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropGenerationRunCancel;

DELIMITER $$

CREATE PROCEDURE dropGenerationRunCancel()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA    = DATABASE()
           AND TABLE_NAME      = 'generation_run'
           AND CONSTRAINT_NAME = 'fk_run_replaced'
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE generation_run DROP FOREIGN KEY fk_run_replaced;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND INDEX_NAME   = 'idx_run_replaced'
    ) THEN
        ALTER TABLE generation_run DROP KEY idx_run_replaced;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'replaced_by_run_id'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN replaced_by_run_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancel_reason'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN cancel_reason;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancelled_user_name'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN cancelled_user_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancelled_user_id'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN cancelled_user_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancelled_at'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN cancelled_at;
    END IF;
END$$

DELIMITER ;

CALL dropGenerationRunCancel();

DROP PROCEDURE IF EXISTS dropGenerationRunCancel;
