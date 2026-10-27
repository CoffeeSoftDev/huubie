-- ============================================================================
--  Rollback de la migracion 06
--
--  Quita de `import_batch` las cuatro columnas de auditoria y su indice.
--
--  ⚠ ESTO SI BORRA DATOS: se van el usuario de cada carga, las filas que traia el
--  archivo y el conteo de duplicados. La bitacora vuelve a decir solo cuantas
--  filas entraron, sin poder explicar por que no fueron mas.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropBatchColumnIfExists;
DROP PROCEDURE IF EXISTS dropBatchIndexIfExists;

DELIMITER $$

CREATE PROCEDURE dropBatchColumnIfExists(IN columnName VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND COLUMN_NAME  = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `import_batch` DROP COLUMN `', columnName, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE dropBatchIndexIfExists()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND INDEX_NAME   = 'idx_import_user'
    ) THEN
        ALTER TABLE import_batch DROP INDEX idx_import_user;
    END IF;
END$$

DELIMITER ;

-- El indice primero: cuelga de user_id y bloquearia su DROP.
CALL dropBatchIndexIfExists();

CALL dropBatchColumnIfExists('user_id');
CALL dropBatchColumnIfExists('user_name');
CALL dropBatchColumnIfExists('duplicated_rows');
CALL dropBatchColumnIfExists('source_rows');

DROP PROCEDURE IF EXISTS dropBatchColumnIfExists;
DROP PROCEDURE IF EXISTS dropBatchIndexIfExists;
