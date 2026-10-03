-- ============================================================================
--  Rollback de la migracion 20 — se van los movimientos validos del lote
--
--  Los lotes vuelven a decir solo sus filas, sus duplicados y su total de
--  control. Los pagos no se tocan: las dos columnas eran un resumen de ellos.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropImportBatchValid;

DELIMITER $$

CREATE PROCEDURE dropImportBatchValid()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND COLUMN_NAME  = 'valid_total'
    ) THEN
        ALTER TABLE import_batch DROP COLUMN valid_total;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND COLUMN_NAME  = 'valid_count'
    ) THEN
        ALTER TABLE import_batch DROP COLUMN valid_count;
    END IF;
END$$

DELIMITER ;

CALL dropImportBatchValid();

DROP PROCEDURE IF EXISTS dropImportBatchValid;
