/*
 Navicat Premium Data Transfer

 Source Server         : Local
 Source Server Type    : MySQL
 Source Server Version : 50731
 Source Host           : localhost:3306
 Source Schema         : fayxzvov_inventory

 Target Server Type    : MySQL
 Target Server Version : 50731
 File Encoding         : 65001

 Date: 08/06/2026 16:41:20
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for detail_inventory_inflow
-- ----------------------------
DROP TABLE IF EXISTS `detail_inventory_inflow`;
CREATE TABLE `detail_inventory_inflow`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_code` varchar(40) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `quantity` double NOT NULL DEFAULT 0,
  `confirmed_quantity` double NULL DEFAULT NULL,
  `cost` double NOT NULL DEFAULT 0,
  `subtotal` double NOT NULL DEFAULT 0,
  `previous_stock` double NOT NULL DEFAULT 0,
  `resulting_stock` double NOT NULL DEFAULT 0,
  `expires_at` date NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `item_id` int(11) NOT NULL,
  `inventory_inflow_id` int(11) NOT NULL,
  `unit_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_dinflow_item`(`item_id`) USING BTREE,
  INDEX `idx_dinflow_header`(`inventory_inflow_id`) USING BTREE,
  INDEX `idx_dinflow_unit`(`unit_id`) USING BTREE,
  CONSTRAINT `fk_dinflow_header` FOREIGN KEY (`inventory_inflow_id`) REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_dinflow_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_dinflow_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 16 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for detail_inventory_shrinkage
-- ----------------------------
DROP TABLE IF EXISTS `detail_inventory_shrinkage`;
CREATE TABLE `detail_inventory_shrinkage`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT 0,
  `cost` double NOT NULL DEFAULT 0,
  `subtotal` double NOT NULL DEFAULT 0,
  `previous_stock` double NOT NULL DEFAULT 0,
  `resulting_stock` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `item_id` int(11) NOT NULL,
  `inventory_shrinkage_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_dshrink_item`(`item_id`) USING BTREE,
  INDEX `idx_dshrink_header`(`inventory_shrinkage_id`) USING BTREE,
  CONSTRAINT `fk_dshrink_header` FOREIGN KEY (`inventory_shrinkage_id`) REFERENCES `inventory_shrinkage` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_dshrink_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 14 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inflow_origin
-- ----------------------------
DROP TABLE IF EXISTS `inflow_origin`;
CREATE TABLE `inflow_origin`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `name` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `icon` varchar(60) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `color_hex` varchar(9) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `requires_supplier` tinyint(4) NOT NULL DEFAULT 0,
  `active` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_inflow
-- ----------------------------
DROP TABLE IF EXISTS `inventory_inflow`;
CREATE TABLE `inventory_inflow`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `note` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_units` double NOT NULL DEFAULT 0,
  `total_cost` double NOT NULL DEFAULT 0,
  `date_inflow` date NULL DEFAULT NULL,
  `confirmed_at` datetime(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `status` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'Pendiente',
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `inflow_origin_id` int(11) NULL DEFAULT NULL,
  `warehouse_id` int(11) NOT NULL,
  `supplier_id` int(11) NULL DEFAULT NULL,
  `user_id` int(11) NULL DEFAULT NULL,
  `confirmed_user_id` int(11) NULL DEFAULT NULL,
  `branch_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_inflow_origin`(`inflow_origin_id`) USING BTREE,
  INDEX `idx_inflow_warehouse`(`warehouse_id`) USING BTREE,
  INDEX `idx_inflow_supplier`(`supplier_id`) USING BTREE,
  INDEX `idx_inflow_user`(`user_id`) USING BTREE,
  INDEX `idx_inflow_cuser`(`confirmed_user_id`) USING BTREE,
  INDEX `idx_inflow_subsidiary`(`branch_id`) USING BTREE,
  INDEX `idx_inflow_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_inflow_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_inflow_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_inflow_cuser` FOREIGN KEY (`confirmed_user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_inflow_origin` FOREIGN KEY (`inflow_origin_id`) REFERENCES `inflow_origin` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_inflow_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `supplier` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_inflow_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_inflow_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_shrinkage
-- ----------------------------
DROP TABLE IF EXISTS `inventory_shrinkage`;
CREATE TABLE `inventory_shrinkage`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `note` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `evidence_url` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_units` double NOT NULL DEFAULT 0,
  `total_cost` double NOT NULL DEFAULT 0,
  `date_shrinkage` date NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `status` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL DEFAULT 'Aplicada',
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `shrinkage_reason_id` int(11) NULL DEFAULT NULL,
  `warehouse_id` int(11) NOT NULL,
  `user_id` int(11) NULL DEFAULT NULL,
  `branch_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_shrink_reason`(`shrinkage_reason_id`) USING BTREE,
  INDEX `idx_shrink_warehouse`(`warehouse_id`) USING BTREE,
  INDEX `idx_shrink_user`(`user_id`) USING BTREE,
  INDEX `idx_shrink_subsidiary`(`branch_id`) USING BTREE,
  INDEX `idx_shrink_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_shrink_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shrink_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shrink_reason` FOREIGN KEY (`shrinkage_reason_id`) REFERENCES `shrinkage_reason` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shrink_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_erp`.`users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_shrink_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for item
-- ----------------------------
DROP TABLE IF EXISTS `item`;
CREATE TABLE `item`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(160) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `image` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `price` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `category_id` int(11) NULL DEFAULT NULL,
  `branch_id` int(11) NULL DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  `price_without_tax` double NULL DEFAULT NULL,
  `tax` double NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_item_category`(`category_id`) USING BTREE,
  INDEX `idx_item_subsidiary`(`branch_id`) USING BTREE,
  INDEX `idx_item_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_item_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_category` FOREIGN KEY (`category_id`) REFERENCES `item_category` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for item_attribute
-- ----------------------------
DROP TABLE IF EXISTS `item_attribute`;
CREATE TABLE `item_attribute`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(40) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `description` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `shelf_life_days` int(11) NULL DEFAULT NULL,
  `cost_unit` double NOT NULL DEFAULT 0,
  `stock_min` double NOT NULL DEFAULT 0,
  `stock_max` double NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `warehouse_area_id` int(11) NULL DEFAULT NULL,
  `unit_id` int(11) NULL DEFAULT NULL,
  `item_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_item_attr_area`(`warehouse_area_id`) USING BTREE,
  INDEX `idx_item_attr_unit`(`unit_id`) USING BTREE,
  INDEX `idx_item_attr_item`(`item_id`) USING BTREE,
  INDEX `idx_item_attr_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_item_attr_area` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_attr_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_attr_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_attr_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for item_category
-- ----------------------------
DROP TABLE IF EXISTS `item_category`;
CREATE TABLE `item_category`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `warehouse_id` int(11) NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_item_category_company`(`companies_id`) USING BTREE,
  INDEX `idx_item_category_warehouse`(`warehouse_id`) USING BTREE,
  CONSTRAINT `fk_item_category_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_item_category_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 24 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for shrinkage_reason
-- ----------------------------
DROP TABLE IF EXISTS `shrinkage_reason`;
CREATE TABLE `shrinkage_reason`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `name` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `icon` varchar(60) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `color_hex` varchar(9) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `active` tinyint(4) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for stock
-- ----------------------------
DROP TABLE IF EXISTS `stock`;
CREATE TABLE `stock`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT 0,
  `last_movement_at` datetime(0) NULL DEFAULT NULL,
  `last_inventory_at` datetime(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `warehouse_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_stock`(`item_id`, `warehouse_id`) USING BTREE,
  INDEX `idx_stock_warehouse`(`warehouse_id`) USING BTREE,
  INDEX `idx_stock_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_stock_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_stock_item` FOREIGN KEY (`item_id`) REFERENCES `item` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for supplier
-- ----------------------------
DROP TABLE IF EXISTS `supplier`;
CREATE TABLE `supplier`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(160) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `contact_name` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `email` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_supplier_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_supplier_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for unit
-- ----------------------------
DROP TABLE IF EXISTS `unit`;
CREATE TABLE `unit`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `name` varchar(80) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_unit_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_unit_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 17 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for warehouse
-- ----------------------------
DROP TABLE IF EXISTS `warehouse`;
CREATE TABLE `warehouse`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `is_default` tinyint(4) NOT NULL DEFAULT 0,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `warehouse_area_id` int(11) NULL DEFAULT NULL,
  `branch_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_warehouse_area`(`warehouse_area_id`) USING BTREE,
  INDEX `idx_warehouse_subsidiary`(`branch_id`) USING BTREE,
  INDEX `idx_warehouse_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_warehouse_area` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_warehouse_branch` FOREIGN KEY (`branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_warehouse_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for warehouse_area
-- ----------------------------
DROP TABLE IF EXISTS `warehouse_area`;
CREATE TABLE `warehouse_area`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
  `description` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `color_hex` varchar(9) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(4) NOT NULL DEFAULT 1,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_warehouse_area_company`(`companies_id`) USING BTREE,
  CONSTRAINT `fk_warehouse_area_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- View structure for inventory_movement
-- ----------------------------
DROP VIEW IF EXISTS `inventory_movement`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `inventory_movement` AS select concat('IN-',`d`.`id`) AS `movement_uid`,'ENTRADA' AS `movement_type`,`r`.`folio` AS `folio`,`r`.`note` AS `note`,coalesce(`d`.`confirmed_quantity`,`d`.`quantity`) AS `quantity`,`d`.`previous_stock` AS `stock_prev`,`d`.`resulting_stock` AS `stock_post`,`d`.`cost` AS `cost_unit`,`d`.`subtotal` AS `cost_total`,coalesce(`r`.`date_inflow`,cast(`r`.`created_at` as date)) AS `occurred_at`,`r`.`created_at` AS `created_at`,`r`.`status` AS `status`,`d`.`item_id` AS `item_id`,`r`.`warehouse_id` AS `warehouse_id`,`r`.`user_id` AS `user_id`,`r`.`branch_id` AS `branch_id`,`r`.`companies_id` AS `companies_id` from (`detail_inventory_inflow` `d` join `inventory_inflow` `r` on((`r`.`id` = `d`.`inventory_inflow_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`status` <> 'Cancelada')) union all select concat('SH-',`d`.`id`) AS `CONCAT('SH-', d.id)`,'MERMA' AS `MERMA`,`r`.`folio` AS `folio`,`r`.`note` AS `note`,-(`d`.`quantity`) AS `-d.quantity`,`d`.`previous_stock` AS `previous_stock`,`d`.`resulting_stock` AS `resulting_stock`,`d`.`cost` AS `cost`,`d`.`subtotal` AS `subtotal`,coalesce(`r`.`date_shrinkage`,cast(`r`.`created_at` as date)) AS `COALESCE(r.date_shrinkage, DATE(r.created_at))`,`r`.`created_at` AS `created_at`,`r`.`status` AS `status`,`d`.`item_id` AS `item_id`,`r`.`warehouse_id` AS `warehouse_id`,`r`.`user_id` AS `user_id`,`r`.`branch_id` AS `branch_id`,`r`.`companies_id` AS `companies_id` from (`detail_inventory_shrinkage` `d` join `inventory_shrinkage` `r` on((`r`.`id` = `d`.`inventory_shrinkage_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`status` <> 'Cancelada'));

SET FOREIGN_KEY_CHECKS = 1;
