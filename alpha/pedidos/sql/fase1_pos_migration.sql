-- =====================================================
-- FASE 1 POS - Migracion de Base de Datos
-- Ejecutar en: fayxzvov_reginas
-- Fecha: 2026-03-17
-- =====================================================

USE `fayxzvov_reginas`;

-- 1. Tabla de movimientos de caja (retiros, depositos, gastos operativos)
CREATE TABLE IF NOT EXISTS `cash_shift_movements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `cash_shift_id` INT NOT NULL,
    `type` ENUM('retiro','deposito','gasto') NOT NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `reason` VARCHAR(255) NULL,
    `employee_id` INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active` INT DEFAULT 1,
    INDEX idx_shift (`cash_shift_id`),
    INDEX idx_type (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Agregar columnas a cash_shift para Corte Z (cuadre de caja)
ALTER TABLE `cash_shift`
    ADD COLUMN `closing_cash_counted` DOUBLE NULL DEFAULT NULL COMMENT 'Efectivo contado al cerrar (Corte Z)',
    ADD COLUMN `cash_difference` DOUBLE NULL DEFAULT NULL COMMENT 'Diferencia entre esperado y contado',
    ADD COLUMN `folio_z` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Folio unico del Corte Z',
    ADD COLUMN `total_discount` DOUBLE DEFAULT 0 COMMENT 'Total de descuentos del turno',
    ADD COLUMN `total_cancelled` DOUBLE DEFAULT 0 COMMENT 'Total de ventas canceladas',
    ADD COLUMN `total_tips` DOUBLE DEFAULT 0 COMMENT 'Total de propinas';

-- 3. Tabla de registro historico de Cortes X
CREATE TABLE IF NOT EXISTS `corte_x_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `cash_shift_id` INT NOT NULL,
    `employee_id` INT NOT NULL,
    `subsidiary_id` INT NOT NULL,
    `generated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `total_sales` DOUBLE DEFAULT 0,
    `total_cash` DOUBLE DEFAULT 0,
    `total_card` DOUBLE DEFAULT 0,
    `total_transfer` DOUBLE DEFAULT 0,
    `total_orders` INT DEFAULT 0,
    `opening_amount` DOUBLE DEFAULT 0,
    `total_retiros` DOUBLE DEFAULT 0,
    `total_depositos` DOUBLE DEFAULT 0,
    `cash_in_drawer` DOUBLE DEFAULT 0 COMMENT 'Efectivo esperado en caja',
    `total_discount` DOUBLE DEFAULT 0,
    `total_cancelled` DOUBLE DEFAULT 0,
    INDEX idx_shift (`cash_shift_id`),
    INDEX idx_date (`generated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Agregar campo order_type a la tabla order para distinguir pedido vs venta directa
ALTER TABLE `order`
    ADD COLUMN `order_type` ENUM('pedido','mostrador') DEFAULT 'pedido' COMMENT 'Tipo: pedido anticipado o venta directa mostrador';

-- 5. Agregar campo tip (propina) a order_payments
ALTER TABLE `order_payments`
    ADD COLUMN `tip` DOUBLE DEFAULT 0 COMMENT 'Propina incluida en este pago';
