-- ============================================================================
--  Rollback de la migracion 07 — quita la tolerancia del ajuste de cuadre
--
--  Sin la columna el ajuste vuelve a no tener techo: los papeles se siguen
--  armando igual y el descuento se sigue guardando, pero nada marca cuando la
--  diferencia se paso de lo que la casa acepta.
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

CALL dropBranchColumnIfExists('adjustment_tolerance');

DROP PROCEDURE IF EXISTS dropBranchColumnIfExists;
