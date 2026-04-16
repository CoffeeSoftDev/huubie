-- =====================================================
-- FASE 2 TICKETS - Migracion de Base de Datos
-- Ejecutar en: fayxzvov_reginas
-- Fecha: 2026-03-17
-- =====================================================

USE `fayxzvov_reginas`;

-- 1. Configuracion de tickets por sucursal
CREATE TABLE IF NOT EXISTS `ticket_config` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `subsidiary_id` INT NOT NULL,
    `business_name` VARCHAR(255) NULL,
    `address` VARCHAR(500) NULL,
    `phone` VARCHAR(50) NULL,
    `rfc` VARCHAR(20) NULL,
    `logo_path` VARCHAR(500) NULL,
    `footer_text` VARCHAR(500) DEFAULT 'Gracias por su compra',
    `printer_width` ENUM('58','80') DEFAULT '80',
    `show_logo` TINYINT(1) DEFAULT 1,
    `show_address` TINYINT(1) DEFAULT 1,
    `show_phone` TINYINT(1) DEFAULT 1,
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Historial de tickets impresos
CREATE TABLE IF NOT EXISTS `ticket_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NULL,
    `cash_shift_id` INT NULL,
    `type` ENUM('venta','corte_x','corte_z','comanda','reimpresion') NOT NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `printed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `folio` VARCHAR(50) NULL,
    INDEX idx_order (`order_id`),
    INDEX idx_type (`type`),
    INDEX idx_date (`printed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Agregar campo folio_ticket a order para tickets de venta
-- Verificar si la columna ya existe antes de agregarla
SET @dbname = 'fayxzvov_reginas';
SET @tablename = 'order';
SET @columnname = 'folio_ticket';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(50) NULL DEFAULT NULL COMMENT "Folio impreso en ticket"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
