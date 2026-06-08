-- =====================================================================
-- DDL — Módulo Inventory / Almacén (insumos)  ·  espejo reginas
-- Identidad (tenant) en fayxzvov_erp · módulo en fayxzvov_inventory
-- MySQL 8.0 · InnoDB · latin1_swedish_ci
-- Generado desde diagramas-er-inventory.md
-- NOTA (migracion jun-2026): el modulo usa `branch_id` -> `fayxzvov_erp`.`branches`.
--   La columna `subsidiaries_id` quedo obsoleta. Las tablas del tenant aqui abajo
--   (subsidiaries/users.subsidiaries_id) reflejan el modelo legacy; el tenant vivo
--   en fayxzvov_erp ya usa `branches` con `users.branch_id`.
-- =====================================================================

-- ───────────────────────────────────────────────
-- 1) IDENTIDAD / TENANT  (en fayxzvov_erp)
-- ───────────────────────────────────────────────
USE `fayxzvov_erp`;

CREATE TABLE `companies` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(160) NOT NULL,
  `rfc`        VARCHAR(20)  NULL,
  `email`      VARCHAR(120) NULL,
  `phone`      VARCHAR(20)  NULL,
  `logo`       VARCHAR(255) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`     TINYINT NOT NULL DEFAULT 1,
  `udn_id`     INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_companies_udn` (`udn_id`),
  CONSTRAINT `fk_companies_udn` FOREIGN KEY (`udn_id`) REFERENCES `udn` (`idUDN`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `subsidiaries` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(160) NOT NULL,
  `address`      VARCHAR(255) NULL,
  `phone`        VARCHAR(20)  NULL,
  `is_main`      TINYINT NOT NULL DEFAULT 0,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  `companies_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_subsidiaries_company` (`companies_id`),
  CONSTRAINT `fk_subsidiaries_company` FOREIGN KEY (`companies_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `users` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `fullname`        VARCHAR(160) NOT NULL,
  `username`        VARCHAR(60)  NOT NULL,
  `email`           VARCHAR(120) NULL,
  `password`        VARCHAR(255) NOT NULL,
  `phone`           VARCHAR(20)  NULL,
  `photo`           VARCHAR(255) NULL,
  `login_attempts`  INT NOT NULL DEFAULT 0,
  `last_login_at`   DATETIME NULL,
  `created_at`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`          TINYINT NOT NULL DEFAULT 1,
  `role_id`         INT NULL,
  `companies_id`    INT NOT NULL,
  `subsidiaries_id` INT NULL,
  `legacy_user_id`  INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_user` (`companies_id`, `username`),
  KEY `idx_users_role` (`role_id`),
  KEY `idx_users_subsidiary` (`subsidiaries_id`),
  KEY `idx_users_legacy` (`legacy_user_id`),
  CONSTRAINT `fk_users_company`    FOREIGN KEY (`companies_id`)    REFERENCES `companies` (`id`),
  CONSTRAINT `fk_users_subsidiary` FOREIGN KEY (`subsidiaries_id`) REFERENCES `subsidiaries` (`id`),
  CONSTRAINT `fk_users_role`       FOREIGN KEY (`role_id`)         REFERENCES `perfiles` (`idPerfil`),
  CONSTRAINT `fk_users_legacy`     FOREIGN KEY (`legacy_user_id`)  REFERENCES `usuarios` (`idUser`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ───────────────────────────────────────────────
-- 2) MÓDULO  (en fayxzvov_inventory)
-- ───────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS `fayxzvov_inventory`
  DEFAULT CHARACTER SET latin1 COLLATE latin1_swedish_ci;
USE `fayxzvov_inventory`;

-- ── Catálogos por empresa ──
CREATE TABLE `item_category` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(120) NOT NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  `companies_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_category_company` (`companies_id`),
  CONSTRAINT `fk_item_category_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `unit` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(20) NOT NULL,
  `name`         VARCHAR(80) NOT NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  `companies_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_unit_company` (`companies_id`),
  CONSTRAINT `fk_unit_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `warehouse_area` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(120) NOT NULL,
  `description`  VARCHAR(255) NULL,
  `color_hex`    VARCHAR(9)   NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  `companies_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_warehouse_area_company` (`companies_id`),
  CONSTRAINT `fk_warehouse_area_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Sub-catálogos globales ──
CREATE TABLE `inflow_origin` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `code`              VARCHAR(30)  NOT NULL,
  `name`              VARCHAR(120) NOT NULL,
  `icon`              VARCHAR(60)  NULL,
  `color_hex`         VARCHAR(9)   NULL,
  `requires_supplier` TINYINT NOT NULL DEFAULT 0,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `shrinkage_reason` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `code`      VARCHAR(30)  NOT NULL,
  `name`      VARCHAR(120) NOT NULL,
  `icon`      VARCHAR(60)  NULL,
  `color_hex` VARCHAR(9)   NULL,
  `active`    TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Maestros ──
CREATE TABLE `supplier` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(160) NOT NULL,
  `contact_name` VARCHAR(120) NULL,
  `phone`        VARCHAR(20)  NULL,
  `email`        VARCHAR(120) NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  `companies_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_company` (`companies_id`),
  CONSTRAINT `fk_supplier_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `warehouse` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(120) NOT NULL,
  `is_default`        TINYINT NOT NULL DEFAULT 0,
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`            TINYINT NOT NULL DEFAULT 1,
  `warehouse_area_id` INT NULL,
  `branch_id`   INT NOT NULL,
  `companies_id`      INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_warehouse_area` (`warehouse_area_id`),
  KEY `idx_warehouse_branch` (`branch_id`),
  KEY `idx_warehouse_company` (`companies_id`),
  CONSTRAINT `fk_warehouse_area`       FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`),
  CONSTRAINT `fk_warehouse_branch` FOREIGN KEY (`branch_id`)   REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_warehouse_company`    FOREIGN KEY (`companies_id`)      REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Insumo (item) ──
CREATE TABLE `item` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(160) NOT NULL,
  `image`           VARCHAR(255) NULL,
  `price`           DOUBLE NOT NULL DEFAULT 0,
  `created_at`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`          TINYINT NOT NULL DEFAULT 1,
  `category_id`     INT NULL,
  `branch_id` INT NULL,
  `companies_id`    INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_category` (`category_id`),
  KEY `idx_item_branch` (`branch_id`),
  KEY `idx_item_company` (`companies_id`),
  CONSTRAINT `fk_item_category`   FOREIGN KEY (`category_id`)     REFERENCES `item_category` (`id`),
  CONSTRAINT `fk_item_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_item_company`    FOREIGN KEY (`companies_id`)    REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `item_attribute` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `sku`               VARCHAR(40)  NULL,
  `description`       VARCHAR(255) NULL,
  `shelf_life_days`   INT NULL,
  `cost_unit`         DOUBLE NOT NULL DEFAULT 0,
  `stock_min`         DOUBLE NOT NULL DEFAULT 0,
  `stock_max`         DOUBLE NULL,
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`            TINYINT NOT NULL DEFAULT 1,
  `warehouse_area_id` INT NULL,
  `unit_id`           INT NULL,
  `item_id`           INT NOT NULL,
  `companies_id`      INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_item_attr_area` (`warehouse_area_id`),
  KEY `idx_item_attr_unit` (`unit_id`),
  KEY `idx_item_attr_item` (`item_id`),
  KEY `idx_item_attr_company` (`companies_id`),
  CONSTRAINT `fk_item_attr_area`    FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`),
  CONSTRAINT `fk_item_attr_unit`    FOREIGN KEY (`unit_id`)           REFERENCES `unit` (`id`),
  CONSTRAINT `fk_item_attr_item`    FOREIGN KEY (`item_id`)           REFERENCES `item` (`id`),
  CONSTRAINT `fk_item_attr_company` FOREIGN KEY (`companies_id`)      REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Existencias ──
