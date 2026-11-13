-- =====================================================================
-- Reversa de 2026-11-13_alinear-nulos-oficial.sql (SOLO LOCAL)
-- =====================================================================
-- Deja las 9 tablas como estaban en local antes del 13/11/2026: columnas
-- que aceptan NULL y updated_at sin ON UPDATE. No borra datos.
-- =====================================================================

USE `fayxzvov_pos`;

ALTER TABLE `card_type`
  MODIFY `name`              VARCHAR(80) NULL DEFAULT NULL,
  MODIFY `discount_percent`  DOUBLE NULL DEFAULT 0,
  MODIFY `points_percent`    DOUBLE NULL DEFAULT 0,
  MODIFY `created_at`        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `active`            TINYINT NULL DEFAULT 1;

ALTER TABLE `category`
  MODIFY `name`        VARCHAR(255) NULL DEFAULT NULL,
  MODIFY `created_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `active`      TINYINT NULL DEFAULT 1;

ALTER TABLE `customer`
  MODIFY `name`            VARCHAR(255) NULL DEFAULT NULL,
  MODIFY `wallet`          DOUBLE NULL DEFAULT 0,
  MODIFY `credit_limit`    DOUBLE NULL DEFAULT 0,
  MODIFY `credit_enabled`  TINYINT NULL DEFAULT 0,
  MODIFY `created_at`      DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`      DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `active`          TINYINT NULL DEFAULT 1;

ALTER TABLE `card`
  MODIFY `number`      VARCHAR(40) NULL DEFAULT NULL,
  MODIFY `created_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `active`      TINYINT NULL DEFAULT 1;

ALTER TABLE `daily_closure`
  MODIFY `sales_count`      INT NULL DEFAULT 0,
  MODIFY `cancelled_count`  INT NULL DEFAULT 0,
  MODIFY `orders_count`     INT NULL DEFAULT 0,
  MODIFY `turns_count`      INT NULL DEFAULT 0,
  MODIFY `subtotal`         DOUBLE NULL DEFAULT 0,
  MODIFY `discount`         DOUBLE NULL DEFAULT 0,
  MODIFY `tax`              DOUBLE NULL DEFAULT 0,
  MODIFY `tip`              DOUBLE NULL DEFAULT 0,
  MODIFY `total`            DOUBLE NULL DEFAULT 0,
  MODIFY `total_shifts`     DOUBLE NULL DEFAULT 0,
  MODIFY `total_cash`       DOUBLE NULL DEFAULT 0,
  MODIFY `cash_in`          DOUBLE NULL DEFAULT 0,
  MODIFY `cash_out`         DOUBLE NULL DEFAULT 0,
  MODIFY `created_at`       DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`       DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `active`           TINYINT NULL DEFAULT 1;

ALTER TABLE `turn_payment`
  MODIFY `amount`      DOUBLE NULL DEFAULT 0,
  MODIFY `created_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `turn_id`     INT NULL DEFAULT NULL,
  MODIFY `active`      TINYINT NULL DEFAULT 1;

ALTER TABLE `turn_status`
  MODIFY `amount`      DOUBLE NULL DEFAULT 0,
  MODIFY `created_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `turn_id`     INT NULL DEFAULT NULL,
  MODIFY `active`      TINYINT NULL DEFAULT 1;

ALTER TABLE `daily_closure_payment`
  MODIFY `payments_count`    INT NULL DEFAULT 0,
  MODIFY `amount`            DOUBLE NULL DEFAULT 0,
  MODIFY `tip`               DOUBLE NULL DEFAULT 0,
  MODIFY `created_at`        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `daily_closure_id`  INT NULL DEFAULT NULL,
  MODIFY `active`            TINYINT NULL DEFAULT 1;

ALTER TABLE `daily_closure_status`
  MODIFY `amount`            DOUBLE NULL DEFAULT 0,
  MODIFY `created_at`        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`        DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `daily_closure_id`  INT NULL DEFAULT NULL,
  MODIFY `active`            TINYINT NULL DEFAULT 1;
