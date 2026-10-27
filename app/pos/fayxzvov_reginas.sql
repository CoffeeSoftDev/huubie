/*
 Navicat Premium Data Transfer

 Source Server         : Local
 Source Server Type    : MySQL
 Source Server Version : 50731
 Source Host           : localhost:3306
 Source Schema         : fayxzvov_reginas

 Target Server Type    : MySQL
 Target Server Version : 50731
 File Encoding         : 65001

 Date: 11/06/2026 15:49:57
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for _bak_precios_costos
-- ----------------------------
DROP TABLE IF EXISTS `_bak_precios_costos`;
CREATE TABLE `_bak_precios_costos`  (
  `product_id` int(11) NOT NULL DEFAULT 0,
  `old_price` double NULL DEFAULT NULL,
  `attr_id` int(11) NULL DEFAULT 0,
  `old_cost` double NULL DEFAULT 0
) ENGINE = MyISAM CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Fixed;

-- ----------------------------
-- Table structure for adjustment_reason
-- ----------------------------
DROP TABLE IF EXISTS `adjustment_reason`;
CREATE TABLE `adjustment_reason`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `color_hex` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `affects_cost` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_adjustment_reason_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for cash_shift
-- ----------------------------
DROP TABLE IF EXISTS `cash_shift`;
CREATE TABLE `cash_shift`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subsidiary_id` int(11) NULL DEFAULT NULL,
  `employee_id` int(11) NULL DEFAULT NULL,
  `daily_closure_id` int(11) NULL DEFAULT NULL,
  `shift_name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `opened_at` datetime(0) NULL DEFAULT NULL,
  `closed_at` datetime(0) NULL DEFAULT NULL,
  `opening_amount` double NULL DEFAULT NULL,
  `total_sales` double NULL DEFAULT NULL,
  `cash` double NULL DEFAULT NULL,
  `card` double NULL DEFAULT NULL,
  `transfer` double NULL DEFAULT NULL,
  `total_orders` int(11) NULL DEFAULT NULL,
  `status` enum('open','closed') CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `active` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `daily_closure_id`(`daily_closure_id`) USING BTREE,
  INDEX `subsidiary_id`(`subsidiary_id`) USING BTREE,
  INDEX `employee_id`(`employee_id`) USING BTREE,
  CONSTRAINT `cash_shift_ibfk_1` FOREIGN KEY (`daily_closure_id`) REFERENCES `daily_closure` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cash_shift_ibfk_2` FOREIGN KEY (`subsidiary_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cash_shift_ibfk_3` FOREIGN KEY (`employee_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 45 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for closure_payment
-- ----------------------------
DROP TABLE IF EXISTS `closure_payment`;
CREATE TABLE `closure_payment`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `daily_closure_id` int(11) NULL DEFAULT NULL,
  `payment_method_id` int(11) NULL DEFAULT NULL,
  `amount` double NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `payment_method_id`(`payment_method_id`) USING BTREE,
  INDEX `daily_closure_id`(`daily_closure_id`) USING BTREE,
  CONSTRAINT `closure_payment_ibfk_2` FOREIGN KEY (`payment_method_id`) REFERENCES `method_pay` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `closure_payment_ibfk_3` FOREIGN KEY (`daily_closure_id`) REFERENCES `daily_closure` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 13 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for closure_status_proccess
-- ----------------------------
DROP TABLE IF EXISTS `closure_status_proccess`;
CREATE TABLE `closure_status_proccess`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `daily_closure_id` int(11) NULL DEFAULT NULL,
  `status_process_id` int(11) NULL DEFAULT NULL,
  `amount` double NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `status_process_id`(`status_process_id`) USING BTREE,
  INDEX `closure_status_proccess_ibfk_3`(`daily_closure_id`) USING BTREE,
  CONSTRAINT `closure_status_proccess_ibfk_2` FOREIGN KEY (`status_process_id`) REFERENCES `status_process` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `closure_status_proccess_ibfk_3` FOREIGN KEY (`daily_closure_id`) REFERENCES `daily_closure` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for customers
-- ----------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `phone` varchar(12) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `contact` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `status` int(11) NULL DEFAULT 1,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for daily_closure
-- ----------------------------
DROP TABLE IF EXISTS `daily_closure`;
CREATE TABLE `daily_closure`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `total` double NULL DEFAULT NULL,
  `tax` double NULL DEFAULT NULL,
  `subtotal` double NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT NULL,
  `active` int(11) NULL DEFAULT NULL,
  `total_orders` int(11) NULL DEFAULT NULL,
  `employee_id` int(11) NULL DEFAULT NULL,
  `subsidiary_id` int(11) NULL DEFAULT NULL,
  `closure_date` datetime(0) NULL DEFAULT NULL,
  `total_shifts` double NULL DEFAULT NULL,
  `total_cash` double NULL DEFAULT NULL,
  `total_card` double NULL DEFAULT NULL,
  `total_transfer` double NULL DEFAULT NULL,
  `total_discount` double NULL DEFAULT NULL,
  `status` double NULL DEFAULT NULL,
  `reopened_by` int(11) NULL DEFAULT NULL,
  `reopen_reason` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `is_legacy` int(11) NULL DEFAULT 0,
  `reopened_at` datetime(0) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `employee_id`(`employee_id`) USING BTREE,
  INDEX `subsidiary_id`(`subsidiary_id`) USING BTREE,
  INDEX `reopened_by`(`reopened_by`) USING BTREE,
  CONSTRAINT `daily_closure_ibfk_1` FOREIGN KEY (`subsidiary_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_ibfk_2` FOREIGN KEY (`employee_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_ibfk_3` FOREIGN KEY (`reopened_by`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for detail_inflow_format
-- ----------------------------
DROP TABLE IF EXISTS `detail_inflow_format`;
CREATE TABLE `detail_inflow_format`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT 0,
  `position` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `inflow_format_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `inflow_format_id`(`inflow_format_id`) USING BTREE,
  CONSTRAINT `detail_inflow_format_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `detail_inflow_format_ibfk_2` FOREIGN KEY (`inflow_format_id`) REFERENCES `inflow_format` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for detail_inventory_adjustment
-- ----------------------------
DROP TABLE IF EXISTS `detail_inventory_adjustment`;
CREATE TABLE `detail_inventory_adjustment`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `system_quantity` double NOT NULL DEFAULT 0,
  `physical_quantity` double NOT NULL DEFAULT 0,
  `difference` double NOT NULL DEFAULT 0,
  `cost` double NOT NULL DEFAULT 0,
  `cost_diff` double NOT NULL DEFAULT 0,
  `previous_stock` double NOT NULL DEFAULT 0,
  `resulting_stock` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `inventory_adjustment_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `inventory_adjustment_id`(`inventory_adjustment_id`) USING BTREE,
  CONSTRAINT `detail_inventory_adjustment_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `detail_inventory_adjustment_ibfk_2` FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `inventory_adjustment` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for detail_inventory_inflow
-- ----------------------------
DROP TABLE IF EXISTS `detail_inventory_inflow`;
CREATE TABLE `detail_inventory_inflow`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_code` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `quantity` double NOT NULL DEFAULT 0,
  `confirmed_quantity` double NULL DEFAULT NULL,
  `cost` double NOT NULL DEFAULT 0,
  `subtotal` double NOT NULL DEFAULT 0,
  `previous_stock` double NOT NULL DEFAULT 0,
  `resulting_stock` double NOT NULL DEFAULT 0,
  `expires_at` date NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `inventory_inflow_id` int(11) NOT NULL,
  `unit_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `inventory_inflow_id`(`inventory_inflow_id`) USING BTREE,
  INDEX `unit_id`(`unit_id`) USING BTREE,
  CONSTRAINT `detail_inventory_inflow_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `detail_inventory_inflow_ibfk_2` FOREIGN KEY (`inventory_inflow_id`) REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `detail_inventory_inflow_ibfk_3` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for detail_inventory_shrinkage
-- ----------------------------
DROP TABLE IF EXISTS `detail_inventory_shrinkage`;
CREATE TABLE `detail_inventory_shrinkage`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT 0,
  `cost` double NOT NULL DEFAULT 0,
  `subtotal_loss` double NOT NULL DEFAULT 0,
  `previous_stock` double NOT NULL DEFAULT 0,
  `resulting_stock` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `inventory_shrinkage_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `inventory_shrinkage_id`(`inventory_shrinkage_id`) USING BTREE,
  CONSTRAINT `detail_inventory_shrinkage_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `detail_inventory_shrinkage_ibfk_2` FOREIGN KEY (`inventory_shrinkage_id`) REFERENCES `inventory_shrinkage` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for detail_inventory_transfer
-- ----------------------------
DROP TABLE IF EXISTS `detail_inventory_transfer`;
CREATE TABLE `detail_inventory_transfer`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT 0,
  `cost` double NOT NULL DEFAULT 0,
  `subtotal` double NOT NULL DEFAULT 0,
  `origin_stock_prev` double NOT NULL DEFAULT 0,
  `origin_stock_post` double NOT NULL DEFAULT 0,
  `destination_stock_prev` double NULL DEFAULT NULL,
  `destination_stock_post` double NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `inventory_transfer_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `inventory_transfer_id`(`inventory_transfer_id`) USING BTREE,
  CONSTRAINT `detail_inventory_transfer_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `detail_inventory_transfer_ibfk_2` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for event_item
-- ----------------------------
DROP TABLE IF EXISTS `event_item`;
CREATE TABLE `event_item`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_id` int(11) NULL DEFAULT NULL,
  `package_id` int(11) NULL DEFAULT NULL,
  `product_id` int(11) NULL DEFAULT NULL,
  `quantity` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `package_id`(`package_id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE
) ENGINE = MyISAM AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Fixed;

-- ----------------------------
-- Table structure for evt_category
-- ----------------------------
DROP TABLE IF EXISTS `evt_category`;
CREATE TABLE `evt_category`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `category` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `status` int(11) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_classification
-- ----------------------------
DROP TABLE IF EXISTS `evt_classification`;
CREATE TABLE `evt_classification`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `classification` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `active` smallint(6) NULL DEFAULT 1,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  CONSTRAINT `evt_classification_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_dishes
-- ----------------------------
DROP TABLE IF EXISTS `evt_dishes`;
CREATE TABLE `evt_dishes`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NULL DEFAULT NULL,
  `dish` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT '',
  `tiempo` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `id_menu` int(11) NULL DEFAULT NULL,
  `id_event` int(11) NULL DEFAULT NULL,
  `id_clasificacion` int(11) NULL DEFAULT NULL,
  `observation` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `extra` smallint(6) NULL DEFAULT 0,
  `cost` double NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `id_event`(`id_event`) USING BTREE,
  INDEX `evt_dishes_ibfk_1`(`id_menu`) USING BTREE,
  INDEX `id_clasificacion`(`id_clasificacion`) USING BTREE,
  CONSTRAINT `evt_dishes_ibfk_1` FOREIGN KEY (`id_menu`) REFERENCES `evt_menu` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_dishes_ibfk_2` FOREIGN KEY (`id_event`) REFERENCES `evt_events` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_dishes_ibfk_3` FOREIGN KEY (`id_clasificacion`) REFERENCES `evt_classification` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_events
-- ----------------------------
DROP TABLE IF EXISTS `evt_events`;
CREATE TABLE `evt_events`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name_event` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `date_start` datetime(0) NULL DEFAULT NULL,
  `date_end` datetime(0) NULL DEFAULT NULL,
  `total_pay` double NULL DEFAULT NULL,
  `notes` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `status_process_id` int(11) NULL DEFAULT NULL,
  `location` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `name_client` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `phone` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `email` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `type_event` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `category_id` int(11) NULL DEFAULT 1,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `evt_menu_id` int(11) NULL DEFAULT NULL,
  `quantity_people` int(11) NULL DEFAULT NULL,
  `advanced_pay` double NULL DEFAULT NULL,
  `method_pay_id` int(11) NULL DEFAULT NULL,
  `discount` double NULL DEFAULT NULL,
  `info_discount` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `status_process_id`(`status_process_id`) USING BTREE,
  INDEX `category_id`(`category_id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `evt_menu_id`(`evt_menu_id`) USING BTREE,
  INDEX `method_pay_id`(`method_pay_id`) USING BTREE,
  CONSTRAINT `evt_events_ibfk_1` FOREIGN KEY (`status_process_id`) REFERENCES `status_process` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_events_ibfk_4` FOREIGN KEY (`category_id`) REFERENCES `evt_category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_events_ibfk_5` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_events_ibfk_6` FOREIGN KEY (`evt_menu_id`) REFERENCES `evt_menu` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_events_ibfk_7` FOREIGN KEY (`method_pay_id`) REFERENCES `method_pay` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for evt_events_package
-- ----------------------------
DROP TABLE IF EXISTS `evt_events_package`;
CREATE TABLE `evt_events_package`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `event_id` int(11) NULL DEFAULT NULL,
  `subevent_id` int(11) NULL DEFAULT NULL,
  `package_id` int(11) NULL DEFAULT NULL,
  `quantity` int(11) NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `product_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `event_id`(`event_id`) USING BTREE,
  INDEX `subevent_id`(`subevent_id`) USING BTREE,
  INDEX `evt_events_package_ibfk_4`(`product_id`) USING BTREE,
  INDEX `evt_events_package_ibfk_3`(`package_id`) USING BTREE,
  CONSTRAINT `evt_events_package_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `evt_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `evt_events_package_ibfk_2` FOREIGN KEY (`subevent_id`) REFERENCES `evt_subevents` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `evt_events_package_ibfk_3` FOREIGN KEY (`package_id`) REFERENCES `evt_package` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_events_package_ibfk_4` FOREIGN KEY (`product_id`) REFERENCES `evt_products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_histories
-- ----------------------------
DROP TABLE IF EXISTS `evt_histories`;
CREATE TABLE `evt_histories`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `action` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `evt_events_id` int(11) NULL DEFAULT NULL,
  `usr_users_id` int(11) NULL DEFAULT NULL,
  `date_action` datetime(0) NULL DEFAULT NULL,
  `comment` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `type` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `evt_subevents_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `evt_events_id`(`evt_events_id`) USING BTREE,
  INDEX `usr_users_id`(`usr_users_id`) USING BTREE,
  INDEX `evt_subevents_id`(`evt_subevents_id`) USING BTREE,
  CONSTRAINT `evt_histories_ibfk_1` FOREIGN KEY (`evt_events_id`) REFERENCES `evt_events` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_histories_ibfk_2` FOREIGN KEY (`usr_users_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_histories_ibfk_3` FOREIGN KEY (`evt_subevents_id`) REFERENCES `evt_subevents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for evt_menu
-- ----------------------------
DROP TABLE IF EXISTS `evt_menu`;
CREATE TABLE `evt_menu`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `package_type` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `total` double NULL DEFAULT NULL,
  `id_sub_event` int(11) NULL DEFAULT NULL,
  `id_event` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `id_sub_event`(`id_sub_event`) USING BTREE,
  INDEX `id_event`(`id_event`) USING BTREE,
  CONSTRAINT `evt_menu_ibfk_1` FOREIGN KEY (`id_sub_event`) REFERENCES `evt_subevents` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `evt_menu_ibfk_2` FOREIGN KEY (`id_event`) REFERENCES `evt_events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_package
-- ----------------------------
DROP TABLE IF EXISTS `evt_package`;
CREATE TABLE `evt_package`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `description` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `price_person` double NULL DEFAULT NULL,
  `active` smallint(6) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_package_products
-- ----------------------------
DROP TABLE IF EXISTS `evt_package_products`;
CREATE TABLE `evt_package_products`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_id` int(11) NULL DEFAULT NULL,
  `products_id` int(11) NULL DEFAULT NULL,
  `quantity` int(11) NULL DEFAULT NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `package_id`(`package_id`) USING BTREE,
  INDEX `products_id`(`products_id`) USING BTREE,
  CONSTRAINT `evt_package_products_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `evt_package` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `evt_package_products_ibfk_2` FOREIGN KEY (`products_id`) REFERENCES `evt_products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_payments
-- ----------------------------
DROP TABLE IF EXISTS `evt_payments`;
CREATE TABLE `evt_payments`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pay` double NULL DEFAULT NULL,
  `date_pay` datetime(0) NULL DEFAULT NULL,
  `method_pay_id` int(11) NULL DEFAULT NULL,
  `evt_events_id` int(11) NULL DEFAULT NULL,
  `evt_subevents_id` int(11) NULL DEFAULT NULL,
  `type` int(11) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `method_pay_id`(`method_pay_id`) USING BTREE,
  INDEX `evt_events_id`(`evt_events_id`) USING BTREE,
  INDEX `evt_payments_ibfk_3`(`evt_subevents_id`) USING BTREE,
  CONSTRAINT `evt_payments_ibfk_1` FOREIGN KEY (`method_pay_id`) REFERENCES `method_pay` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_payments_ibfk_2` FOREIGN KEY (`evt_events_id`) REFERENCES `evt_events` (`id`) ON DELETE SET NULL ON UPDATE SET NULL,
  CONSTRAINT `evt_payments_ibfk_3` FOREIGN KEY (`evt_subevents_id`) REFERENCES `evt_subevents` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for evt_products
-- ----------------------------
DROP TABLE IF EXISTS `evt_products`;
CREATE TABLE `evt_products`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `price` double NULL DEFAULT NULL,
  `id_classification` int(11) NULL DEFAULT NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `active` smallint(6) NULL DEFAULT 1,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `id_clasification`(`id_classification`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  CONSTRAINT `evt_products_ibfk_1` FOREIGN KEY (`id_classification`) REFERENCES `evt_classification` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `evt_products_ibfk_2` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for evt_subevents
-- ----------------------------
DROP TABLE IF EXISTS `evt_subevents`;
CREATE TABLE `evt_subevents`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `evt_events_id` int(11) NULL DEFAULT NULL,
  `name_subevent` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `date_start` date NULL DEFAULT NULL,
  `time_start` time(0) NULL DEFAULT NULL,
  `date_end` date NULL DEFAULT NULL,
  `time_end` time(0) NULL DEFAULT NULL,
  `total_pay` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `notes` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `status_process_id` int(11) NULL DEFAULT NULL,
  `location` varchar(200) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `type_event` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `evt_menu_id` int(11) NULL DEFAULT NULL,
  `quantity_people` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `evt_events_id`(`evt_events_id`) USING BTREE,
  INDEX `status_process_id`(`status_process_id`) USING BTREE,
  INDEX `evt_menu_id`(`evt_menu_id`) USING BTREE,
  CONSTRAINT `evt_subevents_ibfk_1` FOREIGN KEY (`evt_events_id`) REFERENCES `evt_events` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for folio_sequence
-- ----------------------------
DROP TABLE IF EXISTS `folio_sequence`;
CREATE TABLE `folio_sequence`  (
  `companies_id` int(11) NOT NULL,
  `sequence_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_number` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`companies_id`, `sequence_code`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inflow_format
-- ----------------------------
DROP TABLE IF EXISTS `inflow_format`;
CREATE TABLE `inflow_format`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `scope` enum('user','subsidiary','company') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_units` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `inflow_origin_id` int(11) NULL DEFAULT NULL,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `scope`(`scope`) USING BTREE,
  INDEX `inflow_origin_id`(`inflow_origin_id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  CONSTRAINT `inflow_format_ibfk_1` FOREIGN KEY (`inflow_origin_id`) REFERENCES `inflow_origin` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `inflow_format_ibfk_2` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inflow_format_ibfk_3` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inflow_format_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inflow_origin
-- ----------------------------
DROP TABLE IF EXISTS `inflow_origin`;
CREATE TABLE `inflow_origin`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `color_hex` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `requires_supplier` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_inflow_origin_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_adjustment
-- ----------------------------
DROP TABLE IF EXISTS `inventory_adjustment`;
CREATE TABLE `inventory_adjustment`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `adjustment_type` enum('individual','fisico') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'individual',
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_diff_units` double NOT NULL DEFAULT 0,
  `total_diff_cost` double NOT NULL DEFAULT 0,
  `date_adjustment` date NOT NULL,
  `time_adjustment` time(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `status` enum('Pendiente','Aplicado','Revertido') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Aplicado',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `subsidiaries_id` int(11) NOT NULL,
  `registered_user_id` int(11) NOT NULL,
  `authorized_user_id` int(11) NULL DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  `adjustment_reason_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_inventory_adjustment_folio`(`folio`, `companies_id`) USING BTREE,
  INDEX `status`(`status`) USING BTREE,
  INDEX `date_adjustment`(`date_adjustment`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `registered_user_id`(`registered_user_id`) USING BTREE,
  INDEX `authorized_user_id`(`authorized_user_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `adjustment_reason_id`(`adjustment_reason_id`) USING BTREE,
  INDEX `warehouse_id`(`warehouse_id`) USING BTREE,
  CONSTRAINT `inventory_adjustment_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_adjustment_ibfk_2` FOREIGN KEY (`registered_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_adjustment_ibfk_3` FOREIGN KEY (`authorized_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_adjustment_ibfk_4` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_adjustment_ibfk_5` FOREIGN KEY (`adjustment_reason_id`) REFERENCES `adjustment_reason` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_adjustment_ibfk_6` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_inflow
-- ----------------------------
DROP TABLE IF EXISTS `inventory_inflow`;
CREATE TABLE `inventory_inflow`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_units` double NOT NULL DEFAULT 0,
  `total_cost` double NOT NULL DEFAULT 0,
  `date_inflow` date NOT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `status` enum('Pendiente','Aplicada','Revertida','Cancelada') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Aplicada',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `subsidiaries_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `confirmed_user_id` int(11) NULL DEFAULT NULL,
  `confirmed_at` datetime(0) NULL DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  `inflow_origin_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `supplier_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_inventory_inflow_folio`(`folio`, `companies_id`) USING BTREE,
  INDEX `status`(`status`) USING BTREE,
  INDEX `date_inflow`(`date_inflow`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `inflow_origin_id`(`inflow_origin_id`) USING BTREE,
  INDEX `warehouse_id`(`warehouse_id`) USING BTREE,
  INDEX `supplier_id`(`supplier_id`) USING BTREE,
  CONSTRAINT `inventory_inflow_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_inflow_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_inflow_ibfk_3` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_inflow_ibfk_4` FOREIGN KEY (`inflow_origin_id`) REFERENCES `inflow_origin` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_inflow_ibfk_5` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_inflow_ibfk_6` FOREIGN KEY (`supplier_id`) REFERENCES `supplier` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_shrinkage
-- ----------------------------
DROP TABLE IF EXISTS `inventory_shrinkage`;
CREATE TABLE `inventory_shrinkage`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `evidence_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_units` double NOT NULL DEFAULT 0,
  `total_cost_loss` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `status` enum('Aplicada','Revertida') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Aplicada',
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `subsidiaries_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  `shrinkage_reason_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_inventory_shrinkage_folio`(`folio`, `companies_id`) USING BTREE,
  INDEX `status`(`status`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `shrinkage_reason_id`(`shrinkage_reason_id`) USING BTREE,
  INDEX `warehouse_id`(`warehouse_id`) USING BTREE,
  CONSTRAINT `inventory_shrinkage_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_shrinkage_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_shrinkage_ibfk_3` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_shrinkage_ibfk_4` FOREIGN KEY (`shrinkage_reason_id`) REFERENCES `shrinkage_reason` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_shrinkage_ibfk_5` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_transfer
-- ----------------------------
DROP TABLE IF EXISTS `inventory_transfer`;
CREATE TABLE `inventory_transfer`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `folio` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `total_products` int(11) NOT NULL DEFAULT 0,
  `total_units` double NOT NULL DEFAULT 0,
  `total_cost` double NOT NULL DEFAULT 0,
  `date_request` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `date_authorized` datetime(0) NULL DEFAULT NULL,
  `date_sent` datetime(0) NULL DEFAULT NULL,
  `date_received` datetime(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `status_id` int(11) NOT NULL,
  `origin_subsidiaries_id` int(11) NOT NULL,
  `destination_subsidiaries_id` int(11) NOT NULL,
  `requested_user_id` int(11) NOT NULL,
  `authorized_user_id` int(11) NULL DEFAULT NULL,
  `received_user_id` int(11) NULL DEFAULT NULL,
  `companies_id` int(11) NOT NULL,
  `origin_warehouse_id` int(11) NOT NULL,
  `destination_warehouse_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_inventory_transfer_folio`(`folio`, `companies_id`) USING BTREE,
  INDEX `status_id`(`status_id`) USING BTREE,
  INDEX `origin_subsidiaries_id`(`origin_subsidiaries_id`) USING BTREE,
  INDEX `destination_subsidiaries_id`(`destination_subsidiaries_id`) USING BTREE,
  INDEX `requested_user_id`(`requested_user_id`) USING BTREE,
  INDEX `authorized_user_id`(`authorized_user_id`) USING BTREE,
  INDEX `received_user_id`(`received_user_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `origin_warehouse_id`(`origin_warehouse_id`) USING BTREE,
  INDEX `destination_warehouse_id`(`destination_warehouse_id`) USING BTREE,
  CONSTRAINT `inventory_transfer_ibfk_1` FOREIGN KEY (`status_id`) REFERENCES `transfer_status` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_2` FOREIGN KEY (`origin_subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_3` FOREIGN KEY (`destination_subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_4` FOREIGN KEY (`requested_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_5` FOREIGN KEY (`authorized_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_6` FOREIGN KEY (`received_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_7` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_8` FOREIGN KEY (`origin_warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_ibfk_9` FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for inventory_transfer_history
-- ----------------------------
DROP TABLE IF EXISTS `inventory_transfer_history`;
CREATE TABLE `inventory_transfer_history`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `note` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `transitioned_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `status_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `inventory_transfer_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `status_id`(`status_id`) USING BTREE,
  INDEX `user_id`(`user_id`) USING BTREE,
  INDEX `inventory_transfer_id`(`inventory_transfer_id`) USING BTREE,
  CONSTRAINT `inventory_transfer_history_ibfk_1` FOREIGN KEY (`status_id`) REFERENCES `transfer_status` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_history_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `inventory_transfer_history_ibfk_3` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for method_pay
-- ----------------------------
DROP TABLE IF EXISTS `method_pay`;
CREATE TABLE `method_pay`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `method_pay` varchar(20) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `code` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for order
-- ----------------------------
DROP TABLE IF EXISTS `order`;
CREATE TABLE `order`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `note` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_birthday` datetime(0) NULL DEFAULT NULL,
  `status` int(11) NULL DEFAULT NULL,
  `is_pos` tinyint(4) NOT NULL DEFAULT 0,
  `location` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT '',
  `total_pay` double NULL DEFAULT NULL,
  `tip_amount` double NOT NULL DEFAULT 0,
  `discount` double NULL DEFAULT NULL,
  `info_discount` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_order` date NULL DEFAULT NULL,
  `time_order` time(0) NULL DEFAULT NULL,
  `is_delivery` int(11) NULL DEFAULT NULL,
  `delivery_tipe` int(11) NULL DEFAULT NULL,
  `client_id` int(11) NULL DEFAULT NULL,
  `type_id` int(11) NULL DEFAULT NULL,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `delivery_type` int(11) NULL DEFAULT 0,
  `is_delivered` int(11) NULL DEFAULT 0,
  `daily_closure_id` int(11) NULL DEFAULT NULL,
  `cash_shift_id` int(11) NULL DEFAULT NULL,
  `cancelled_by` int(11) NULL DEFAULT NULL,
  `cancelled_at` datetime(0) NULL DEFAULT NULL,
  `order_type` enum('pedido','mostrador') CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `is_legacy` int(11) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `client_id`(`client_id`) USING BTREE,
  INDEX `status`(`status`) USING BTREE,
  INDEX `type_id`(`type_id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `daily_closure_id`(`daily_closure_id`) USING BTREE,
  INDEX `cash_shift_id`(`cash_shift_id`) USING BTREE,
  CONSTRAINT `order_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `order_clients` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `order_ibfk_2` FOREIGN KEY (`status`) REFERENCES `status_process` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_ibfk_4` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_ibfk_5` FOREIGN KEY (`daily_closure_id`) REFERENCES `daily_closure` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_ibfk_6` FOREIGN KEY (`cash_shift_id`) REFERENCES `cash_shift` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 377 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_category
-- ----------------------------
DROP TABLE IF EXISTS `order_category`;
CREATE TABLE `order_category`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `classification` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `active` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `description` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  CONSTRAINT `order_category_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 14 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_clients
-- ----------------------------
DROP TABLE IF EXISTS `order_clients`;
CREATE TABLE `order_clients`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `phone` double NULL DEFAULT NULL,
  `email` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT '',
  `active` int(11) NULL DEFAULT NULL,
  `date_create` datetime(0) NULL DEFAULT NULL,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  CONSTRAINT `order_clients_ibfk_1` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 322 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_custom
-- ----------------------------
DROP TABLE IF EXISTS `order_custom`;
CREATE TABLE `order_custom`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `date_created` datetime(0) NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `price_real` double NULL DEFAULT NULL,
  `portion_qty` int(11) NULL DEFAULT NULL,
  `description` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `image` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 304 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_custom_products
-- ----------------------------
DROP TABLE IF EXISTS `order_custom_products`;
CREATE TABLE `order_custom_products`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_created` datetime(0) NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `quantity` double NULL DEFAULT NULL,
  `details` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT '',
  `custom_id` int(11) NULL DEFAULT NULL,
  `modifier_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `modifier_id`(`modifier_id`) USING BTREE,
  INDEX `customer_id`(`custom_id`) USING BTREE,
  CONSTRAINT `order_custom_products_ibfk_1` FOREIGN KEY (`modifier_id`) REFERENCES `order_modifier_products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_custom_products_ibfk_2` FOREIGN KEY (`custom_id`) REFERENCES `order_custom` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1903 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_histories
-- ----------------------------
DROP TABLE IF EXISTS `order_histories`;
CREATE TABLE `order_histories`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `action` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_action` datetime(0) NULL DEFAULT NULL,
  `comment` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `type` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `order_id` int(11) NULL DEFAULT NULL,
  `usr_users_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `evt_events_id`(`order_id`) USING BTREE,
  INDEX `usr_users_id`(`usr_users_id`) USING BTREE,
  CONSTRAINT `order_histories_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `order` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 146 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for order_images
-- ----------------------------
DROP TABLE IF EXISTS `order_images`;
CREATE TABLE `order_images`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `path` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `name` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `original_name` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_created` datetime(0) NULL DEFAULT NULL,
  `package_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`package_id`) USING BTREE,
  CONSTRAINT `order_images_ibfk_1` FOREIGN KEY (`package_id`) REFERENCES `order_package` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 49 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_modifier
-- ----------------------------
DROP TABLE IF EXISTS `order_modifier`;
CREATE TABLE `order_modifier`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `active` int(11) NULL DEFAULT 1,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `isExtra` smallint(6) NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 12 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_modifier_products
-- ----------------------------
DROP TABLE IF EXISTS `order_modifier_products`;
CREATE TABLE `order_modifier_products`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `cant` double NULL DEFAULT 1,
  `description` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `modifier_id` int(11) NULL DEFAULT NULL,
  `active` int(11) NULL DEFAULT 1,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `order_modifier_products_ibfk_1`(`modifier_id`) USING BTREE,
  CONSTRAINT `order_modifier_products_ibfk_1` FOREIGN KEY (`modifier_id`) REFERENCES `order_modifier` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 217 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_package
-- ----------------------------
DROP TABLE IF EXISTS `order_package`;
CREATE TABLE `order_package`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `modifier_id` int(11) NULL DEFAULT NULL,
  `quantity` int(11) NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `status` int(11) NULL DEFAULT NULL,
  `order_details` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT '',
  `dedication` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT '',
  `custom_id` int(11) NULL DEFAULT NULL,
  `product_id` int(11) NULL DEFAULT NULL,
  `pedidos_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `product_id`(`product_id`) USING BTREE,
  INDEX `pedidos_id`(`pedidos_id`) USING BTREE,
  INDEX `modifier_id`(`modifier_id`) USING BTREE,
  INDEX `customer_id`(`custom_id`) USING BTREE,
  CONSTRAINT `order_package_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_package_ibfk_2` FOREIGN KEY (`pedidos_id`) REFERENCES `order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_package_ibfk_3` FOREIGN KEY (`modifier_id`) REFERENCES `order_modifier_products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `order_package_ibfk_4` FOREIGN KEY (`custom_id`) REFERENCES `order_custom` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 430 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_payments
-- ----------------------------
DROP TABLE IF EXISTS `order_payments`;
CREATE TABLE `order_payments`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `pay` double NULL DEFAULT NULL,
  `date_pay` datetime(0) NULL DEFAULT NULL,
  `method_pay_id` int(11) NULL DEFAULT NULL,
  `order_id` int(11) NULL DEFAULT NULL,
  `type` int(11) NULL DEFAULT NULL,
  `description` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `pedidos_id`(`order_id`) USING BTREE,
  INDEX `pedidos_payments_ibfk_2`(`method_pay_id`) USING BTREE,
  CONSTRAINT `order_payments_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `order` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `order_payments_ibfk_2` FOREIGN KEY (`method_pay_id`) REFERENCES `method_pay` (`id`) ON DELETE CASCADE ON UPDATE SET NULL
) ENGINE = InnoDB AUTO_INCREMENT = 426 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for order_products
-- ----------------------------
DROP TABLE IF EXISTS `order_products`;
CREATE TABLE `order_products`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `price` double NULL DEFAULT NULL,
  `category_id` int(11) NULL DEFAULT NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `active` int(11) NULL DEFAULT 1,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `description` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `image` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `companies_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `classification_id`(`category_id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  CONSTRAINT `order_products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `order_category` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_products_ibfk_2` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_products_ibfk_3` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 521 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for pos_discount_reason
-- ----------------------------
DROP TABLE IF EXISTS `pos_discount_reason`;
CREATE TABLE `pos_discount_reason`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `requires_authorization` tinyint(1) NULL DEFAULT 0,
  `max_percentage` double NULL DEFAULT 100,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_pos_discount_reason_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for pos_order_discount
-- ----------------------------
DROP TABLE IF EXISTS `pos_order_discount`;
CREATE TABLE `pos_order_discount`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `scope` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'order',
  `coupon_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `amount` double NULL DEFAULT 0,
  `percentage` double NULL DEFAULT 0,
  `applied_at` datetime(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `order_id` int(11) NULL DEFAULT NULL,
  `order_package_id` int(11) NULL DEFAULT NULL,
  `pos_discount_reason_id` int(10) UNSIGNED NULL DEFAULT NULL,
  `authorized_by_user_id` int(11) NULL DEFAULT NULL,
  `active` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_pod_order_id`(`order_id`) USING BTREE,
  INDEX `idx_pod_order_package_id`(`order_package_id`) USING BTREE,
  INDEX `idx_pod_reason_id`(`pos_discount_reason_id`) USING BTREE,
  INDEX `idx_pod_authorized_by`(`authorized_by_user_id`) USING BTREE,
  INDEX `idx_pod_applied_at`(`applied_at`) USING BTREE,
  CONSTRAINT `fk_pod_authorized_by` FOREIGN KEY (`authorized_by_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pod_order` FOREIGN KEY (`order_id`) REFERENCES `order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pod_order_package` FOREIGN KEY (`order_package_id`) REFERENCES `order_package` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pod_reason` FOREIGN KEY (`pos_discount_reason_id`) REFERENCES `pos_discount_reason` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for pos_order_payment
-- ----------------------------
DROP TABLE IF EXISTS `pos_order_payment`;
CREATE TABLE `pos_order_payment`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `amount` double NULL DEFAULT 0,
  `tendered_amount` double NULL DEFAULT 0,
  `change_amount` double NULL DEFAULT 0,
  `paid_at` datetime(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `order_id` int(11) NULL DEFAULT NULL,
  `pos_payment_type_id` int(10) UNSIGNED NULL DEFAULT NULL,
  `user_id` int(11) NULL DEFAULT NULL,
  `active` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_pop_order_id`(`order_id`) USING BTREE,
  INDEX `idx_pop_payment_type_id`(`pos_payment_type_id`) USING BTREE,
  INDEX `idx_pop_user_id`(`user_id`) USING BTREE,
  INDEX `idx_pop_paid_at`(`paid_at`) USING BTREE,
  CONSTRAINT `fk_pop_order` FOREIGN KEY (`order_id`) REFERENCES `order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pop_payment_type` FOREIGN KEY (`pos_payment_type_id`) REFERENCES `pos_payment_type` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_pop_user` FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for pos_payment_type
-- ----------------------------
DROP TABLE IF EXISTS `pos_payment_type`;
CREATE TABLE `pos_payment_type`  (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `name` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `is_cash` tinyint(1) NULL DEFAULT 0,
  `is_visible` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_pos_payment_type_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 7 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for product_attribute
-- ----------------------------
DROP TABLE IF EXISTS `product_attribute`;
CREATE TABLE `product_attribute`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `shelf_life_days` int(11) NULL DEFAULT NULL,
  `cost_unit` double NOT NULL DEFAULT 0,
  `stock_min` double NOT NULL DEFAULT 0,
  `stock_max` double NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  `warehouse_area_id` int(11) NULL DEFAULT NULL,
  `unit_id` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_product_attribute_product`(`product_id`) USING BTREE,
  UNIQUE INDEX `uq_product_attribute_sku`(`sku`, `companies_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `warehouse_area_id`(`warehouse_area_id`) USING BTREE,
  INDEX `unit_id`(`unit_id`) USING BTREE,
  CONSTRAINT `product_attribute_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `product_attribute_ibfk_2` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `product_attribute_ibfk_3` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `product_attribute_ibfk_4` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 424 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for reservation
-- ----------------------------
DROP TABLE IF EXISTS `reservation`;
CREATE TABLE `reservation`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name_event` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `date_creation` datetime(0) NULL DEFAULT NULL,
  `date_start` datetime(0) NULL DEFAULT NULL,
  `date_end` datetime(0) NULL DEFAULT NULL,
  `total_pay` double NULL DEFAULT NULL,
  `notes` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `status_process_id` int(11) NULL DEFAULT NULL,
  `location` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `name_client` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `phone` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `email` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `type_event` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `category_id` int(11) NULL DEFAULT 1,
  `subsidiaries_id` int(11) NULL DEFAULT NULL,
  `evt_menu_id` int(11) NULL DEFAULT NULL,
  `quantity_people` int(11) NULL DEFAULT NULL,
  `advanced_pay` double NULL DEFAULT NULL,
  `method_pay_id` int(11) NULL DEFAULT NULL,
  `discount` double NULL DEFAULT NULL,
  `info_discount` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `status_reservation_id` int(11) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `status_process_id`(`status_process_id`) USING BTREE,
  INDEX `category_id`(`category_id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `evt_menu_id`(`evt_menu_id`) USING BTREE,
  INDEX `method_pay_id`(`method_pay_id`) USING BTREE,
  INDEX `status_reservation_id`(`status_reservation_id`) USING BTREE,
  CONSTRAINT `reservation_ibfk_1` FOREIGN KEY (`status_process_id`) REFERENCES `status_process` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `reservation_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `evt_category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `reservation_ibfk_3` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `reservation_ibfk_4` FOREIGN KEY (`evt_menu_id`) REFERENCES `evt_menu` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `reservation_ibfk_5` FOREIGN KEY (`method_pay_id`) REFERENCES `method_pay` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `reservation_ibfk_6` FOREIGN KEY (`status_reservation_id`) REFERENCES `reservation_status` (`id`) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for reservation_histories
-- ----------------------------
DROP TABLE IF EXISTS `reservation_histories`;
CREATE TABLE `reservation_histories`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `action` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `reservation_id` int(11) NULL DEFAULT NULL,
  `usr_users_id` int(11) NULL DEFAULT NULL,
  `date_action` datetime(0) NULL DEFAULT NULL,
  `comment` text CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL,
  `type` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `evt_events_id`(`reservation_id`) USING BTREE,
  INDEX `usr_users_id`(`usr_users_id`) USING BTREE,
  CONSTRAINT `reservation_histories_ibfk_2` FOREIGN KEY (`usr_users_id`) REFERENCES `fayxzvov_alpha`.`usr_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `reservation_histories_ibfk_3` FOREIGN KEY (`reservation_id`) REFERENCES `reservation` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for reservation_status
-- ----------------------------
DROP TABLE IF EXISTS `reservation_status`;
CREATE TABLE `reservation_status`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  `active` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for shift_payment
-- ----------------------------
DROP TABLE IF EXISTS `shift_payment`;
CREATE TABLE `shift_payment`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cash_shift_id` int(11) NULL DEFAULT NULL,
  `payment_method_id` int(11) NULL DEFAULT NULL,
  `amount` double NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `cash_shift_id`(`cash_shift_id`) USING BTREE,
  INDEX `payment_method_id`(`payment_method_id`) USING BTREE,
  CONSTRAINT `shift_payment_ibfk_1` FOREIGN KEY (`cash_shift_id`) REFERENCES `cash_shift` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `shift_payment_ibfk_2` FOREIGN KEY (`payment_method_id`) REFERENCES `method_pay` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 115 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for shift_status_process
-- ----------------------------
DROP TABLE IF EXISTS `shift_status_process`;
CREATE TABLE `shift_status_process`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cash_shift_id` int(11) NULL DEFAULT NULL,
  `status_process_id` int(11) NULL DEFAULT NULL,
  `amount` double NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `shift_status_process_ibfk_1`(`status_process_id`) USING BTREE,
  INDEX `cash_shift_id`(`cash_shift_id`) USING BTREE,
  CONSTRAINT `shift_status_process_ibfk_1` FOREIGN KEY (`status_process_id`) REFERENCES `status_process` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `shift_status_process_ibfk_2` FOREIGN KEY (`cash_shift_id`) REFERENCES `cash_shift` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 115 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for shrinkage_reason
-- ----------------------------
DROP TABLE IF EXISTS `shrinkage_reason`;
CREATE TABLE `shrinkage_reason`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `color_hex` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_shrinkage_reason_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for status_process
-- ----------------------------
DROP TABLE IF EXISTS `status_process`;
CREATE TABLE `status_process`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `status` varchar(50) CHARACTER SET latin1 COLLATE latin1_swedish_ci NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = latin1 COLLATE = latin1_swedish_ci ROW_FORMAT = DYNAMIC;

-- ----------------------------
-- Table structure for stock
-- ----------------------------
DROP TABLE IF EXISTS `stock`;
CREATE TABLE `stock`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` double NOT NULL DEFAULT 0,
  `last_movement_at` datetime(0) NULL DEFAULT NULL,
  `last_inventory_at` datetime(0) NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `product_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_stock_product_warehouse`(`product_id`, `warehouse_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `warehouse_id`(`warehouse_id`) USING BTREE,
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `order_products` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `stock_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for supplier
-- ----------------------------
DROP TABLE IF EXISTS `supplier`;
CREATE TABLE `supplier`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(180) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `phone` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `email` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  CONSTRAINT `supplier_ibfk_1` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for transfer_status
-- ----------------------------
DROP TABLE IF EXISTS `transfer_status`;
CREATE TABLE `transfer_status`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_index` tinyint(4) NOT NULL DEFAULT 1,
  `is_terminal` tinyint(1) NOT NULL DEFAULT 0,
  `color_hex` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_transfer_status_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for unit
-- ----------------------------
DROP TABLE IF EXISTS `unit`;
CREATE TABLE `unit`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_unit_code`(`code`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for warehouse
-- ----------------------------
DROP TABLE IF EXISTS `warehouse`;
CREATE TABLE `warehouse`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `warehouse_area_id` int(11) NULL DEFAULT NULL,
  `subsidiaries_id` int(11) NOT NULL,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `subsidiaries_id`(`subsidiaries_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  INDEX `warehouse_area_id`(`warehouse_area_id`) USING BTREE,
  CONSTRAINT `warehouse_ibfk_1` FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `warehouse_ibfk_2` FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `warehouse_ibfk_3` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for warehouse_area
-- ----------------------------
DROP TABLE IF EXISTS `warehouse_area`;
CREATE TABLE `warehouse_area`  (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `color_hex` varchar(7) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
  `created_at` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `companies_id` int(11) NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_warehouse_area_name`(`name`, `companies_id`) USING BTREE,
  INDEX `companies_id`(`companies_id`) USING BTREE,
  CONSTRAINT `warehouse_area_ibfk_1` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- View structure for inventory_movement
-- ----------------------------
DROP VIEW IF EXISTS `inventory_movement`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `inventory_movement` AS select concat('IN-',`d`.`id`) AS `movement_uid`,'ENTRADA' AS `movement_type`,`r`.`folio` AS `folio`,`d`.`product_id` AS `product_id`,coalesce(`d`.`confirmed_quantity`,`d`.`quantity`) AS `quantity`,`d`.`previous_stock` AS `stock_prev`,`d`.`resulting_stock` AS `stock_post`,`d`.`cost` AS `cost_unit`,`d`.`subtotal` AS `cost_total`,`r`.`date_inflow` AS `occurred_at`,`r`.`warehouse_id` AS `warehouse_id`,`r`.`subsidiaries_id` AS `subsidiaries_id`,`r`.`user_id` AS `user_id`,`r`.`note` AS `note`,`r`.`status` AS `status`,`r`.`companies_id` AS `companies_id` from (`detail_inventory_inflow` `d` join `inventory_inflow` `r` on((`r`.`id` = `d`.`inventory_inflow_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`status` = 'Aplicada')) union all select concat('SH-',`d`.`id`) AS `CONCAT('SH-', d.id)`,'MERMA' AS `MERMA`,`r`.`folio` AS `folio`,`d`.`product_id` AS `product_id`,`d`.`quantity` AS `quantity`,`d`.`previous_stock` AS `previous_stock`,`d`.`resulting_stock` AS `resulting_stock`,`d`.`cost` AS `cost`,`d`.`subtotal_loss` AS `subtotal_loss`,`r`.`created_at` AS `created_at`,`r`.`warehouse_id` AS `warehouse_id`,`r`.`subsidiaries_id` AS `subsidiaries_id`,`r`.`user_id` AS `user_id`,`r`.`note` AS `note`,`r`.`status` AS `status`,`r`.`companies_id` AS `companies_id` from (`detail_inventory_shrinkage` `d` join `inventory_shrinkage` `r` on((`r`.`id` = `d`.`inventory_shrinkage_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`status` = 'Aplicada')) union all select concat('TR-OUT-',`d`.`id`) AS `CONCAT('TR-OUT-', d.id)`,'TRANSFERENCIA' AS `TRANSFERENCIA`,`r`.`folio` AS `folio`,`d`.`product_id` AS `product_id`,-(`d`.`quantity`) AS `-(d.quantity)`,`d`.`origin_stock_prev` AS `origin_stock_prev`,`d`.`origin_stock_post` AS `origin_stock_post`,`d`.`cost` AS `cost`,-(`d`.`subtotal`) AS `-(d.subtotal)`,`r`.`date_sent` AS `date_sent`,`r`.`origin_warehouse_id` AS `origin_warehouse_id`,`r`.`origin_subsidiaries_id` AS `origin_subsidiaries_id`,`r`.`requested_user_id` AS `requested_user_id`,`r`.`note` AS `note`,`ts`.`code` AS `code`,`r`.`companies_id` AS `companies_id` from ((`detail_inventory_transfer` `d` join `inventory_transfer` `r` on((`r`.`id` = `d`.`inventory_transfer_id`))) join `transfer_status` `ts` on((`ts`.`id` = `r`.`status_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`date_sent` is not null)) union all select concat('TR-IN-',`d`.`id`) AS `CONCAT('TR-IN-', d.id)`,'TRANSFERENCIA' AS `TRANSFERENCIA`,`r`.`folio` AS `folio`,`d`.`product_id` AS `product_id`,`d`.`quantity` AS `quantity`,`d`.`destination_stock_prev` AS `destination_stock_prev`,`d`.`destination_stock_post` AS `destination_stock_post`,`d`.`cost` AS `cost`,`d`.`subtotal` AS `subtotal`,`r`.`date_received` AS `date_received`,`r`.`destination_warehouse_id` AS `destination_warehouse_id`,`r`.`destination_subsidiaries_id` AS `destination_subsidiaries_id`,`r`.`received_user_id` AS `received_user_id`,`r`.`note` AS `note`,`ts`.`code` AS `code`,`r`.`companies_id` AS `companies_id` from ((`detail_inventory_transfer` `d` join `inventory_transfer` `r` on((`r`.`id` = `d`.`inventory_transfer_id`))) join `transfer_status` `ts` on((`ts`.`id` = `r`.`status_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`date_received` is not null)) union all select concat('AD-',`d`.`id`) AS `CONCAT('AD-', d.id)`,'AJUSTE' AS `AJUSTE`,`r`.`folio` AS `folio`,`d`.`product_id` AS `product_id`,`d`.`difference` AS `difference`,`d`.`previous_stock` AS `previous_stock`,`d`.`resulting_stock` AS `resulting_stock`,`d`.`cost` AS `cost`,`d`.`cost_diff` AS `cost_diff`,concat(`r`.`date_adjustment`,' ',`r`.`time_adjustment`) AS `CONCAT(r.date_adjustment, ' ', r.time_adjustment)`,`r`.`warehouse_id` AS `warehouse_id`,`r`.`subsidiaries_id` AS `subsidiaries_id`,`r`.`registered_user_id` AS `registered_user_id`,`r`.`note` AS `note`,`r`.`status` AS `status`,`r`.`companies_id` AS `companies_id` from (`detail_inventory_adjustment` `d` join `inventory_adjustment` `r` on((`r`.`id` = `d`.`inventory_adjustment_id`))) where ((`d`.`active` = 1) and (`r`.`active` = 1) and (`r`.`status` = 'Aplicado'));

SET FOREIGN_KEY_CHECKS = 1;
