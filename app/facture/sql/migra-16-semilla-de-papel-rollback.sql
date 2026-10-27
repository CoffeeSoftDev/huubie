-- ============================================================================
--  Rollback de la migracion 16 — se va la semilla de la corrida
--
--  Despues de esto las corridas dejan de decir con que combinacion armaron sus
--  papeles. Los papeles ya guardados no cambian —sus renglones estan escritos en
--  detail_virtual_ticket—, pero rehacer un dia con la misma mezcla deja de ser
--  reproducible: se vuelve siempre a la combinacion del folio.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropGenerationRunSeed;

DELIMITER $$

CREATE PROCEDURE dropGenerationRunSeed()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'paper_seed'
    ) THEN
        ALTER TABLE generation_run DROP COLUMN paper_seed;
    END IF;
END$$

DELIMITER ;

CALL dropGenerationRunSeed();

DROP PROCEDURE IF EXISTS dropGenerationRunSeed;
