-- ============================================
-- Sistema de Turnos (Cash Shifts) - Pedidos
-- Ejecutar en: fayxzvov_reginas
-- ============================================

-- 1. Tabla principal de turnos
CREATE TABLE cash_shift (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subsidiary_id INT NOT NULL,
    employee_id INT NOT NULL,
    daily_closure_id INT NULL DEFAULT NULL,
    shift_name VARCHAR(100) NULL DEFAULT NULL,
    opened_at DATETIME NOT NULL,
    closed_at DATETIME NULL DEFAULT NULL,
    opening_amount DOUBLE DEFAULT 0,
    total_sales DOUBLE DEFAULT 0,
    total_cash DOUBLE DEFAULT 0,
    total_card DOUBLE DEFAULT 0,
    total_transfer DOUBLE DEFAULT 0,
    total_orders INT DEFAULT 0,
    status ENUM('open','closed') DEFAULT 'open',
    active INT DEFAULT 1,
    INDEX idx_subsidiary_date (subsidiary_id, opened_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Desglose de pagos por turno
CREATE TABLE shift_payment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cash_shift_id INT NOT NULL,
    payment_method_id INT NOT NULL,
    amount DOUBLE DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Conteo de estados por turno
CREATE TABLE shift_status_process (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cash_shift_id INT NOT NULL,
    status_process_id INT NOT NULL,
    amount INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Agregar columna cash_shift_id a la tabla order
ALTER TABLE `order` ADD COLUMN cash_shift_id INT NULL DEFAULT NULL AFTER daily_closure_id;
