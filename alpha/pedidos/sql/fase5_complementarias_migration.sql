-- =====================================================
-- FASE 5 FUNCIONALIDADES COMPLEMENTARIAS - Migracion
-- Ejecutar en: fayxzvov_reginas
-- Fecha: 2026-03-17
-- =====================================================

USE `fayxzvov_reginas`;

-- 1. Codigo de barras en productos
SET @dbname = 'fayxzvov_reginas';
SET @tablename = 'order_products';
SET @columnname = 'barcode';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(100) NULL DEFAULT NULL COMMENT "Codigo de barras del producto"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Panel de cocina (KDS) - Estados de preparacion por item
CREATE TABLE IF NOT EXISTS `kds_order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `package_id` INT NOT NULL COMMENT 'ID de order_package',
    `status` ENUM('pendiente','preparando','listo','entregado') DEFAULT 'pendiente',
    `station` VARCHAR(100) NULL COMMENT 'Estacion de cocina',
    `started_at` DATETIME NULL,
    `completed_at` DATETIME NULL,
    `delivered_at` DATETIME NULL,
    `employee_id` INT NULL COMMENT 'Cocinero asignado',
    `subsidiary_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (`order_id`),
    INDEX idx_status (`status`),
    INDEX idx_subsidiary (`subsidiary_id`),
    INDEX idx_date (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Programa de lealtad - Configuracion
CREATE TABLE IF NOT EXISTS `loyalty_config` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `subsidiary_id` INT NOT NULL,
    `points_per_peso` DOUBLE DEFAULT 1 COMMENT 'Puntos ganados por cada peso gastado',
    `peso_per_point` DOUBLE DEFAULT 0.10 COMMENT 'Valor en pesos de cada punto al canjear',
    `min_points_redeem` INT DEFAULT 100 COMMENT 'Puntos minimos para canjear',
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Programa de lealtad - Puntos de clientes
CREATE TABLE IF NOT EXISTS `loyalty_points` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_id` INT NOT NULL,
    `points_balance` INT DEFAULT 0 COMMENT 'Saldo actual de puntos',
    `total_earned` INT DEFAULT 0 COMMENT 'Total historico ganado',
    `total_redeemed` INT DEFAULT 0 COMMENT 'Total historico canjeado',
    `subsidiary_id` INT NOT NULL,
    `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_client (`client_id`),
    INDEX idx_subsidiary (`subsidiary_id`),
    UNIQUE KEY uk_client_sub (`client_id`, `subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Programa de lealtad - Historial de transacciones de puntos
CREATE TABLE IF NOT EXISTS `loyalty_transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `client_id` INT NOT NULL,
    `order_id` INT NULL,
    `type` ENUM('earn','redeem','adjust') NOT NULL,
    `points` INT NOT NULL,
    `description` VARCHAR(255) NULL,
    `employee_id` INT NULL,
    `subsidiary_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_client (`client_id`),
    INDEX idx_order (`order_id`),
    INDEX idx_type (`type`),
    INDEX idx_date (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Mesas
CREATE TABLE IF NOT EXISTS `tables_config` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL COMMENT 'Nombre de la mesa ej: Mesa 1, Barra A',
    `capacity` INT DEFAULT 4,
    `zone` VARCHAR(100) NULL COMMENT 'Zona: interior, terraza, barra',
    `status` ENUM('libre','ocupada','reservada','cuenta') DEFAULT 'libre',
    `current_order_id` INT NULL,
    `subsidiary_id` INT NOT NULL,
    `active` INT DEFAULT 1,
    `position_x` INT DEFAULT 0 COMMENT 'Posicion X en el mapa',
    `position_y` INT DEFAULT 0 COMMENT 'Posicion Y en el mapa',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_subsidiary (`subsidiary_id`),
    INDEX idx_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Agregar campo table_id a la tabla order
SET @tablename = 'order';
SET @columnname = 'table_id';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` INT NULL DEFAULT NULL COMMENT "Mesa asignada"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 8. Facturacion CFDI - Datos fiscales del cliente
SET @tablename = 'order_clients';
SET @columnname = 'rfc';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(20) NULL DEFAULT NULL COMMENT "RFC del cliente"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'razon_social';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(255) NULL DEFAULT NULL COMMENT "Razon social para facturacion"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'regimen_fiscal';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(10) NULL DEFAULT NULL COMMENT "Clave de regimen fiscal SAT"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @columnname = 'codigo_postal_fiscal';
SET @preparedStatement = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @columnname) > 0,
    'SELECT 1',
    CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(10) NULL DEFAULT NULL COMMENT "CP fiscal del cliente"')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 9. Facturacion CFDI - Registro de facturas
CREATE TABLE IF NOT EXISTS `cfdi_invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `uuid` VARCHAR(100) NULL COMMENT 'UUID del timbre fiscal',
    `folio_fiscal` VARCHAR(100) NULL,
    `serie` VARCHAR(10) NULL,
    `folio` VARCHAR(20) NULL,
    `rfc_emisor` VARCHAR(20) NULL,
    `rfc_receptor` VARCHAR(20) NULL,
    `razon_social_receptor` VARCHAR(255) NULL,
    `regimen_fiscal_receptor` VARCHAR(10) NULL,
    `uso_cfdi` VARCHAR(10) DEFAULT 'S01' COMMENT 'Sin obligacion fiscal',
    `forma_pago` VARCHAR(10) NULL COMMENT 'Clave SAT forma de pago',
    `metodo_pago` VARCHAR(10) DEFAULT 'PUE' COMMENT 'PUE o PPD',
    `subtotal` DOUBLE DEFAULT 0,
    `iva` DOUBLE DEFAULT 0,
    `total` DOUBLE DEFAULT 0,
    `xml_path` VARCHAR(500) NULL,
    `pdf_path` VARCHAR(500) NULL,
    `status` ENUM('pendiente','timbrada','cancelada','error') DEFAULT 'pendiente',
    `pac_provider` VARCHAR(50) NULL COMMENT 'Finkok, SWsapien, Facturapi',
    `pac_response` TEXT NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `cancelled_at` DATETIME NULL,
    INDEX idx_order (`order_id`),
    INDEX idx_uuid (`uuid`),
    INDEX idx_status (`status`),
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Roles granulares - Permisos por modulo
CREATE TABLE IF NOT EXISTS `role_permissions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `role_id` INT NOT NULL,
    `module` VARCHAR(100) NOT NULL COMMENT 'pos, reportes, inventario, admin, cocina',
    `permission` VARCHAR(100) NOT NULL COMMENT 'view, create, edit, delete, cancel, discount, corte, export',
    `allowed` TINYINT(1) DEFAULT 1,
    `subsidiary_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_role (`role_id`),
    INDEX idx_module (`module`),
    UNIQUE KEY uk_role_module_perm (`role_id`, `module`, `permission`, `subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Insertar permisos por defecto para rol Admin (1)
INSERT IGNORE INTO `role_permissions` (`role_id`, `module`, `permission`, `subsidiary_id`) VALUES
(1, 'pos', 'view', 1), (1, 'pos', 'create', 1), (1, 'pos', 'cancel', 1), (1, 'pos', 'discount', 1), (1, 'pos', 'corte', 1),
(1, 'reportes', 'view', 1), (1, 'reportes', 'export', 1),
(1, 'inventario', 'view', 1), (1, 'inventario', 'create', 1), (1, 'inventario', 'edit', 1), (1, 'inventario', 'delete', 1),
(1, 'admin', 'view', 1), (1, 'admin', 'create', 1), (1, 'admin', 'edit', 1), (1, 'admin', 'delete', 1),
(1, 'cocina', 'view', 1), (1, 'cocina', 'edit', 1),
(1, 'facturacion', 'view', 1), (1, 'facturacion', 'create', 1), (1, 'facturacion', 'cancel', 1),
(1, 'lealtad', 'view', 1), (1, 'lealtad', 'create', 1), (1, 'lealtad', 'edit', 1),
(1, 'mesas', 'view', 1), (1, 'mesas', 'create', 1), (1, 'mesas', 'edit', 1);
