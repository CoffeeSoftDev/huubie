-- ============================================================
-- MIGRACIÓN FASE 0: Cierre Parcial Legacy
-- Fecha de corte: 2026-03-29
-- Ejecutar UNA SOLA VEZ antes de implementar el nuevo sistema
-- ============================================================

-- 1. Agregar columna is_legacy a order
ALTER TABLE fayxzvov_reginas.`order`
  ADD COLUMN `is_legacy` TINYINT(1) NOT NULL DEFAULT 0 AFTER `cash_shift_id`;

ALTER TABLE fayxzvov_reginas.`order`
  ADD INDEX `idx_legacy` (`is_legacy`);

-- 2. Marcar tickets existentes como legacy (119 registros hasta 2026-03-29)
UPDATE fayxzvov_reginas.`order`
SET is_legacy = 1
WHERE date_creation <= '2026-03-29 23:59:59';

-- 3. Ampliar tabla daily_closure con columnas necesarias
ALTER TABLE fayxzvov_reginas.daily_closure
  ADD COLUMN `closure_date` DATE NULL AFTER `subsidiary_id`,
  ADD COLUMN `total_shifts` INT DEFAULT 0 AFTER `total_orders`,
  ADD COLUMN `total_cash` DOUBLE DEFAULT 0 AFTER `total`,
  ADD COLUMN `total_card` DOUBLE DEFAULT 0 AFTER `total_cash`,
  ADD COLUMN `total_transfer` DOUBLE DEFAULT 0 AFTER `total_card`,
  ADD COLUMN `total_discount` DOUBLE DEFAULT 0 AFTER `total_transfer`,
  ADD COLUMN `status` VARCHAR(20) DEFAULT 'closed' AFTER `total_discount`,
  ADD COLUMN `reopened_by` INT NULL AFTER `status`,
  ADD COLUMN `reopened_at` DATETIME NULL AFTER `reopened_by`,
  ADD COLUMN `reopen_reason` VARCHAR(255) NULL AFTER `reopened_at`,
  ADD COLUMN `is_legacy` TINYINT(1) NOT NULL DEFAULT 0 AFTER `reopen_reason`;

ALTER TABLE fayxzvov_reginas.daily_closure
  ADD INDEX `idx_closure_date_sub` (`closure_date`, `subsidiary_id`);

-- 4. Marcar el registro existente (id=2) como legacy
UPDATE fayxzvov_reginas.daily_closure
SET is_legacy = 1, closure_date = DATE(created_at)
WHERE id = 2;

-- 5. Insertar cierres legacy por cada sucursal con tickets
INSERT INTO fayxzvov_reginas.daily_closure
  (total, tax, subtotal, created_at, active, total_orders, employee_id, subsidiary_id, closure_date, total_shifts, total_cash, total_card, total_transfer, total_discount, status, is_legacy)
SELECT
  COALESCE(SUM(o.total_pay), 0),
  0,
  COALESCE(SUM(o.total_pay), 0),
  NOW(),
  1,
  COUNT(*),
  NULL,
  o.subsidiaries_id,
  '2026-03-29',
  0, 0, 0, 0, 0,
  'closed',
  1
FROM fayxzvov_reginas.`order` o
WHERE o.is_legacy = 1 AND o.status != 4
  AND o.subsidiaries_id NOT IN (SELECT subsidiary_id FROM fayxzvov_reginas.daily_closure WHERE is_legacy = 1)
GROUP BY o.subsidiaries_id;

-- 6. Vincular tickets legacy a su registro de cierre
UPDATE fayxzvov_reginas.`order` o
INNER JOIN fayxzvov_reginas.daily_closure dc
  ON dc.subsidiary_id = o.subsidiaries_id AND dc.is_legacy = 1
SET o.daily_closure_id = dc.id
WHERE o.is_legacy = 1;

-- 7. Índice único para evitar cierres duplicados
ALTER TABLE fayxzvov_reginas.daily_closure
  ADD UNIQUE INDEX `idx_unique_closure` (`closure_date`, `subsidiary_id`, `is_legacy`);
