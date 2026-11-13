-- =====================================================================
-- Crea fayxzvov_pos: POS y Pedidos de Huubie PRO (26 tablas)
-- Fecha:    06/11/2026
-- Origen:   pro/app/order/docs/diagrama er pos-order.md (acta rev C)
-- Reglas:   ~/.claude/steering/grimorios/db-rules.md
-- Rollback: 2026-11-06_crear-fayxzvov-pos-rollback.sql
-- Datos:    2026-11-06_migrar-reginas-a-pos.sql (se corre DESPUES de este)
--
-- MAESTROS (cross-schema, la BD de pro):
--   company_id  -> fayxzvov_app.companies(id)
--   branch_id   -> fayxzvov_app.branches(id)
--   *user_id    -> fayxzvov_app.users(id)
--   Si la BD de pro se llama distinto en ese servidor, reemplaza
--   "fayxzvov_app" en todo el archivo antes de correrlo. Tiene que existir:
--   en local (06/11/2026) no existe.
--   Las FKs piden que companies.id, branches.id y users.id sean INT con
--   signo, igual que aqui. Si alla son INT UNSIGNED o BIGINT, MySQL rechaza
--   la FK (errno 150): cambia aqui el tipo de esas columnas.
--
-- POLITICA DE FKs:
--   detalle -> su raiz ............... CASCADE
--   -> catalogo / otra raiz / usuario  SET NULL
--   -> empresa o sucursal ............ RESTRICT  (no SET NULL: una fila con
--      company_id NULL es plantilla y la verian TODAS las empresas)
--   ON UPDATE siempre CASCADE.
--
-- CAMBIOS CONTRA EL ACTA:
--   Tablas    order_kind -> sale_type          order_type -> sale_status
--             sale_item -> detail_sale         sale_images -> sale_image
--             turn_method -> turn_payment
--             turn_order_type -> turn_status
--             daily_closure_method -> daily_closure_payment
--             daily_closure_order_type -> daily_closure_status
--             custom_modifier -> product_modifier (solo order_custom_products;
--               el pastel personalizado es un product con is_custom = 1)
--   Columnas  brand_id -> branch_id     client_id -> customer_id
--             isExtra -> is_extra       cant -> quantity
--             delete_at -> deleted_at   deleted_by/delete_by -> deleted_user_id
--             is_delivered -> delivery_status (tiene 3 valores, no es bandera)
--             date_order/time_order -> delivery_date/delivery_time
--             info_discount -> discount_note
--   Movidas   sale_item.amount/refunded -> payment.tendered_amount/change_amount
--   Nuevas    payment.turn_id, sale.discount_user_id, subcategory.category_id,
--             product.suggested_price/portion_qty, company_id en 5 catalogos,
--             updated_at y active en todas
--   Quitadas  sale.channel (repite sale_type_id), payment.cashier_id,
--             payment.cash_audit_id, payment.type (siempre 2),
--             customer.price_list_id, sale_item.promotion_id (sin tabla)
--   Tipos     ENUM -> VARCHAR(20); banderas INT -> TINYINT;
--             nombres TEXT -> VARCHAR; customer.phone VARCHAR(20)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `fayxzvov_pos`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE `fayxzvov_pos`;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- CATALOGOS
-- ---------------------------------------------------------------------

CREATE TABLE `sale_type` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50) NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`  INT NULL DEFAULT NULL COMMENT 'NULL = plantilla para todas las empresas',
  `active`      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `sale_type_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: tipo de venta (pedido, mostrador, pos, ecommerce)';

CREATE TABLE `sale_status` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50) NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`  INT NULL DEFAULT NULL COMMENT 'NULL = plantilla para todas las empresas',
  `active`      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `sale_status_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: estatus de la venta. Ids 1-4 los usa el codigo, no se editan';

CREATE TABLE `card_type` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(80) NOT NULL,
  `discount_percent`  DOUBLE NOT NULL DEFAULT 0,
  `points_percent`    DOUBLE NOT NULL DEFAULT 0,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`         INT NULL DEFAULT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `card_type_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: tipos de tarjeta de lealtad';