CREATE TABLE `stock` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `quantity`          DOUBLE NOT NULL DEFAULT 0,
  `last_movement_at`  DATETIME NULL,
  `last_inventory_at` DATETIME NULL,
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`            TINYINT NOT NULL DEFAULT 1,
  `warehouse_id`      INT NOT NULL,
  `item_id`           INT NOT NULL,
  `companies_id`      INT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stock` (`item_id`, `warehouse_id`),
  KEY `idx_stock_warehouse` (`warehouse_id`),
  KEY `idx_stock_company` (`companies_id`),
  CONSTRAINT `fk_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_stock_item`      FOREIGN KEY (`item_id`)      REFERENCES `item` (`id`),
  CONSTRAINT `fk_stock_company`   FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Entradas ──
CREATE TABLE `inventory_inflow` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `folio`             VARCHAR(20)  NOT NULL,
  `note`              VARCHAR(255) NULL,
  `total_products`    INT NOT NULL DEFAULT 0,
  `total_units`       DOUBLE NOT NULL DEFAULT 0,
  `total_cost`        DOUBLE NOT NULL DEFAULT 0,
  `date_inflow`       DATE NULL,
  `confirmed_at`      DATETIME NULL,
  `created_at`        DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`            VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
  `active`            TINYINT NOT NULL DEFAULT 1,
  `inflow_origin_id`  INT NULL,
  `warehouse_id`      INT NOT NULL,
  `supplier_id`       INT NULL,
  `user_id`           INT NULL,
  `confirmed_user_id` INT NULL,
  `branch_id`   INT NOT NULL,
  `companies_id`      INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inflow_origin` (`inflow_origin_id`),
  KEY `idx_inflow_warehouse` (`warehouse_id`),
  KEY `idx_inflow_supplier` (`supplier_id`),
  KEY `idx_inflow_user` (`user_id`),
  KEY `idx_inflow_cuser` (`confirmed_user_id`),
  KEY `idx_inflow_branch` (`branch_id`),
  KEY `idx_inflow_company` (`companies_id`),
  CONSTRAINT `fk_inflow_origin`     FOREIGN KEY (`inflow_origin_id`)  REFERENCES `inflow_origin` (`id`),
  CONSTRAINT `fk_inflow_warehouse`  FOREIGN KEY (`warehouse_id`)      REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_inflow_supplier`   FOREIGN KEY (`supplier_id`)       REFERENCES `supplier` (`id`),
  CONSTRAINT `fk_inflow_user`       FOREIGN KEY (`user_id`)           REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inflow_cuser`      FOREIGN KEY (`confirmed_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inflow_branch` FOREIGN KEY (`branch_id`)   REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_inflow_company`    FOREIGN KEY (`companies_id`)      REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `detail_inventory_inflow` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `batch_code`          VARCHAR(40) NULL,
  `quantity`            DOUBLE NOT NULL DEFAULT 0,
  `confirmed_quantity`  DOUBLE NULL,
  `cost`                DOUBLE NOT NULL DEFAULT 0,
  `subtotal`            DOUBLE NOT NULL DEFAULT 0,
  `previous_stock`      DOUBLE NOT NULL DEFAULT 0,
  `resulting_stock`     DOUBLE NOT NULL DEFAULT 0,
  `expires_at`          DATE NULL,
  `created_at`          DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`              TINYINT NOT NULL DEFAULT 1,
  `item_id`             INT NOT NULL,
  `inventory_inflow_id` INT NOT NULL,
  `unit_id`             INT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dinflow_item` (`item_id`),
  KEY `idx_dinflow_header` (`inventory_inflow_id`),
  KEY `idx_dinflow_unit` (`unit_id`),
  CONSTRAINT `fk_dinflow_item`   FOREIGN KEY (`item_id`)             REFERENCES `item` (`id`),
  CONSTRAINT `fk_dinflow_header` FOREIGN KEY (`inventory_inflow_id`) REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dinflow_unit`   FOREIGN KEY (`unit_id`)             REFERENCES `unit` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Salidas ──
CREATE TABLE `inventory_shrinkage` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `folio`               VARCHAR(20)  NOT NULL,
  `note`                VARCHAR(255) NULL,
  `total_products`      INT NOT NULL DEFAULT 0,
  `total_units`         DOUBLE NOT NULL DEFAULT 0,
  `total_cost`          DOUBLE NOT NULL DEFAULT 0,
  `date_shrinkage`      DATE NULL,
  `created_at`          DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`              VARCHAR(20) NOT NULL DEFAULT 'Aplicada',
  `active`              TINYINT NOT NULL DEFAULT 1,
  `shrinkage_reason_id` INT NULL,
  `warehouse_id`        INT NOT NULL,
  `user_id`             INT NULL,
  `branch_id`     INT NOT NULL,
  `companies_id`        INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_shrink_reason` (`shrinkage_reason_id`),
  KEY `idx_shrink_warehouse` (`warehouse_id`),
  KEY `idx_shrink_user` (`user_id`),
  KEY `idx_shrink_branch` (`branch_id`),
  KEY `idx_shrink_company` (`companies_id`),
  CONSTRAINT `fk_shrink_reason`     FOREIGN KEY (`shrinkage_reason_id`) REFERENCES `shrinkage_reason` (`id`),
  CONSTRAINT `fk_shrink_warehouse`  FOREIGN KEY (`warehouse_id`)        REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_shrink_user`       FOREIGN KEY (`user_id`)             REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_shrink_branch` FOREIGN KEY (`branch_id`)     REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_shrink_company`    FOREIGN KEY (`companies_id`)        REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE `detail_inventory_shrinkage` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `quantity`               DOUBLE NOT NULL DEFAULT 0,
  `cost`                   DOUBLE NOT NULL DEFAULT 0,
  `subtotal`               DOUBLE NOT NULL DEFAULT 0,
  `previous_stock`         DOUBLE NOT NULL DEFAULT 0,
  `resulting_stock`        DOUBLE NOT NULL DEFAULT 0,
  `created_at`             DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`                 TINYINT NOT NULL DEFAULT 1,
  `item_id`                INT NOT NULL,
  `inventory_shrinkage_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_dshrink_item` (`item_id`),
  KEY `idx_dshrink_header` (`inventory_shrinkage_id`),
  CONSTRAINT `fk_dshrink_item`   FOREIGN KEY (`item_id`)                REFERENCES `item` (`id`),
  CONSTRAINT `fk_dshrink_header` FOREIGN KEY (`inventory_shrinkage_id`) REFERENCES `inventory_shrinkage` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Kardex (lectura) ──
-- inventory_movement NO es una tabla fisica: es una VISTA que unifica los
-- detalles ya registrados por cada modulo de movimiento (entradas, mermas).
-- Asi el historial se alimenta solo y queda siempre consistente con el stock,
-- sin necesidad de INSERTs paralelos. Mismo patron que app/inventarios.
-- Al agregar traspasos/ajustes, sumar su propio UNION ALL aqui.
CREATE OR REPLACE VIEW `inventory_movement` AS
    -- ── ENTRADAS (ingreso, cantidad positiva) ──
    SELECT
        CONCAT('IN-', d.id)                          AS movement_uid,
        'ENTRADA'                                    AS movement_type,
        r.folio                                      AS folio,
        r.note                                       AS note,
        COALESCE(d.confirmed_quantity, d.quantity)   AS quantity,
        d.previous_stock                             AS stock_prev,
        d.resulting_stock                            AS stock_post,
        d.cost                                       AS cost_unit,
        d.subtotal                                   AS cost_total,
        COALESCE(r.date_inflow, DATE(r.created_at))  AS occurred_at,
        r.created_at                                 AS created_at,
        r.status                                     AS status,
        d.item_id                                    AS item_id,
        r.warehouse_id                               AS warehouse_id,
        r.user_id                                    AS user_id,
        r.branch_id                                  AS branch_id,
        r.companies_id                               AS companies_id
    FROM `detail_inventory_inflow` d
    JOIN `inventory_inflow` r ON r.id = d.inventory_inflow_id
    WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

    UNION ALL

    -- ── SALIDAS / MERMAS (egreso, cantidad negativa) ──
    SELECT
        CONCAT('SH-', d.id),
        'MERMA',
        r.folio,
        r.note,
        -d.quantity,
        d.previous_stock,
        d.resulting_stock,
        d.cost,
        d.subtotal,
        COALESCE(r.date_shrinkage, DATE(r.created_at)),
        r.created_at,
        r.status,
        d.item_id,
        r.warehouse_id,
        r.user_id,
        r.branch_id,
        r.companies_id
    FROM `detail_inventory_shrinkage` d
    JOIN `inventory_shrinkage` r ON r.id = d.inventory_shrinkage_id
    WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada';
