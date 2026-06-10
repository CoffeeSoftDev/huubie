-- ============================================================
-- Modulo Ordenes / Solicitudes de Compra (fayxzvov_inventory)
-- MySQL 5.7  |  WAMP local
-- Fase 1: tablas nuevas + columna de vinculo en inventory_inflow
-- ============================================================

-- 1. Cabecera de la solicitud / orden de compra
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`purchase_order` (
  `id`                      INT(11)      NOT NULL AUTO_INCREMENT,
  `folio`                   VARCHAR(20)  NOT NULL,
  `supplier_id`             INT(11)      DEFAULT NULL,   -- opcional, cualquier etapa
  `branch_id`               INT(11)      DEFAULT NULL,
  `warehouse_id`            INT(11)      DEFAULT NULL,   -- destino sugerido; se confirma al recibir
  `date_order`              DATE         DEFAULT NULL,   -- fecha de solicitud
  `expected_date`           DATE         DEFAULT NULL,
  `note`                    VARCHAR(255) DEFAULT NULL,
  `total_products`          INT(11)      DEFAULT 0,
  `total_units`             DOUBLE       DEFAULT 0,
  `total_cost`              DOUBLE       DEFAULT 0,
  `total_price_without_tax` DOUBLE       DEFAULT NULL,
  `status`                  VARCHAR(20)  DEFAULT 'Borrador',
  `user_id`                 INT(11)      DEFAULT NULL,   -- quien solicita
  `approved_user_id`        INT(11)      DEFAULT NULL,   -- quien aprueba/rechaza
  `approved_at`             DATETIME     DEFAULT NULL,
  `reject_reason`           VARCHAR(255) DEFAULT NULL,
  `companies_id`            INT(11)      DEFAULT NULL,
  `active`                  TINYINT(1)   DEFAULT 1,
  `created_at`              DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_po_companies_status` (`companies_id`, `status`),
  KEY `idx_po_supplier`         (`supplier_id`),
  KEY `idx_po_warehouse`        (`warehouse_id`),
  KEY `idx_po_branch`           (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Renglones (lista de materiales pedidos)
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`detail_purchase_order` (
  `id`                INT(11) NOT NULL AUTO_INCREMENT,
  `purchase_order_id` INT(11) NOT NULL,
  `item_id`           INT(11) NOT NULL,
  `unit_id`           INT(11) DEFAULT NULL,
  `quantity_ordered`  DOUBLE  DEFAULT 0,   -- lo solicitado
  `quantity_received` DOUBLE  DEFAULT 0,   -- acumulado recibido
  `price_without_tax` DOUBLE  DEFAULT NULL,
  `tax`               INT(11) DEFAULT 0,
  `cost`              DOUBLE  DEFAULT NULL,
  `subtotal`          DOUBLE  DEFAULT 0,
  `active`            TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_dpo_order` (`purchase_order_id`),
  KEY `idx_dpo_item`  (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Vinculo OC -> entrada generada al recibir
ALTER TABLE `fayxzvov_inventory`.`inventory_inflow`
  ADD COLUMN `purchase_order_id` INT(11) DEFAULT NULL
    COMMENT 'OC/solicitud que genero esta entrada (NULL si es entrada directa)',
  ADD KEY `idx_inflow_po` (`purchase_order_id`);
