-- ════════════════════════════════════════════════════════════════════
--  Inventarios — DDL POS (sin Fase 2 / Insumos)
--  Target : fayxzvov_reginas  (tablas dentro del schema reginas)
--  Server : MySQL 5.7.36  ->  collation utf8mb4_unicode_ci
--  Cross-schema FKs:
--     companies_id     -> fayxzvov_admin.companies(id)
--     subsidiaries_id  -> fayxzvov_alpha.subsidiaries(id)
--     *_user_id        -> fayxzvov_alpha.usr_users(id)
--     product_id       -> fayxzvov_reginas.order_products(id)  (mismo schema)
-- ════════════════════════════════════════════════════════════════════

USE `fayxzvov_reginas`;

SET NAMES utf8mb4;

-- ── §3.2 Catálogos del módulo ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS `warehouse_area` (
    `id`            INT NOT NULL AUTO_INCREMENT,
    `name`          VARCHAR(80)  NOT NULL,
    `description`   VARCHAR(255) NULL,
    `color_hex`     VARCHAR(7)   NULL,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`        TINYINT(1)   NOT NULL DEFAULT 1,
    `companies_id`  INT          NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_warehouse_area_name` (`name`, `companies_id`),
    KEY `companies_id` (`companies_id`),
    CONSTRAINT `warehouse_area_ibfk_1` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `unit` (
    `id`         INT NOT NULL AUTO_INCREMENT,
    `code`       VARCHAR(10) NOT NULL,
    `name`       VARCHAR(40) NOT NULL,
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`     TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_unit_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `name`         VARCHAR(180) NOT NULL,
    `contact_name` VARCHAR(120) NULL,
    `phone`        VARCHAR(40)  NULL,
    `email`        VARCHAR(120) NULL,
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`       TINYINT(1)   NOT NULL DEFAULT 1,
    `companies_id` INT          NOT NULL,
    PRIMARY KEY (`id`),
    KEY `companies_id` (`companies_id`),
    CONSTRAINT `supplier_ibfk_1` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inflow_origin` (
    `id`                INT NOT NULL AUTO_INCREMENT,
    `code`              VARCHAR(30) NOT NULL,
    `name`              VARCHAR(80) NOT NULL,
    `icon`              VARCHAR(40) NULL,
    `color_hex`         VARCHAR(7)  NULL,
    `requires_supplier` TINYINT(1)  NOT NULL DEFAULT 0,
    `created_at`        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`            TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inflow_origin_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shrinkage_reason` (
    `id`         INT NOT NULL AUTO_INCREMENT,
    `code`       VARCHAR(30) NOT NULL,
    `name`       VARCHAR(80) NOT NULL,
    `icon`       VARCHAR(40) NULL,
    `color_hex`  VARCHAR(7)  NULL,
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`     TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shrinkage_reason_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `adjustment_reason` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `code`         VARCHAR(30) NOT NULL,
    `name`         VARCHAR(80) NOT NULL,
    `icon`         VARCHAR(40) NULL,
    `color_hex`    VARCHAR(7)  NULL,
    `affects_cost` TINYINT(1)  NOT NULL DEFAULT 1,
    `created_at`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`       TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_adjustment_reason_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `transfer_status` (
    `id`          INT NOT NULL AUTO_INCREMENT,
    `code`        VARCHAR(30) NOT NULL,
    `name`        VARCHAR(60) NOT NULL,
    `order_index` TINYINT     NOT NULL DEFAULT 1,
    `is_terminal` TINYINT(1)  NOT NULL DEFAULT 0,
    `color_hex`   VARCHAR(7)  NULL,
    `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`      TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_transfer_status_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `warehouse` (
    `id`                INT NOT NULL AUTO_INCREMENT,
    `name`              VARCHAR(120) NOT NULL,
    `is_default`        TINYINT(1)   NOT NULL DEFAULT 0,
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`            TINYINT(1)   NOT NULL DEFAULT 1,
    `warehouse_area_id` INT          NULL,
    `subsidiaries_id`   INT          NOT NULL,
    `companies_id`      INT          NOT NULL,
    PRIMARY KEY (`id`),
    KEY `subsidiaries_id` (`subsidiaries_id`),
    KEY `companies_id` (`companies_id`),
    KEY `warehouse_area_id` (`warehouse_area_id`),
    CONSTRAINT `warehouse_ibfk_1` FOREIGN KEY (`warehouse_area_id`)
        REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL,
    CONSTRAINT `warehouse_ibfk_2` FOREIGN KEY (`subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `warehouse_ibfk_3` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_attribute` (
    `id`                INT NOT NULL AUTO_INCREMENT,
    `sku`               VARCHAR(40)  NOT NULL,
    `description`       VARCHAR(255) NULL,
    `shelf_life_days`   INT          NULL,
    `cost_unit`         DOUBLE       NOT NULL DEFAULT 0,
    `stock_min`         DOUBLE       NOT NULL DEFAULT 0,
    `stock_max`         DOUBLE       NOT NULL DEFAULT 0,
    `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `active`            TINYINT(1)   NOT NULL DEFAULT 1,
    `product_id`        INT          NOT NULL,
    `companies_id`      INT          NOT NULL,
    `warehouse_area_id` INT          NULL,
    `unit_id`           INT          NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_product_attribute_product` (`product_id`),
    UNIQUE KEY `uq_product_attribute_sku` (`sku`, `companies_id`),
    KEY `companies_id` (`companies_id`),
    KEY `warehouse_area_id` (`warehouse_area_id`),
    KEY `unit_id` (`unit_id`),
    CONSTRAINT `product_attribute_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`) ON DELETE CASCADE,
    CONSTRAINT `product_attribute_ibfk_2` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `product_attribute_ibfk_3` FOREIGN KEY (`warehouse_area_id`)
        REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL,
    CONSTRAINT `product_attribute_ibfk_4` FOREIGN KEY (`unit_id`)
        REFERENCES `unit` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.3 Stock ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `stock` (
    `id`                INT NOT NULL AUTO_INCREMENT,
    `quantity`          DOUBLE   NOT NULL DEFAULT 0,
    `last_movement_at`  DATETIME NULL,
    `last_inventory_at` DATETIME NULL,
    `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `active`            TINYINT(1) NOT NULL DEFAULT 1,
    `product_id`        INT NOT NULL,
    `companies_id`      INT NOT NULL,
    `warehouse_id`      INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_stock_product_warehouse` (`product_id`, `warehouse_id`),
    KEY `companies_id` (`companies_id`),
    KEY `warehouse_id` (`warehouse_id`),
    CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`),
    CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `stock_ibfk_3` FOREIGN KEY (`warehouse_id`)
        REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.4.1 Entradas ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `inventory_inflow` (
    `id`               INT NOT NULL AUTO_INCREMENT,
    `folio`            VARCHAR(20)  NOT NULL,
    `note`             VARCHAR(500) NULL,
    `total_products`   INT    NOT NULL DEFAULT 0,
    `total_units`      DOUBLE NOT NULL DEFAULT 0,
    `total_cost`       DOUBLE NOT NULL DEFAULT 0,
    `date_inflow`      DATE   NOT NULL,
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `status`           ENUM('Pendiente','Aplicada','Cancelada') NOT NULL DEFAULT 'Aplicada',
    `active`           TINYINT(1) NOT NULL DEFAULT 1,
    `subsidiaries_id`  INT NOT NULL,
    `user_id`          INT NOT NULL,
    `companies_id`     INT NOT NULL,
    `inflow_origin_id` INT NOT NULL,
    `warehouse_id`     INT NOT NULL,
    `supplier_id`      INT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inventory_inflow_folio` (`folio`, `companies_id`),
    KEY `status` (`status`),
    KEY `date_inflow` (`date_inflow`),
    KEY `subsidiaries_id` (`subsidiaries_id`),
    KEY `user_id` (`user_id`),
    KEY `companies_id` (`companies_id`),
    KEY `inflow_origin_id` (`inflow_origin_id`),
    KEY `warehouse_id` (`warehouse_id`),
    KEY `supplier_id` (`supplier_id`),
    CONSTRAINT `inventory_inflow_ibfk_1` FOREIGN KEY (`subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `inventory_inflow_ibfk_2` FOREIGN KEY (`user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_inflow_ibfk_3` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `inventory_inflow_ibfk_4` FOREIGN KEY (`inflow_origin_id`)
        REFERENCES `inflow_origin` (`id`),
    CONSTRAINT `inventory_inflow_ibfk_5` FOREIGN KEY (`warehouse_id`)
        REFERENCES `warehouse` (`id`),
    CONSTRAINT `inventory_inflow_ibfk_6` FOREIGN KEY (`supplier_id`)
        REFERENCES `supplier` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detail_inventory_inflow` (
    `id`                 INT NOT NULL AUTO_INCREMENT,
    `batch_code`         VARCHAR(40) NULL,
    `quantity`           DOUBLE NOT NULL DEFAULT 0,
    `cost`               DOUBLE NOT NULL DEFAULT 0,
    `subtotal`           DOUBLE NOT NULL DEFAULT 0,
    `previous_stock`     DOUBLE NOT NULL DEFAULT 0,
    `resulting_stock`    DOUBLE NOT NULL DEFAULT 0,
    `expires_at`         DATE NULL,
    `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`             TINYINT(1) NOT NULL DEFAULT 1,
    `product_id`         INT NOT NULL,
    `inventory_inflow_id` INT NOT NULL,
    `unit_id`            INT NULL,
    PRIMARY KEY (`id`),
    KEY `product_id` (`product_id`),
    KEY `inventory_inflow_id` (`inventory_inflow_id`),
    KEY `unit_id` (`unit_id`),
    CONSTRAINT `detail_inventory_inflow_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`),
    CONSTRAINT `detail_inventory_inflow_ibfk_2` FOREIGN KEY (`inventory_inflow_id`)
        REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE,
    CONSTRAINT `detail_inventory_inflow_ibfk_3` FOREIGN KEY (`unit_id`)
        REFERENCES `unit` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.4.2 Mermas ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `inventory_shrinkage` (
    `id`                 INT NOT NULL AUTO_INCREMENT,
    `folio`              VARCHAR(20)  NOT NULL,
    `note`               VARCHAR(500) NULL,
    `evidence_url`       VARCHAR(255) NULL,
    `total_products`     INT    NOT NULL DEFAULT 0,
    `total_units`        DOUBLE NOT NULL DEFAULT 0,
    `total_cost_loss`    DOUBLE NOT NULL DEFAULT 0,
    `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `status`             ENUM('Aplicada','Revertida') NOT NULL DEFAULT 'Aplicada',
    `active`             TINYINT(1) NOT NULL DEFAULT 1,
    `subsidiaries_id`    INT NOT NULL,
    `user_id`            INT NOT NULL,
    `companies_id`       INT NOT NULL,
    `shrinkage_reason_id` INT NOT NULL,
    `warehouse_id`       INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inventory_shrinkage_folio` (`folio`, `companies_id`),
    KEY `status` (`status`),
    KEY `subsidiaries_id` (`subsidiaries_id`),
    KEY `user_id` (`user_id`),
    KEY `companies_id` (`companies_id`),
    KEY `shrinkage_reason_id` (`shrinkage_reason_id`),
    KEY `warehouse_id` (`warehouse_id`),
    CONSTRAINT `inventory_shrinkage_ibfk_1` FOREIGN KEY (`subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `inventory_shrinkage_ibfk_2` FOREIGN KEY (`user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_shrinkage_ibfk_3` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `inventory_shrinkage_ibfk_4` FOREIGN KEY (`shrinkage_reason_id`)
        REFERENCES `shrinkage_reason` (`id`),
    CONSTRAINT `inventory_shrinkage_ibfk_5` FOREIGN KEY (`warehouse_id`)
        REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detail_inventory_shrinkage` (
    `id`                   INT NOT NULL AUTO_INCREMENT,
    `quantity`             DOUBLE NOT NULL DEFAULT 0,
    `cost`                 DOUBLE NOT NULL DEFAULT 0,
    `subtotal_loss`        DOUBLE NOT NULL DEFAULT 0,
    `previous_stock`       DOUBLE NOT NULL DEFAULT 0,
    `resulting_stock`      DOUBLE NOT NULL DEFAULT 0,
    `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`               TINYINT(1) NOT NULL DEFAULT 1,
    `product_id`           INT NOT NULL,
    `inventory_shrinkage_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `product_id` (`product_id`),
    KEY `inventory_shrinkage_id` (`inventory_shrinkage_id`),
    CONSTRAINT `detail_inventory_shrinkage_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`),
    CONSTRAINT `detail_inventory_shrinkage_ibfk_2` FOREIGN KEY (`inventory_shrinkage_id`)
        REFERENCES `inventory_shrinkage` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.4.3 Traspasos ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `inventory_transfer` (
    `id`                          INT NOT NULL AUTO_INCREMENT,
    `folio`                       VARCHAR(20)  NOT NULL,
    `note`                        VARCHAR(500) NULL,
    `total_products`              INT    NOT NULL DEFAULT 0,
    `total_units`                 DOUBLE NOT NULL DEFAULT 0,
    `total_cost`                  DOUBLE NOT NULL DEFAULT 0,
    `date_request`                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `date_authorized`             DATETIME NULL,
    `date_sent`                   DATETIME NULL,
    `date_received`               DATETIME NULL,
    `created_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `active`                      TINYINT(1) NOT NULL DEFAULT 1,
    `status_id`                   INT NOT NULL,
    `origin_subsidiaries_id`      INT NOT NULL,
    `destination_subsidiaries_id` INT NOT NULL,
    `requested_user_id`           INT NOT NULL,
    `authorized_user_id`          INT NULL,
    `received_user_id`            INT NULL,
    `companies_id`                INT NOT NULL,
    `origin_warehouse_id`         INT NOT NULL,
    `destination_warehouse_id`    INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inventory_transfer_folio` (`folio`, `companies_id`),
    KEY `status_id` (`status_id`),
    KEY `origin_subsidiaries_id` (`origin_subsidiaries_id`),
    KEY `destination_subsidiaries_id` (`destination_subsidiaries_id`),
    KEY `requested_user_id` (`requested_user_id`),
    KEY `authorized_user_id` (`authorized_user_id`),
    KEY `received_user_id` (`received_user_id`),
    KEY `companies_id` (`companies_id`),
    KEY `origin_warehouse_id` (`origin_warehouse_id`),
    KEY `destination_warehouse_id` (`destination_warehouse_id`),
    CONSTRAINT `inventory_transfer_ibfk_1` FOREIGN KEY (`status_id`)
        REFERENCES `transfer_status` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_2` FOREIGN KEY (`origin_subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_3` FOREIGN KEY (`destination_subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_4` FOREIGN KEY (`requested_user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_5` FOREIGN KEY (`authorized_user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_6` FOREIGN KEY (`received_user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_7` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_8` FOREIGN KEY (`origin_warehouse_id`)
        REFERENCES `warehouse` (`id`),
    CONSTRAINT `inventory_transfer_ibfk_9` FOREIGN KEY (`destination_warehouse_id`)
        REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detail_inventory_transfer` (
    `id`                     INT NOT NULL AUTO_INCREMENT,
    `quantity`               DOUBLE NOT NULL DEFAULT 0,
    `cost`                   DOUBLE NOT NULL DEFAULT 0,
    `subtotal`               DOUBLE NOT NULL DEFAULT 0,
    `origin_stock_prev`      DOUBLE NOT NULL DEFAULT 0,
    `origin_stock_post`      DOUBLE NOT NULL DEFAULT 0,
    `destination_stock_prev` DOUBLE NULL,
    `destination_stock_post` DOUBLE NULL,
    `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`                 TINYINT(1) NOT NULL DEFAULT 1,
    `product_id`             INT NOT NULL,
    `inventory_transfer_id`  INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `product_id` (`product_id`),
    KEY `inventory_transfer_id` (`inventory_transfer_id`),
    CONSTRAINT `detail_inventory_transfer_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`),
    CONSTRAINT `detail_inventory_transfer_ibfk_2` FOREIGN KEY (`inventory_transfer_id`)
        REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inventory_transfer_history` (
    `id`                    INT NOT NULL AUTO_INCREMENT,
    `note`                  VARCHAR(500) NULL,
    `transitioned_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`                TINYINT(1) NOT NULL DEFAULT 1,
    `status_id`             INT NOT NULL,
    `user_id`               INT NOT NULL,
    `inventory_transfer_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `status_id` (`status_id`),
    KEY `user_id` (`user_id`),
    KEY `inventory_transfer_id` (`inventory_transfer_id`),
    CONSTRAINT `inventory_transfer_history_ibfk_1` FOREIGN KEY (`status_id`)
        REFERENCES `transfer_status` (`id`),
    CONSTRAINT `inventory_transfer_history_ibfk_2` FOREIGN KEY (`user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_transfer_history_ibfk_3` FOREIGN KEY (`inventory_transfer_id`)
        REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.4.4 Ajustes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `inventory_adjustment` (
    `id`                   INT NOT NULL AUTO_INCREMENT,
    `folio`                VARCHAR(20)  NOT NULL,
    `note`                 VARCHAR(500) NULL,
    `adjustment_type`      ENUM('individual','fisico') NOT NULL DEFAULT 'individual',
    `total_products`       INT    NOT NULL DEFAULT 0,
    `total_diff_units`     DOUBLE NOT NULL DEFAULT 0,
    `total_diff_cost`      DOUBLE NOT NULL DEFAULT 0,
    `date_adjustment`      DATE NOT NULL,
    `time_adjustment`      TIME NULL,
    `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `status`               ENUM('Pendiente','Aplicado','Revertido') NOT NULL DEFAULT 'Aplicado',
    `active`               TINYINT(1) NOT NULL DEFAULT 1,
    `subsidiaries_id`      INT NOT NULL,
    `registered_user_id`   INT NOT NULL,
    `authorized_user_id`   INT NULL,
    `companies_id`         INT NOT NULL,
    `adjustment_reason_id` INT NOT NULL,
    `warehouse_id`         INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inventory_adjustment_folio` (`folio`, `companies_id`),
    KEY `status` (`status`),
    KEY `date_adjustment` (`date_adjustment`),
    KEY `subsidiaries_id` (`subsidiaries_id`),
    KEY `registered_user_id` (`registered_user_id`),
    KEY `authorized_user_id` (`authorized_user_id`),
    KEY `companies_id` (`companies_id`),
    KEY `adjustment_reason_id` (`adjustment_reason_id`),
    KEY `warehouse_id` (`warehouse_id`),
    CONSTRAINT `inventory_adjustment_ibfk_1` FOREIGN KEY (`subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `inventory_adjustment_ibfk_2` FOREIGN KEY (`registered_user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_adjustment_ibfk_3` FOREIGN KEY (`authorized_user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`),
    CONSTRAINT `inventory_adjustment_ibfk_4` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `inventory_adjustment_ibfk_5` FOREIGN KEY (`adjustment_reason_id`)
        REFERENCES `adjustment_reason` (`id`),
    CONSTRAINT `inventory_adjustment_ibfk_6` FOREIGN KEY (`warehouse_id`)
        REFERENCES `warehouse` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detail_inventory_adjustment` (
    `id`                      INT NOT NULL AUTO_INCREMENT,
    `system_quantity`         DOUBLE NOT NULL DEFAULT 0,
    `physical_quantity`       DOUBLE NOT NULL DEFAULT 0,
    `difference`              DOUBLE NOT NULL DEFAULT 0,
    `cost`                    DOUBLE NOT NULL DEFAULT 0,
    `cost_diff`               DOUBLE NOT NULL DEFAULT 0,
    `previous_stock`          DOUBLE NOT NULL DEFAULT 0,
    `resulting_stock`         DOUBLE NOT NULL DEFAULT 0,
    `created_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`                  TINYINT(1) NOT NULL DEFAULT 1,
    `product_id`              INT NOT NULL,
    `inventory_adjustment_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `product_id` (`product_id`),
    KEY `inventory_adjustment_id` (`inventory_adjustment_id`),
    CONSTRAINT `detail_inventory_adjustment_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`),
    CONSTRAINT `detail_inventory_adjustment_ibfk_2` FOREIGN KEY (`inventory_adjustment_id`)
        REFERENCES `inventory_adjustment` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.4.bis Formatos preguardados de entradas ──────────────────────

CREATE TABLE IF NOT EXISTS `inflow_format` (
    `id`               INT NOT NULL AUTO_INCREMENT,
    `name`             VARCHAR(120) NOT NULL,
    `description`      VARCHAR(255) NULL,
    `scope`            ENUM('user','subsidiary','company') NOT NULL DEFAULT 'user',
    `total_products`   INT    NOT NULL DEFAULT 0,
    `total_units`      DOUBLE NOT NULL DEFAULT 0,
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `active`           TINYINT(1) NOT NULL DEFAULT 1,
    `inflow_origin_id` INT NULL,
    `subsidiaries_id`  INT NULL,
    `companies_id`     INT NOT NULL,
    `user_id`          INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `scope` (`scope`),
    KEY `inflow_origin_id` (`inflow_origin_id`),
    KEY `subsidiaries_id` (`subsidiaries_id`),
    KEY `companies_id` (`companies_id`),
    KEY `user_id` (`user_id`),
    CONSTRAINT `inflow_format_ibfk_1` FOREIGN KEY (`inflow_origin_id`)
        REFERENCES `inflow_origin` (`id`) ON DELETE SET NULL,
    CONSTRAINT `inflow_format_ibfk_2` FOREIGN KEY (`subsidiaries_id`)
        REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`),
    CONSTRAINT `inflow_format_ibfk_3` FOREIGN KEY (`companies_id`)
        REFERENCES `fayxzvov_admin`.`companies` (`id`),
    CONSTRAINT `inflow_format_ibfk_4` FOREIGN KEY (`user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detail_inflow_format` (
    `id`              INT NOT NULL AUTO_INCREMENT,
    `quantity`        DOUBLE NOT NULL DEFAULT 0,
    `position`        INT NOT NULL DEFAULT 0,
    `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `active`          TINYINT(1) NOT NULL DEFAULT 1,
    `product_id`      INT NOT NULL,
    `inflow_format_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `product_id` (`product_id`),
    KEY `inflow_format_id` (`inflow_format_id`),
    CONSTRAINT `detail_inflow_format_ibfk_1` FOREIGN KEY (`product_id`)
        REFERENCES `order_products` (`id`),
    CONSTRAINT `detail_inflow_format_ibfk_2` FOREIGN KEY (`inflow_format_id`)
        REFERENCES `inflow_format` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §5.2 Secuencias de folio ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `folio_sequence` (
    `companies_id`  INT NOT NULL,
    `sequence_code` VARCHAR(20) NOT NULL,
    `last_number`   INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`companies_id`, `sequence_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── §3.5 Bitácora unificada (VIEW) ──────────────────────────────────

CREATE OR REPLACE VIEW `inventory_movement` AS
    SELECT
        CONCAT('IN-', d.id)  AS movement_uid,
        'ENTRADA'            AS movement_type,
        r.folio              AS folio,
        d.product_id         AS product_id,
        d.quantity           AS quantity,
        d.previous_stock     AS stock_prev,
        d.resulting_stock    AS stock_post,
        d.cost               AS cost_unit,
        d.subtotal           AS cost_total,
        r.date_inflow        AS occurred_at,
        r.warehouse_id       AS warehouse_id,
        r.subsidiaries_id    AS subsidiaries_id,
        r.user_id            AS user_id,
        r.note               AS note,
        r.status             AS status,
        r.companies_id       AS companies_id
    FROM `detail_inventory_inflow` d
    JOIN `inventory_inflow` r ON r.id = d.inventory_inflow_id
    WHERE d.active = 1 AND r.active = 1

    UNION ALL

    SELECT
        CONCAT('SH-', d.id), 'MERMA', r.folio, d.product_id, d.quantity,
        d.previous_stock, d.resulting_stock, d.cost, d.subtotal_loss,
        r.created_at, r.warehouse_id, r.subsidiaries_id, r.user_id,
        r.note, r.status, r.companies_id
    FROM `detail_inventory_shrinkage` d
    JOIN `inventory_shrinkage` r ON r.id = d.inventory_shrinkage_id
    WHERE d.active = 1 AND r.active = 1

    UNION ALL

    SELECT
        CONCAT('TR-OUT-', d.id), 'TRANSFERENCIA', r.folio, d.product_id, -d.quantity,
        d.origin_stock_prev, d.origin_stock_post, d.cost, -d.subtotal,
        r.date_sent, r.origin_warehouse_id, r.origin_subsidiaries_id, r.requested_user_id,
        r.note, ts.code, r.companies_id
    FROM `detail_inventory_transfer` d
    JOIN `inventory_transfer` r ON r.id = d.inventory_transfer_id
    JOIN `transfer_status` ts ON ts.id = r.status_id
    WHERE d.active = 1 AND r.active = 1 AND r.date_sent IS NOT NULL

    UNION ALL

    SELECT
        CONCAT('TR-IN-', d.id), 'TRANSFERENCIA', r.folio, d.product_id, d.quantity,
        d.destination_stock_prev, d.destination_stock_post, d.cost, d.subtotal,
        r.date_received, r.destination_warehouse_id, r.destination_subsidiaries_id, r.received_user_id,
        r.note, ts.code, r.companies_id
    FROM `detail_inventory_transfer` d
    JOIN `inventory_transfer` r ON r.id = d.inventory_transfer_id
    JOIN `transfer_status` ts ON ts.id = r.status_id
    WHERE d.active = 1 AND r.active = 1 AND r.date_received IS NOT NULL

    UNION ALL

    SELECT
        CONCAT('AD-', d.id), 'AJUSTE', r.folio, d.product_id, d.difference,
        d.previous_stock, d.resulting_stock, d.cost, d.cost_diff,
        CONCAT(r.date_adjustment, ' ', COALESCE(r.time_adjustment, '00:00:00')),
        r.warehouse_id, r.subsidiaries_id, r.registered_user_id,
        r.note, r.status, r.companies_id
    FROM `detail_inventory_adjustment` d
    JOIN `inventory_adjustment` r ON r.id = d.inventory_adjustment_id
    WHERE d.active = 1 AND r.active = 1;

-- ── §3.6 Seeds básicos ──────────────────────────────────────────────

INSERT INTO `unit` (`code`, `name`) VALUES
    ('pza',  'Pieza'),
    ('kg',   'Kilogramo'),
    ('lt',   'Litro'),
    ('caja', 'Caja'),
    ('pq',   'Paquete'),
    ('m',    'Metro');

INSERT INTO `inflow_origin` (`code`, `name`, `icon`, `color_hex`, `requires_supplier`) VALUES
    ('PRODUCTION',  'Produccion',    'factory',          '#A78BFA', 0),
    ('SUPPLIER',    'Proveedor',     'truck',            '#FBBF24', 1),
    ('TRANSFER_IN', 'Transferencia', 'arrow-left-right', '#60A5FA', 0),
    ('RETURN',      'Devolucion',    'undo',             '#F43F5E', 0);

INSERT INTO `shrinkage_reason` (`code`, `name`, `icon`, `color_hex`) VALUES
    ('EXPIRY',         'Caducidad',        'calendar-x',   '#E02424'),
    ('DAMAGED',        'Daniado',          'package-x',    '#FBBF24'),
    ('PRODUCTION_ERR', 'Error produccion', 'flame',        '#1C64F2'),
    ('THEFT',          'Robo/Faltante',    'shield-alert', '#7C3AED'),
    ('CUSTOMER_RET',   'Devolucion',       'rotate-ccw',   '#3FC189');

INSERT INTO `adjustment_reason` (`code`, `name`, `icon`, `color_hex`, `affects_cost`) VALUES
    ('MISSING',          'Faltante sin explicar',     'minus-circle',    '#F43F5E', 1),
    ('UNRECORDED_IN',    'Entrada no registrada',     'plus-circle',     '#3FC189', 1),
    ('UNRECORDED_OUT',   'Entregados sin registrar',  'arrow-up-right',  '#FBBF24', 1),
    ('MONTH_CLOSE',      'Cierre mensual',            'calendar-check',  '#A78BFA', 0),
    ('FOUND_PRODUCT',    'Producto encontrado',       'search-check',    '#60A5FA', 1),
    ('PHYSICAL_COUNT',   'Conteo fisico',             'clipboard-check', '#A78BFA', 1),
    ('ADMIN_CORRECTION', 'Correccion administrativa', 'file-edit',       '#D1D5DB', 0);

INSERT INTO `transfer_status` (`code`, `name`, `order_index`, `is_terminal`, `color_hex`) VALUES
    ('REQUESTED',  'Solicitado',  1,  0, '#FBBF24'),
    ('AUTHORIZED', 'Autorizado',  2,  0, '#A78BFA'),
    ('IN_TRANSIT', 'En Transito', 3,  0, '#FB923C'),
    ('RECEIVED',   'Recibido',    4,  1, '#3FC189'),
    ('REJECTED',   'Rechazado',   99, 1, '#F43F5E');

-- warehouse_area sembrado para Reginas (companies_id = 4)
INSERT INTO `warehouse_area` (`name`, `description`, `color_hex`, `companies_id`) VALUES
    ('Refrigerados', 'Lacteos, frutas frescas, productos perecederos', '#60A5FA', 4),
    ('Secos',        'Harinas, granos, conservas, pan',                '#FB923C', 4),
    ('Congelados',   'Productos congelados',                           '#22D3EE', 4);
