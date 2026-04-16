-- =====================================================
-- FASE 4 REPORTES AVANZADOS - Migracion de Base de Datos
-- Ejecutar en: fayxzvov_reginas
-- Fecha: 2026-03-17
-- =====================================================

USE `fayxzvov_reginas`;

-- 1. Tabla de propinas (consolidado por empleado/turno)
CREATE TABLE IF NOT EXISTS `tips` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `employee_id` INT NOT NULL,
    `cash_shift_id` INT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `subsidiary_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee (`employee_id`),
    INDEX idx_shift (`cash_shift_id`),
    INDEX idx_order (`order_id`),
    INDEX idx_date (`created_at`),
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de motivos de cancelacion
CREATE TABLE IF NOT EXISTS `cancellation_reasons` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `original_total` DOUBLE DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (`order_id`),
    INDEX idx_date (`created_at`),
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Agregar campo discount_reason a la tabla order
SET @dbname = 'fayxzvov_reginas';
SET @tablename = 'order';
SET @columnname = 'discount_reason';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(255) NULL DEFAULT NULL COMMENT "Motivo del descuento"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 4. Agregar campo cancelled_by a la tabla order
SET @columnname = 'cancelled_by';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` INT NULL DEFAULT NULL COMMENT "ID del empleado que cancelo"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 5. Agregar campo cancelled_at a la tabla order
SET @columnname = 'cancelled_at';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` DATETIME NULL DEFAULT NULL COMMENT "Fecha y hora de cancelacion"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
