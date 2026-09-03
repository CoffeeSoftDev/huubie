-- ============================================================================
--  Rollback de la migracion 17 — se va el registro maestro (punto 29)
--
--  Despues de esto las corridas pierden su folio visible y los cuatro conteos que
--  el punto 29 pide: de que archivo salio el dia, cuantos movimientos entraron,
--  cuantos folios se mudaron y cuantos papeles de $0.00 se imprimieron.
--
--  Los papeles no se tocan: siguen colgados de su corrida por `id`, que es lo que
--  la FK usa. Lo que se pierde es la manera de nombrarla desde fuera.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropGenerationRunRecord;

DELIMITER $$

CREATE PROCEDURE dropGenerationRunRecord()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND INDEX_NAME   = 'uq_run_folio'
    ) THEN
        ALTER TABLE generation_run DROP INDEX uq_run_folio;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'folio'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN folio;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'source_file'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN source_file;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'movements_count'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN movements_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'reassigned_count'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN reassigned_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'zero_ticket_count'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN zero_ticket_count;
    END IF;
END$$

DELIMITER ;

CALL dropGenerationRunRecord();

DROP PROCEDURE IF EXISTS dropGenerationRunRecord;
