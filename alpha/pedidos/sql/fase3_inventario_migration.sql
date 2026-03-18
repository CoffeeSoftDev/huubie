-- =====================================================
-- FASE 3 INVENTARIO - Migracion de Base de Datos
-- Ejecutar en: fayxzvov_reginas
-- Fecha: 2026-03-17
-- =====================================================

USE `fayxzvov_reginas`;

-- 1. Unidades de medida
CREATE TABLE IF NOT EXISTS `inv_units` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `abbreviation` VARCHAR(20) NOT NULL,
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `inv_units` (`name`, `abbreviation`) VALUES
('Kilogramo', 'kg'),
('Gramo', 'g'),
('Litro', 'L'),
('Mililitro', 'ml'),
('Pieza', 'pz'),
('Caja', 'caja'),
('Bolsa', 'bolsa'),
('Paquete', 'paq');

-- 2. Proveedores
CREATE TABLE IF NOT EXISTS `inv_suppliers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `contact_name` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `address` VARCHAR(500) NULL,
    `rfc` VARCHAR(20) NULL,
    `notes` TEXT NULL,
    `subsidiary_id` INT NOT NULL,
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Insumos (materia prima)
CREATE TABLE IF NOT EXISTS `inv_supplies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(100) NULL,
    `unit_id` INT NOT NULL,
    `cost` DOUBLE DEFAULT 0,
    `stock` DOUBLE DEFAULT 0,
    `min_stock` DOUBLE DEFAULT 0,
    `max_stock` DOUBLE DEFAULT 0,
    `supplier_id` INT NULL,
    `subsidiary_id` INT NOT NULL,
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subsidiary (`subsidiary_id`),
    INDEX idx_supplier (`supplier_id`),
    INDEX idx_stock (`stock`, `min_stock`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Recetas (que insumos lleva cada producto)
CREATE TABLE IF NOT EXISTS `inv_recipes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `supply_id` INT NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit_id` INT NOT NULL,
    `active` INT DEFAULT 1,
    INDEX idx_product (`product_id`),
    INDEX idx_supply (`supply_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Kardex (historial de movimientos de inventario)
CREATE TABLE IF NOT EXISTS `inv_kardex` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `supply_id` INT NOT NULL,
    `type` ENUM('entrada','salida','ajuste','merma','venta','compra') NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `previous_stock` DOUBLE NOT NULL,
    `new_stock` DOUBLE NOT NULL,
    `cost` DOUBLE DEFAULT 0,
    `reference_id` INT NULL COMMENT 'ID de orden, compra, ajuste, etc.',
    `reference_type` VARCHAR(50) NULL COMMENT 'order, purchase_order, adjustment',
    `reason` VARCHAR(500) NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_supply (`supply_id`),
    INDEX idx_type (`type`),
    INDEX idx_date (`created_at`),
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Mermas y ajustes
CREATE TABLE IF NOT EXISTS `inv_adjustments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `supply_id` INT NOT NULL,
    `type` ENUM('merma','ajuste_positivo','ajuste_negativo','caducidad','danado') NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_supply (`supply_id`),
    INDEX idx_type (`type`),
    INDEX idx_date (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Ordenes de compra
CREATE TABLE IF NOT EXISTS `inv_purchase_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `folio` VARCHAR(50) NOT NULL,
    `supplier_id` INT NOT NULL,
    `status` ENUM('borrador','enviada','recibida','parcial','cancelada') DEFAULT 'borrador',
    `subtotal` DOUBLE DEFAULT 0,
    `tax` DOUBLE DEFAULT 0,
    `total` DOUBLE DEFAULT 0,
    `notes` TEXT NULL,
    `expected_date` DATE NULL,
    `received_date` DATE NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `active` INT DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier (`supplier_id`),
    INDEX idx_status (`status`),
    INDEX idx_subsidiary (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Detalle de ordenes de compra
CREATE TABLE IF NOT EXISTS `inv_purchase_order_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `purchase_order_id` INT NOT NULL,
    `supply_id` INT NOT NULL,
    `quantity_ordered` DOUBLE NOT NULL,
    `quantity_received` DOUBLE DEFAULT 0,
    `unit_cost` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    INDEX idx_purchase_order (`purchase_order_id`),
    INDEX idx_supply (`supply_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
