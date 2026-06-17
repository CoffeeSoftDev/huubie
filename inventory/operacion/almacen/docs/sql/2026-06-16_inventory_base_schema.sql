-- =====================================================================
-- Esquema BASE de inventario  (bootstrap para entorno local / WAMP)
-- Base de datos: fayxzvov_inventory  (MySQL 5.7 / 8 — WAMP local)
--
-- DEDUCIDO de las consultas de los modelos del modulo almacen
-- (inventory/operacion/almacen/mdl/*.php). NO es un dump de produccion:
-- reconstruye las tablas base que el modulo necesita para funcionar
-- (catalogo, almacenes, stock y entradas) a partir de los SELECT/INSERT/
-- UPDATE existentes. Revisa tipos/longitudes contra produccion antes de
-- usarlo fuera de local.
--
-- Orden de ejecucion del modulo de Ordenes/Solicitudes:
--   1) Este script (crea la base y el esquema base).
--   2) 2026-06-09_purchase_order.sql                 (purchase_order + detail + ALTER inflow)
--   3) 2026-06-15_purchase_order_destination_branch.sql
--
-- Estilo alineado al resto del modulo: InnoDB, CHARSET latin1,
-- ROW_FORMAT DYNAMIC. FK de negocio internas + FK tenant -> fayxzvov_erp.
-- Las PK de fayxzvov_erp (companies/branches/users) son int(11), por eso
-- las columnas de relacion son int.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `fayxzvov_inventory`
  DEFAULT CHARACTER SET latin1;

USE `fayxzvov_inventory`;

-- ---------------------------------------------------------------------
-- 1. Areas de almacen
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse_area` (
  `id`           int          NOT NULL AUTO_INCREMENT,
  `name`         varchar(150) NOT NULL,
  `color_hex`    varchar(20)  DEFAULT NULL,
  `companies_id` int          DEFAULT NULL,
  `active`       tinyint      NOT NULL DEFAULT '1',
  `created_at`   datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_wa_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_wa_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 2. Unidades de medida
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `unit` (
  `id`           int          NOT NULL AUTO_INCREMENT,
  `code`         varchar(20)  DEFAULT NULL,
  `name`         varchar(150) NOT NULL,
  `companies_id` int          DEFAULT NULL,
  `active`       tinyint      NOT NULL DEFAULT '1',
  `created_at`   datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_unit_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_unit_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 3. Proveedores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `supplier` (
  `id`           int          NOT NULL AUTO_INCREMENT,
  `name`         varchar(150) NOT NULL,
  `contact_name` varchar(150) DEFAULT NULL,
  `phone`        varchar(50)  DEFAULT NULL,
  `email`        varchar(150) DEFAULT NULL,
  `companies_id` int          DEFAULT NULL,
  `active`       tinyint      NOT NULL DEFAULT '1',
  `created_at`   datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_supplier_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_supplier_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 4. Almacenes  (FK area + sucursal del tenant)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `warehouse` (
  `id`                int          NOT NULL AUTO_INCREMENT,
  `name`              varchar(150) NOT NULL,
  `is_default`        tinyint      NOT NULL DEFAULT '0',
  `warehouse_area_id` int          DEFAULT NULL,
  `branch_id`         int          DEFAULT NULL,
  `companies_id`      int          DEFAULT NULL,
  `active`            tinyint      NOT NULL DEFAULT '1',
  `created_at`        datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_w_area`    (`warehouse_area_id`) USING BTREE,
  KEY `idx_w_branch`  (`branch_id`)         USING BTREE,
  KEY `idx_w_company` (`companies_id`)      USING BTREE,
  CONSTRAINT `fk_w_area`    FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`),
  CONSTRAINT `fk_w_branch`  FOREIGN KEY (`branch_id`)         REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_w_company` FOREIGN KEY (`companies_id`)      REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 5. Categorias de producto  (cada categoria pertenece a 1 almacen)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_category` (
  `id`           int          NOT NULL AUTO_INCREMENT,
  `name`         varchar(150) NOT NULL,
  `warehouse_id` int          DEFAULT NULL,
  `companies_id` int          DEFAULT NULL,
  `active`       tinyint      NOT NULL DEFAULT '1',
  `created_at`   datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_ic_warehouse` (`warehouse_id`) USING BTREE,
  KEY `idx_ic_company`   (`companies_id`) USING BTREE,
  CONSTRAINT `fk_ic_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_ic_company`   FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 6. Productos / insumos  (cabecera)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `item` (
  `id`                int          NOT NULL AUTO_INCREMENT,
  `name`              varchar(200) NOT NULL,
  `image`             varchar(255) DEFAULT NULL,
  `price`             double       DEFAULT '0',
  `price_without_tax` double       DEFAULT NULL,
  `tax`               double       DEFAULT NULL,
  `category_id`       int          DEFAULT NULL,
  `companies_id`      int          DEFAULT NULL,
  `active`            tinyint      NOT NULL DEFAULT '1',
  `created_at`        datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_item_category` (`category_id`)  USING BTREE,
  KEY `idx_item_company`  (`companies_id`) USING BTREE,
  CONSTRAINT `fk_item_category` FOREIGN KEY (`category_id`)  REFERENCES `item_category` (`id`),
  CONSTRAINT `fk_item_company`  FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 7. Atributos del producto  (sku, costo, min/max, unidad, area)
--    Relacion 1:1 vigente via active = 1
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `item_attribute` (
  `id`                int          NOT NULL AUTO_INCREMENT,
  `item_id`           int          NOT NULL,
  `sku`               varchar(50)  DEFAULT NULL,
  `cost_unit`         double       DEFAULT NULL,
  `stock_min`         double       DEFAULT NULL,
  `stock_max`         double       DEFAULT NULL,
  `shelf_life_days`   int          DEFAULT NULL,
  `description`       varchar(255) DEFAULT NULL,
  `warehouse_area_id` int          DEFAULT NULL,
  `unit_id`           int          DEFAULT NULL,
  `companies_id`      int          DEFAULT NULL,
  `active`            tinyint      NOT NULL DEFAULT '1',
  `created_at`        datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_ia_item` (`item_id`)           USING BTREE,
  KEY `idx_ia_unit` (`unit_id`)           USING BTREE,
  KEY `idx_ia_area` (`warehouse_area_id`) USING BTREE,
  CONSTRAINT `fk_ia_item` FOREIGN KEY (`item_id`)           REFERENCES `item` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ia_unit` FOREIGN KEY (`unit_id`)           REFERENCES `unit` (`id`),
  CONSTRAINT `fk_ia_area` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 8. Existencias por almacen
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock` (
  `id`               int      NOT NULL AUTO_INCREMENT,
  `quantity`         double   NOT NULL DEFAULT '0',
  `last_movement_at` datetime DEFAULT NULL,
  `warehouse_id`     int      NOT NULL,
  `item_id`          int      NOT NULL,
  `companies_id`     int      DEFAULT NULL,
  `active`           tinyint  NOT NULL DEFAULT '1',
  `created_at`       datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_stock_wh`      (`warehouse_id`) USING BTREE,
  KEY `idx_stock_item`    (`item_id`)      USING BTREE,
  KEY `idx_stock_company` (`companies_id`) USING BTREE,
  CONSTRAINT `fk_stock_wh`      FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_stock_item`    FOREIGN KEY (`item_id`)      REFERENCES `item` (`id`),
  CONSTRAINT `fk_stock_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 9. Origenes de entrada  (catalogo global, sin companies_id)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inflow_origin` (
  `id`                int          NOT NULL AUTO_INCREMENT,
  `code`              varchar(30)  DEFAULT NULL,
  `name`              varchar(100) NOT NULL,
  `color_hex`         varchar(20)  DEFAULT NULL,
  `bg_hex`            varchar(20)  DEFAULT NULL,
  `icon`              varchar(50)  DEFAULT NULL,
  `requires_supplier` tinyint      NOT NULL DEFAULT '0',
  `active`            tinyint      NOT NULL DEFAULT '1',
  `created_at`        datetime     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- Semilla minima (entradas y recepcion de OC necesitan al menos un origen).
INSERT INTO `inflow_origin` (`code`, `name`, `requires_supplier`) VALUES
  ('COMPRA',     'Compra',           1),
  ('AJUSTE',     'Ajuste',           0),
  ('DEVOLUCION', 'Devolucion',       0),
  ('OC',         'Orden de compra',  1);

-- ---------------------------------------------------------------------
-- 10. Entradas de inventario  (cabecera)
--     La columna purchase_order_id la agrega 2026-06-09_purchase_order.sql.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_inflow` (
  `id`                      int          NOT NULL AUTO_INCREMENT,
  `folio`                   varchar(20)  NOT NULL,
  `note`                    varchar(255) DEFAULT NULL,
  `total_products`          int          DEFAULT '0',
  `total_units`             double       DEFAULT '0',
  `total_cost`              double       DEFAULT '0',
  `total_price_without_tax` double       DEFAULT NULL,
  `status`                  varchar(20)  DEFAULT 'Borrador',
  `date_inflow`             datetime     DEFAULT NULL,
  `confirmed_at`            datetime     DEFAULT NULL,
  `active`                  tinyint      NOT NULL DEFAULT '1',
  `created_at`              datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inflow_origin_id`        int          DEFAULT NULL,
  `warehouse_id`            int          DEFAULT NULL,
  `supplier_id`             int          DEFAULT NULL,
  `branch_id`               int          DEFAULT NULL,
  `user_id`                 int          DEFAULT NULL,
  `confirmed_user_id`       int          DEFAULT NULL,
  `companies_id`            int          DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_inf_origin`   (`inflow_origin_id`)  USING BTREE,
  KEY `idx_inf_wh`       (`warehouse_id`)      USING BTREE,
  KEY `idx_inf_supplier` (`supplier_id`)       USING BTREE,
  KEY `idx_inf_branch`   (`branch_id`)         USING BTREE,
  KEY `idx_inf_user`     (`user_id`)           USING BTREE,
  KEY `idx_inf_cuser`    (`confirmed_user_id`) USING BTREE,
  KEY `idx_inf_company`  (`companies_id`)      USING BTREE,
  CONSTRAINT `fk_inf_origin`   FOREIGN KEY (`inflow_origin_id`)  REFERENCES `inflow_origin` (`id`),
  CONSTRAINT `fk_inf_wh`       FOREIGN KEY (`warehouse_id`)      REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_inf_supplier` FOREIGN KEY (`supplier_id`)       REFERENCES `supplier` (`id`),
  CONSTRAINT `fk_inf_branch`   FOREIGN KEY (`branch_id`)         REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_inf_user`     FOREIGN KEY (`user_id`)           REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inf_cuser`    FOREIGN KEY (`confirmed_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inf_company`  FOREIGN KEY (`companies_id`)      REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 11. Entradas de inventario  (renglones)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `detail_inventory_inflow` (
  `id`                  int         NOT NULL AUTO_INCREMENT,
  `batch_code`          varchar(50) DEFAULT NULL,
  `quantity`            double      NOT NULL DEFAULT '0',
  `confirmed_quantity`  double      DEFAULT NULL,
  `cost`                double      DEFAULT NULL,
  `subtotal`            double      NOT NULL DEFAULT '0',
  `price_without_tax`   double      DEFAULT NULL,
  `tax`                 int         DEFAULT NULL,
  `previous_stock`      double      DEFAULT NULL,
  `resulting_stock`     double      DEFAULT NULL,
  `expires_at`          date        DEFAULT NULL,
  `active`              tinyint     NOT NULL DEFAULT '1',
  `created_at`          datetime    DEFAULT CURRENT_TIMESTAMP,
  `inventory_inflow_id` int         NOT NULL,
  `item_id`             int         NOT NULL,
  `unit_id`             int         DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dinf_header` (`inventory_inflow_id`) USING BTREE,
  KEY `idx_dinf_item`   (`item_id`)             USING BTREE,
  KEY `idx_dinf_unit`   (`unit_id`)             USING BTREE,
  CONSTRAINT `fk_dinf_header` FOREIGN KEY (`inventory_inflow_id`) REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dinf_item`   FOREIGN KEY (`item_id`)             REFERENCES `item` (`id`),
  CONSTRAINT `fk_dinf_unit`   FOREIGN KEY (`unit_id`)             REFERENCES `unit` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- =====================================================================
-- NOTAS
-- - inventory_movement es una VISTA (no tabla) que consumen los modulos
--   dashboard/stock/movimientos; NO se incluye aqui. El modulo de
--   solicitudes (init + saveOrden) no la necesita.
-- - Tablas de otros modulos del almacen no requeridas para registrar la
--   orden y por tanto fuera de este bootstrap: inflow_format,
--   inflow_format_item, inventory_shrinkage, detail_inventory_shrinkage,
--   shrinkage_reason, transfer_status, inventory_transfer,
--   detail_inventory_transfer, inventory_transfer_history.
-- - Tras correr este script, ejecutar los dos scripts de purchase_order
--   y cargar datos en item/item_attribute/warehouse/item_category para
--   la companies_id de la sesion.
-- =====================================================================