CREATE TABLE `discount_reason` (
  `id`                      INT NOT NULL AUTO_INCREMENT,
  `code`                    VARCHAR(20) NULL DEFAULT NULL,
  `name`                    VARCHAR(80) NOT NULL,
  `max_percent`             DOUBLE NOT NULL DEFAULT 0,
  `requires_authorization`  TINYINT NOT NULL DEFAULT 0 COMMENT '1 = solo gerente lo autoriza',
  `created_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`              INT NULL DEFAULT NULL COMMENT 'NULL = plantilla para todas las empresas',
  `active`                  TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `discount_reason_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: motivos de descuento';

CREATE TABLE `payment_method` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(50) NOT NULL,
  `code`          VARCHAR(20) NULL DEFAULT NULL,
  `kind`          VARCHAR(20) NULL DEFAULT NULL COMMENT 'efectivo | tarjeta | transferencia | vales | puntos',
  `commission`    DOUBLE NOT NULL DEFAULT 0,
  `sort`          INT NOT NULL DEFAULT 0,
  `is_cash`       TINYINT NOT NULL DEFAULT 0,
  `is_visible`    TINYINT NOT NULL DEFAULT 1,
  `earns_points`  TINYINT NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`    INT NULL DEFAULT NULL COMMENT 'NULL = plantilla para todas las empresas',
  `active`        TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `payment_method_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: formas de pago';

CREATE TABLE `category` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(255) NOT NULL,
  `description`  TEXT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`    INT NULL DEFAULT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `category_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: categorias de producto';

CREATE TABLE `subcategory` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(80) NOT NULL,
  `description`  VARCHAR(255) NULL DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`    INT NULL DEFAULT NULL,
  `category_id`  INT NULL DEFAULT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `subcategory_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `subcategory_ibfk_2` FOREIGN KEY (`category_id`)
    REFERENCES `category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Sub-catalogo: cuelga de category';

CREATE TABLE `modifier_group` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100) NOT NULL COMMENT 'betun, decoracion, relleno',
  `is_extra`    TINYINT NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`  INT NULL DEFAULT NULL COMMENT 'NULL = plantilla para todas las empresas',
  `active`      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `modifier_group_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: grupos de modificadores';

CREATE TABLE `modifier` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `name`               VARCHAR(255) NOT NULL COMMENT 'betun de chocolate, fresas',
  `description`        VARCHAR(255) NULL DEFAULT NULL,
  `price`              DOUBLE NOT NULL DEFAULT 0,
  `quantity`           DOUBLE NOT NULL DEFAULT 0,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modifier_group_id`  INT NULL DEFAULT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `modifier_group_id` (`modifier_group_id`),
  CONSTRAINT `modifier_ibfk_1` FOREIGN KEY (`modifier_group_id`)
    REFERENCES `modifier_group` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Sub-catalogo: opciones de un grupo de modificadores';

CREATE TABLE `customer` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(255) NOT NULL,
  `phone`           VARCHAR(20) NULL DEFAULT NULL,
  `email`           VARCHAR(255) NULL DEFAULT NULL,
  `wallet`          DOUBLE NOT NULL DEFAULT 0,
  `credit_limit`    DOUBLE NOT NULL DEFAULT 0,
  `credit_enabled`  TINYINT NOT NULL DEFAULT 0,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`       INT NULL DEFAULT NULL,
  `active`          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `phone` (`phone`),
  CONSTRAINT `customer_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: clientes por sucursal';

CREATE TABLE `product` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(255) NOT NULL,
  `description`       TEXT NULL,
  `image`             VARCHAR(255) NULL DEFAULT NULL,
  `sku`               VARCHAR(80) NULL DEFAULT NULL COMMENT 'codigo para inventarios',
  `barcode`           VARCHAR(80) NULL DEFAULT NULL COMMENT 'codigo de barras para el pos',
  `kind`              VARCHAR(20) NOT NULL DEFAULT 'product' COMMENT 'product | service | bundle',
  `unit_id`           INT NULL DEFAULT NULL COMMENT 'unidad del modulo Inventarios; FK pendiente (fuera de la seleccion)',
  `price`             DOUBLE NOT NULL DEFAULT 0 COMMENT 'precio que se cobra',
  `cost`              DOUBLE NOT NULL DEFAULT 0,
  `suggested_price`   DOUBLE NULL DEFAULT NULL COMMENT 'solo is_custom: precio calculado por modificadores',
  `portion_qty`       INT NULL DEFAULT NULL COMMENT 'porciones del pastel',
  `shelf_life_days`   INT NULL DEFAULT NULL,
  `is_custom`         TINYINT NOT NULL DEFAULT 0 COMMENT '1 = pastel personalizado de un pedido; no sale en el catalogo',
  `is_inventoriable`  TINYINT NOT NULL DEFAULT 0,
  `sell_pos`          TINYINT NOT NULL DEFAULT 1 COMMENT 'se vende en el pos',
  `in_catalog`        TINYINT NOT NULL DEFAULT 0 COMMENT 'sale en el catalogo del ecommerce',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`        INT NULL DEFAULT NULL,
  `branch_id`         INT NULL DEFAULT NULL,
  `category_id`       INT NULL DEFAULT NULL,
  `subcategory_id`    INT NULL DEFAULT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  KEY `category_id` (`category_id`),
  KEY `subcategory_id` (`subcategory_id`),
  KEY `sku` (`sku`),
  KEY `barcode` (`barcode`),
  CONSTRAINT `product_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_ibfk_2` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_ibfk_3` FOREIGN KEY (`category_id`)
    REFERENCES `category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `product_ibfk_4` FOREIGN KEY (`subcategory_id`)
    REFERENCES `subcategory` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: productos de POS, pedidos e inventarios';

