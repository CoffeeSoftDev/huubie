-- ============================================================================
--  Rollback de la migracion 05
--
--  Deshace lo que abrio migra-05-wansoft.sql y deja el esquema como estaba.
--
--  ORDEN INVERSO OBLIGATORIO: primero se sueltan las FK que apuntan a las tablas
--  nuevas, despues se borran las tablas. Al reves, InnoDB rechaza el DROP.
--
--  ⚠ ESTO SI BORRA DATOS. Las cuatro columnas nuevas de detail_sale_payment y las
--  seis de sale se van con su contenido: si ya se cargo un export de Wansoft,
--  este script tira las propinas, las terminales y los cajeros de esa carga.
--  Las tablas nuevas se van completas.
--
--  Lo unico que NO se revierte es billing_code: se queda admitiendo NULL. Volver
--  a NOT NULL fallaria si ya entro una venta de Wansoft, y aflojar una
--  restriccion nunca rompio nada. Lo mismo con waiter.code, que se queda en
--  VARCHAR(20) NULL.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS dropColumnIfExists;
DROP PROCEDURE IF EXISTS dropIndexIfExists;
DROP PROCEDURE IF EXISTS dropForeignKeyIfExists;

DELIMITER $$

CREATE PROCEDURE dropColumnIfExists(IN tableName VARCHAR(64), IN columnName VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tableName AND COLUMN_NAME = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tableName, '` DROP COLUMN `', columnName, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE dropIndexIfExists(IN tableName VARCHAR(64), IN indexName VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tableName AND INDEX_NAME = indexName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tableName, '` DROP INDEX `', indexName, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE dropForeignKeyIfExists(IN tableName VARCHAR(64), IN fkName VARCHAR(64))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tableName
           AND CONSTRAINT_NAME = fkName AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tableName, '` DROP FOREIGN KEY `', fkName, '`');
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- -- 1. Soltar las FK de sale hacia lo nuevo ---------------------------------

CALL dropForeignKeyIfExists('sale', 'fk_sale_operation_status');
CALL dropForeignKeyIfExists('sale', 'fk_sale_waiter');
CALL dropForeignKeyIfExists('sale', 'fk_sale_cashier');

CALL dropIndexIfExists('sale', 'idx_sale_pdv');
CALL dropIndexIfExists('sale', 'idx_sale_operation_status');
CALL dropIndexIfExists('sale', 'idx_sale_waiter');
CALL dropIndexIfExists('sale', 'idx_sale_cashier');


-- -- 2. Columnas nuevas de las tablas vivas ----------------------------------

CALL dropColumnIfExists('sale', 'cashier_id');
CALL dropColumnIfExists('sale', 'waiter_id');
CALL dropColumnIfExists('sale', 'operation_status_id');
CALL dropColumnIfExists('sale', 'guest_count');
CALL dropColumnIfExists('sale', 'order_number');
CALL dropColumnIfExists('sale', 'pdv_movement');

CALL dropColumnIfExists('detail_sale_payment', 'paid_at');
CALL dropColumnIfExists('detail_sale_payment', 'tip');
CALL dropColumnIfExists('detail_sale_payment', 'validation_code');
CALL dropColumnIfExists('detail_sale_payment', 'transaction_code');
CALL dropColumnIfExists('detail_sale_payment', 'reference');
CALL dropColumnIfExists('detail_sale_payment', 'terminal');

CALL dropColumnIfExists('branch', 'tip_commission_rate');

CALL dropIndexIfExists('waiter', 'uk_waiter_name');


-- -- 3. Tablas nuevas --------------------------------------------------------

DROP TABLE IF EXISTS detail_sale_payment_card;
DROP TABLE IF EXISTS deleted_sale_payment;
DROP TABLE IF EXISTS daily_sale_summary;
DROP TABLE IF EXISTS cashier;
DROP TABLE IF EXISTS sale_operation_status;


-- -- 4. Seed de formas de pago ------------------------------------------------
--
-- Solo la que sembro esta migracion. EFECTIVO y las de Soft Restaurant no se
-- tocan: son del DDL original.

DELETE FROM payment_method WHERE name = 'TARJETA DE CREDITO';


DROP PROCEDURE IF EXISTS dropColumnIfExists;
DROP PROCEDURE IF EXISTS dropIndexIfExists;
DROP PROCEDURE IF EXISTS dropForeignKeyIfExists;
