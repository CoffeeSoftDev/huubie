-- =====================================================================
-- Alinea la fayxzvov_pos LOCAL con el archivo oficial (decision H, 13/11/2026)
-- =====================================================================
-- SOLO LOCAL. Produccion se crea con 2026-11-06_crear-fayxzvov-pos.sql,
-- que ya trae estas reglas; ahi esta migracion no cambia nada y no va en
-- el runbook de la Etapa 7.
--
-- Que hace: en 9 tablas que se crearon mas permisivas, vuelve obligatorias
-- (NOT NULL) las columnas que el archivo oficial exige y le pone a
-- updated_at su ON UPDATE CURRENT_TIMESTAMP. No toca tipos ni llaves.
--
-- Antes de correrla: la consulta del final debe dar 0 en todas las filas.
-- Si alguna da mas de 0, el ALTER de esa tabla falla (modo estricto).
-- Reversa: 2026-11-13_alinear-nulos-oficial-rollback.sql
-- =====================================================================

USE `fayxzvov_pos`;

ALTER TABLE `card_type`
  MODIFY `name`              VARCHAR(80) NOT NULL,
  MODIFY `discount_percent`  DOUBLE NOT NULL DEFAULT 0,
  MODIFY `points_percent`    DOUBLE NOT NULL DEFAULT 0,
  MODIFY `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `active`            TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `category`
  MODIFY `name`        VARCHAR(255) NOT NULL,
  MODIFY `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `active`      TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `customer`
  MODIFY `name`            VARCHAR(255) NOT NULL,
  MODIFY `wallet`          DOUBLE NOT NULL DEFAULT 0,
  MODIFY `credit_limit`    DOUBLE NOT NULL DEFAULT 0,
  MODIFY `credit_enabled`  TINYINT NOT NULL DEFAULT 0,
  MODIFY `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `active`          TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `card`
  MODIFY `number`      VARCHAR(40) NOT NULL,
  MODIFY `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `active`      TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `daily_closure`
  MODIFY `sales_count`      INT NOT NULL DEFAULT 0,
  MODIFY `cancelled_count`  INT NOT NULL DEFAULT 0,
  MODIFY `orders_count`     INT NOT NULL DEFAULT 0,
  MODIFY `turns_count`      INT NOT NULL DEFAULT 0,
  MODIFY `subtotal`         DOUBLE NOT NULL DEFAULT 0,
  MODIFY `discount`         DOUBLE NOT NULL DEFAULT 0,
  MODIFY `tax`              DOUBLE NOT NULL DEFAULT 0,
  MODIFY `tip`              DOUBLE NOT NULL DEFAULT 0,
  MODIFY `total`            DOUBLE NOT NULL DEFAULT 0,
  MODIFY `total_shifts`     DOUBLE NOT NULL DEFAULT 0,
  MODIFY `total_cash`       DOUBLE NOT NULL DEFAULT 0,
  MODIFY `cash_in`          DOUBLE NOT NULL DEFAULT 0,
  MODIFY `cash_out`         DOUBLE NOT NULL DEFAULT 0,
  MODIFY `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `active`           TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `turn_payment`
  MODIFY `amount`      DOUBLE NOT NULL DEFAULT 0,
  MODIFY `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `turn_id`     INT NOT NULL,
  MODIFY `active`      TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `turn_status`
  MODIFY `amount`      DOUBLE NOT NULL DEFAULT 0,
  MODIFY `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `turn_id`     INT NOT NULL,
  MODIFY `active`      TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `daily_closure_payment`
  MODIFY `payments_count`    INT NOT NULL DEFAULT 0,
  MODIFY `amount`            DOUBLE NOT NULL DEFAULT 0,
  MODIFY `tip`               DOUBLE NOT NULL DEFAULT 0,
  MODIFY `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `daily_closure_id`  INT NOT NULL,
  MODIFY `active`            TINYINT NOT NULL DEFAULT 1;

ALTER TABLE `daily_closure_status`
  MODIFY `amount`            DOUBLE NOT NULL DEFAULT 0,
  MODIFY `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  MODIFY `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  MODIFY `daily_closure_id`  INT NOT NULL,
  MODIFY `active`            TINYINT NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------
-- Comprobacion (correrla ANTES y DESPUES): todo en 0.
-- ---------------------------------------------------------------------
-- SELECT 'card' t, COUNT(*) n FROM card WHERE number IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'card_type', COUNT(*) FROM card_type WHERE name IS NULL OR discount_percent IS NULL OR points_percent IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'category', COUNT(*) FROM category WHERE name IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'customer', COUNT(*) FROM customer WHERE name IS NULL OR wallet IS NULL OR credit_limit IS NULL OR credit_enabled IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'turn_payment', COUNT(*) FROM turn_payment WHERE amount IS NULL OR turn_id IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'turn_status', COUNT(*) FROM turn_status WHERE amount IS NULL OR turn_id IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'daily_closure_payment', COUNT(*) FROM daily_closure_payment WHERE payments_count IS NULL OR amount IS NULL OR tip IS NULL OR daily_closure_id IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL
-- UNION ALL SELECT 'daily_closure_status', COUNT(*) FROM daily_closure_status WHERE amount IS NULL OR daily_closure_id IS NULL OR created_at IS NULL OR updated_at IS NULL OR active IS NULL;