CREATE TABLE `product_recipe` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `quantity`      DOUBLE NOT NULL DEFAULT 0,
  `cost`          DOUBLE NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `product_id`    INT NOT NULL COMMENT 'paquete: Paquete Cumpleanos',
  `component_id`  INT NOT NULL COMMENT 'lo que lo arma: Pastel, Velas',
  `active`        TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `component_id` (`component_id`),
  CONSTRAINT `product_recipe_ibfk_1` FOREIGN KEY (`product_id`)
    REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_recipe_ibfk_2` FOREIGN KEY (`component_id`)
    REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Pivote: productos que componen un paquete';

CREATE TABLE `product_modifier` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `details`      VARCHAR(255) NULL DEFAULT NULL,
  `quantity`     DOUBLE NOT NULL DEFAULT 0,
  `price`        DOUBLE NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `product_id`   INT NOT NULL,
  `modifier_id`  INT NULL DEFAULT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `modifier_id` (`modifier_id`),
  CONSTRAINT `product_modifier_ibfk_1` FOREIGN KEY (`product_id`)
    REFERENCES `product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_modifier_ibfk_2` FOREIGN KEY (`modifier_id`)
    REFERENCES `modifier` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Pivote: modificadores con que se armo un producto personalizado';

CREATE TABLE `card` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `number`        VARCHAR(40) NOT NULL,
  `holder`        VARCHAR(150) NULL DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`     INT NULL DEFAULT NULL,
  `card_type_id`  INT NULL DEFAULT NULL,
  `customer_id`   INT NULL DEFAULT NULL,
  `active`        TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `card_type_id` (`card_type_id`),
  KEY `customer_id` (`customer_id`),
  KEY `number` (`number`),
  CONSTRAINT `card_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `card_ibfk_2` FOREIGN KEY (`card_type_id`)
    REFERENCES `card_type` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `card_ibfk_3` FOREIGN KEY (`customer_id`)
    REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: tarjetas de lealtad (sus movimientos van en card_movement, fuera de esta seleccion)';

-- ---------------------------------------------------------------------
-- TRANSACCIONES RAIZ
-- ---------------------------------------------------------------------

CREATE TABLE `daily_closure` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `folio`             VARCHAR(20) NULL DEFAULT NULL,
  `note`              VARCHAR(255) NULL DEFAULT NULL,
  `first_folio`       VARCHAR(20) NULL DEFAULT NULL,
  `last_folio`        VARCHAR(20) NULL DEFAULT NULL,
  `sales_count`       INT NOT NULL DEFAULT 0,
  `cancelled_count`   INT NOT NULL DEFAULT 0,
  `orders_count`      INT NOT NULL DEFAULT 0,
  `turns_count`       INT NOT NULL DEFAULT 0,
  `reopen_reason`     TEXT NULL,
  `subtotal`          DOUBLE NOT NULL DEFAULT 0,
  `discount`          DOUBLE NOT NULL DEFAULT 0,
  `tax`               DOUBLE NOT NULL DEFAULT 0,
  `tip`               DOUBLE NOT NULL DEFAULT 0,
  `total`             DOUBLE NOT NULL DEFAULT 0,
  `total_shifts`      DOUBLE NOT NULL DEFAULT 0,
  `total_cash`        DOUBLE NOT NULL DEFAULT 0,
  `cash_in`           DOUBLE NOT NULL DEFAULT 0,
  `cash_out`          DOUBLE NOT NULL DEFAULT 0,
  `closure_date`      DATETIME NULL DEFAULT NULL,
  `reopened_at`       DATETIME NULL DEFAULT NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`         INT NULL DEFAULT NULL,
  `user_id`           INT NULL DEFAULT NULL,
  `reopened_user_id`  INT NULL DEFAULT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `user_id` (`user_id`),
  KEY `reopened_user_id` (`reopened_user_id`),
  CONSTRAINT `daily_closure_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_ibfk_3` FOREIGN KEY (`reopened_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Raiz: cierre diario, agrupa los turnos de una sucursal y fecha';

CREATE TABLE `turn` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `folio`             VARCHAR(20) NULL DEFAULT NULL,
  `orders_count`      INT NOT NULL DEFAULT 0,
  `sales_count`       INT NOT NULL DEFAULT 0,
  `reopen_reason`     TEXT NULL,
  `opening_cash`      DOUBLE NOT NULL DEFAULT 0,
  `counted_cash`      DOUBLE NOT NULL DEFAULT 0 COMMENT 'efectivo contado al cerrar',
  `expected_cash`     DOUBLE NOT NULL DEFAULT 0 COMMENT 'efectivo que el sistema espera',
  `total_sales`       DOUBLE NOT NULL DEFAULT 0,
  `opened_at`         DATETIME NULL DEFAULT NULL,
  `closed_at`         DATETIME NULL DEFAULT NULL,
  `reopened_at`       DATETIME NULL DEFAULT NULL,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`            VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT 'open | closed',
  `branch_id`         INT NULL DEFAULT NULL,
  `user_id`           INT NULL DEFAULT NULL COMMENT 'quien abrio',
  `close_user_id`     INT NULL DEFAULT NULL,
  `reopened_user_id`  INT NULL DEFAULT NULL,
  `daily_closure_id`  INT NULL DEFAULT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `user_id` (`user_id`),
  KEY `close_user_id` (`close_user_id`),
  KEY `reopened_user_id` (`reopened_user_id`),
  KEY `daily_closure_id` (`daily_closure_id`),
  CONSTRAINT `turn_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `turn_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `turn_ibfk_3` FOREIGN KEY (`close_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `turn_ibfk_4` FOREIGN KEY (`reopened_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `turn_ibfk_5` FOREIGN KEY (`daily_closure_id`)
    REFERENCES `daily_closure` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Raiz: turno de caja; el corte suma ventas de POS y pedidos';

CREATE TABLE `sale` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `folio`               VARCHAR(20) NULL DEFAULT NULL,
  `note`                TEXT NULL,
  `location`            VARCHAR(255) NULL DEFAULT NULL,
  `delivery_method`     TINYINT NOT NULL DEFAULT 0 COMMENT '0 recoge en tienda, 1 envio a domicilio',
  `delivery_status`     TINYINT NOT NULL DEFAULT 0 COMMENT '0 no entregado, 1 entregado, 2 para producir',
  `cancel_reason`       VARCHAR(255) NULL DEFAULT NULL,
  `discount_note`       TEXT NULL,
  `subtotal`            DOUBLE NOT NULL DEFAULT 0,
  `discount_amount`     DOUBLE NOT NULL DEFAULT 0,
  `discount_percent`    DOUBLE NOT NULL DEFAULT 0,
  `tip_amount`          DOUBLE NOT NULL DEFAULT 0,
  `total`               DOUBLE NOT NULL DEFAULT 0 COMMENT 'subtotal - discount_amount',
  `delivery_date`       DATE NULL DEFAULT NULL,
  `delivery_time`       TIME NULL DEFAULT NULL,
  `birthday_date`       DATE NULL DEFAULT NULL,
  `cancelled_at`        DATETIME NULL DEFAULT NULL,
  `produced_at`         DATETIME NULL DEFAULT NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`           INT NULL DEFAULT NULL,
  `user_id`             INT NULL DEFAULT NULL COMMENT 'quien la capturo',
  `edit_user_id`        INT NULL DEFAULT NULL,
  `cancel_user_id`      INT NULL DEFAULT NULL,
  `produced_user_id`    INT NULL DEFAULT NULL,
  `discount_user_id`    INT NULL DEFAULT NULL COMMENT 'quien autorizo el descuento',
  `sale_status_id`      INT NULL DEFAULT NULL,
  `sale_type_id`        INT NULL DEFAULT NULL,
  `customer_id`         INT NULL DEFAULT NULL,
  `card_id`             INT NULL DEFAULT NULL,
  `discount_reason_id`  INT NULL DEFAULT NULL,
  `turn_id`             INT NULL DEFAULT NULL,
  `daily_closure_id`    INT NULL DEFAULT NULL,
  `active`              TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `user_id` (`user_id`),
  KEY `edit_user_id` (`edit_user_id`),
  KEY `cancel_user_id` (`cancel_user_id`),
  KEY `produced_user_id` (`produced_user_id`),
  KEY `discount_user_id` (`discount_user_id`),
  KEY `sale_status_id` (`sale_status_id`),
  KEY `sale_type_id` (`sale_type_id`),
  KEY `customer_id` (`customer_id`),
  KEY `card_id` (`card_id`),
  KEY `discount_reason_id` (`discount_reason_id`),
  KEY `turn_id` (`turn_id`),
  KEY `daily_closure_id` (`daily_closure_id`),
  KEY `delivery_date` (`delivery_date`),
  CONSTRAINT `sale_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_3` FOREIGN KEY (`edit_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_4` FOREIGN KEY (`cancel_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_5` FOREIGN KEY (`produced_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_6` FOREIGN KEY (`discount_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_7` FOREIGN KEY (`sale_status_id`)
    REFERENCES `sale_status` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_8` FOREIGN KEY (`sale_type_id`)
    REFERENCES `sale_type` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_9` FOREIGN KEY (`customer_id`)
    REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_10` FOREIGN KEY (`card_id`)
    REFERENCES `card` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_11` FOREIGN KEY (`discount_reason_id`)
    REFERENCES `discount_reason` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_12` FOREIGN KEY (`turn_id`)
    REFERENCES `turn` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_13` FOREIGN KEY (`daily_closure_id`)
    REFERENCES `daily_closure` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Raiz: venta compartida por POS, pedidos y ecommerce';

-- ---------------------------------------------------------------------
-- DETALLES
-- ---------------------------------------------------------------------

CREATE TABLE `detail_sale` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `name`                VARCHAR(255) NULL DEFAULT NULL,
  `details`             VARCHAR(255) NULL DEFAULT NULL,
  `dedication`          VARCHAR(255) NULL DEFAULT NULL,
  `price`               DOUBLE NOT NULL DEFAULT 0,
  `quantity`            DOUBLE NOT NULL DEFAULT 0,
  `discount_percent`    DOUBLE NOT NULL DEFAULT 0,
  `discount_amount`     DOUBLE NOT NULL DEFAULT 0,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`              TINYINT NOT NULL DEFAULT 1,
  `sale_id`             INT NOT NULL,
  `product_id`          INT NULL DEFAULT NULL COMMENT 'producto, paquete o personalizado (is_custom)',
  `discount_reason_id`  INT NULL DEFAULT NULL,
  `active`              TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `sale_id` (`sale_id`),
  KEY `product_id` (`product_id`),
  KEY `discount_reason_id` (`discount_reason_id`),
  CONSTRAINT `detail_sale_ibfk_1` FOREIGN KEY (`sale_id`)
    REFERENCES `sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_sale_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `detail_sale_ibfk_3` FOREIGN KEY (`discount_reason_id`)
    REFERENCES `discount_reason` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: lineas de la venta';

CREATE TABLE `payment` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `description`        VARCHAR(255) NULL DEFAULT NULL,
  `amount`             DOUBLE NOT NULL DEFAULT 0,
  `tendered_amount`    DOUBLE NOT NULL DEFAULT 0 COMMENT 'con cuanto pago el cliente',
  `change_amount`      DOUBLE NOT NULL DEFAULT 0 COMMENT 'cambio entregado',
  `paid_at`            DATETIME NULL DEFAULT NULL,
  `deleted_at`         DATETIME NULL DEFAULT NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`          INT NULL DEFAULT NULL COMMENT 'sucursal donde se cobro (puede ser otra que la de la venta)',
  `user_id`            INT NULL DEFAULT NULL COMMENT 'quien cobro',
  `deleted_user_id`    INT NULL DEFAULT NULL,
  `sale_id`            INT NOT NULL,
  `payment_method_id`  INT NULL DEFAULT NULL,
  `turn_id`            INT NULL DEFAULT NULL COMMENT 'turno donde entro el dinero; manda en el corte',
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `user_id` (`user_id`),
  KEY `deleted_user_id` (`deleted_user_id`),
  KEY `sale_id` (`sale_id`),
  KEY `payment_method_id` (`payment_method_id`),
  KEY `turn_id` (`turn_id`),
  CONSTRAINT `payment_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payment_ibfk_3` FOREIGN KEY (`deleted_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payment_ibfk_4` FOREIGN KEY (`sale_id`)
    REFERENCES `sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payment_ibfk_5` FOREIGN KEY (`payment_method_id`)
    REFERENCES `payment_method` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `payment_ibfk_6` FOREIGN KEY (`turn_id`)
    REFERENCES `turn` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: pagos y abonos de una venta (POS y pedidos)';

CREATE TABLE `receivable` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `kind`               VARCHAR(20) NULL DEFAULT NULL COMMENT 'cargo | abono',
  `description`        VARCHAR(255) NULL DEFAULT NULL,
  `amount`             DOUBLE NOT NULL DEFAULT 0,
  `paid_at`            DATETIME NULL DEFAULT NULL,
  `deleted_at`         DATETIME NULL DEFAULT NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `branch_id`          INT NULL DEFAULT NULL,
  `user_id`            INT NULL DEFAULT NULL,
  `deleted_user_id`    INT NULL DEFAULT NULL,
  `customer_id`        INT NULL DEFAULT NULL,
  `sale_id`            INT NULL DEFAULT NULL,
  `turn_id`            INT NULL DEFAULT NULL,
  `payment_method_id`  INT NULL DEFAULT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `branch_id` (`branch_id`),
  KEY `user_id` (`user_id`),
  KEY `deleted_user_id` (`deleted_user_id`),
  KEY `customer_id` (`customer_id`),
  KEY `sale_id` (`sale_id`),
  KEY `turn_id` (`turn_id`),
  KEY `payment_method_id` (`payment_method_id`),
  CONSTRAINT `receivable_ibfk_1` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `receivable_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `receivable_ibfk_3` FOREIGN KEY (`deleted_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `receivable_ibfk_4` FOREIGN KEY (`customer_id`)
    REFERENCES `customer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `receivable_ibfk_5` FOREIGN KEY (`sale_id`)
    REFERENCES `sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `receivable_ibfk_6` FOREIGN KEY (`turn_id`)
    REFERENCES `turn` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `receivable_ibfk_7` FOREIGN KEY (`payment_method_id`)
    REFERENCES `payment_method` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: cuentas por cobrar del cliente (credito)';

CREATE TABLE `history_log` (
  `id`          BIGINT NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(50) NULL DEFAULT NULL,
  `action`      VARCHAR(255) NULL DEFAULT NULL,
  `detail`      TEXT NULL,
  `type`        VARCHAR(30) NULL DEFAULT NULL COMMENT 'payment, discount, edition, cancellation, delivery, comment...',
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id`     INT NULL DEFAULT NULL,
  `sale_id`     INT NULL DEFAULT NULL,
  `active`      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `sale_id` (`sale_id`),
  CONSTRAINT `history_log_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `history_log_ibfk_2` FOREIGN KEY (`sale_id`)
    REFERENCES `sale` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: bitacora de la venta (SET NULL a proposito: el log sobrevive)';

CREATE TABLE `sale_image` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `path`            VARCHAR(255) NULL DEFAULT NULL,
  `name`            VARCHAR(255) NULL DEFAULT NULL,
  `original_name`   VARCHAR(255) NULL DEFAULT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `detail_sale_id`  INT NOT NULL,
  `active`          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `detail_sale_id` (`detail_sale_id`),
  CONSTRAINT `sale_image_ibfk_1` FOREIGN KEY (`detail_sale_id`)
    REFERENCES `detail_sale` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: fotos de una linea del pedido';

CREATE TABLE `turn_payment` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `amount`             DOUBLE NOT NULL DEFAULT 0,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `turn_id`            INT NOT NULL,
  `payment_method_id`  INT NULL DEFAULT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `turn_id` (`turn_id`),
  KEY `payment_method_id` (`payment_method_id`),
  CONSTRAINT `turn_payment_ibfk_1` FOREIGN KEY (`turn_id`)
    REFERENCES `turn` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `turn_payment_ibfk_2` FOREIGN KEY (`payment_method_id`)
    REFERENCES `payment_method` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: total del turno por forma de pago';

CREATE TABLE `turn_status` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `amount`          DOUBLE NOT NULL DEFAULT 0,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `turn_id`         INT NOT NULL,
  `sale_status_id`  INT NULL DEFAULT NULL,
  `active`          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `turn_id` (`turn_id`),
  KEY `sale_status_id` (`sale_status_id`),
  CONSTRAINT `turn_status_ibfk_1` FOREIGN KEY (`turn_id`)
    REFERENCES `turn` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `turn_status_ibfk_2` FOREIGN KEY (`sale_status_id`)
    REFERENCES `sale_status` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: total del turno por estatus de venta';

CREATE TABLE `daily_closure_payment` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `source`             VARCHAR(80) NULL DEFAULT NULL COMMENT 'venta | abono',
  `payments_count`     INT NOT NULL DEFAULT 0,
  `amount`             DOUBLE NOT NULL DEFAULT 0,
  `tip`                DOUBLE NOT NULL DEFAULT 0,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `daily_closure_id`   INT NOT NULL,
  `payment_method_id`  INT NULL DEFAULT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `daily_closure_id` (`daily_closure_id`),
  KEY `payment_method_id` (`payment_method_id`),
  CONSTRAINT `daily_closure_payment_ibfk_1` FOREIGN KEY (`daily_closure_id`)
    REFERENCES `daily_closure` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_payment_ibfk_2` FOREIGN KEY (`payment_method_id`)
    REFERENCES `payment_method` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: total del cierre por forma de pago';

CREATE TABLE `daily_closure_status` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `amount`            DOUBLE NOT NULL DEFAULT 0,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `daily_closure_id`  INT NOT NULL,
  `sale_status_id`    INT NULL DEFAULT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `daily_closure_id` (`daily_closure_id`),
  KEY `sale_status_id` (`sale_status_id`),
  CONSTRAINT `daily_closure_status_ibfk_1` FOREIGN KEY (`daily_closure_id`)
    REFERENCES `daily_closure` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_status_ibfk_2` FOREIGN KEY (`sale_status_id`)
    REFERENCES `sale_status` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: total del cierre por estatus de venta';

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- PLANTILLAS (company_id NULL = las ven todas las empresas)
-- sale_status, payment_method y discount_reason llevan los mismos ids que
-- fayxzvov_reginas (status_process, method_pay, pos_discount_reason): la
-- migracion los copia tal cual, sin traducirlos.
-- ---------------------------------------------------------------------

INSERT INTO `sale_status` (`id`, `name`) VALUES
  (1, 'Cotización'),
  (2, 'Pendiente'),
  (3, 'Pagado'),
  (4, 'Cancelado');

INSERT INTO `sale_type` (`id`, `name`) VALUES
  (1, 'Pedido'),
  (2, 'Mostrador'),
  (3, 'POS'),
  (4, 'E-commerce');

INSERT INTO `payment_method` (`id`, `name`, `code`, `kind`, `sort`, `is_cash`, `earns_points`) VALUES
  (1, 'Efectivo',      'CASH',     'efectivo',      1, 1, 1),
  (2, 'Tarjeta',       'CARD',     'tarjeta',       2, 0, 1),
  (3, 'Transferencia', 'TRANSFER', 'transferencia', 3, 0, 1);

INSERT INTO `discount_reason` (`id`, `code`, `name`, `max_percent`, `requires_authorization`) VALUES
  (1, 'CORTESIA',     'Cortesía de la casa', 100, 1),
  (2, 'CLIENTE_FREC', 'Cliente frecuente',    20, 0),
  (3, 'PROMO',        'Promoción vigente',    50, 0),
  (4, 'EMPLEADO',     'Descuento empleado',   20, 1),
  (5, 'OTRO',         'Otro motivo',         100, 1);
