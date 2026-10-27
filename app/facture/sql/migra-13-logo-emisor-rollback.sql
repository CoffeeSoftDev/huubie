-- ============================================================================
--  Rollback de la migracion 13 — quita el logo del emisor
--
--  Sin la columna el papel vuelve a encabezarse siempre con la razon social. Los
--  archivos ya subidos NO se borran: viven en /app/facture/src/img/logos y se
--  quedan ahi, porque una migracion de esquema no tiene por que llevarse
--  imagenes que alguien cargo. Si se vuelve a aplicar la 13, hay que subirlos de
--  nuevo: la ruta si se pierde.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropBranchColumnIfExists;

DELIMITER $$

CREATE PROCEDURE dropBranchColumnIfExists(IN columnName VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'branch'
           AND COLUMN_NAME  = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `branch` DROP COLUMN `', columnName, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

CALL dropBranchColumnIfExists('logo');

DROP PROCEDURE IF EXISTS dropBranchColumnIfExists;
