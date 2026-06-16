-- =====================================================================
-- Modulo Ordenes / Solicitudes de Compra  (Fase 1 — esquema)
-- Base de datos: fayxzvov_inventory  (MySQL 8 / WAMP local)
--
-- Crea la cabecera (purchase_order) y los renglones (detail_purchase_order)
-- y enlaza cada entrada de inventario con la OC que la origino mediante la
-- columna inventory_inflow.purchase_order_id.
--
-- Estilo alineado a inventory_inflow: InnoDB, CHARSET latin1, ROW_FORMAT DYNAMIC,
-- FK de negocio internas + FK tenant hacia fayxzvov_erp.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cabecera de la orden / solicitud de compra
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_order` (
  `id`                      int          NOT NULL AUTO_INCREMENT,
  `folio`                   varchar(20)  NOT NULL,
  `date_order`              date         DEFAULT NULL,
  `expected_date`           date         DEFAULT NULL,
  `note`                    varchar(255) DEFAULT NULL,
  `total_products`          int          DEFAULT '0',
  `total_units`             double       DEFAULT '0',
  `total_cost`              double       DEFAULT '0',
  `total_price_without_tax` double       DEFAULT NULL,
  `status`                  varchar(20)  DEFAULT 'Borrador',
  `approved_at`             datetime     DEFAULT NULL,
  `reject_reason`           varchar(255) DEFAULT NULL,
  `active`                  tinyint      DEFAULT '1',
  `created_at`              datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `supplier_id`             int          DEFAULT NULL,
  `warehouse_id`            int          DEFAULT NULL,
  `user_id`                 int          DEFAULT NULL,
  `approved_user_id`        int          DEFAULT NULL,
  `branch_id`               int          DEFAULT NULL,
  `destination_branch_id`   int          DEFAULT NULL,
  `companies_id`            int          DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_po_supplier`    (`supplier_id`)           USING BTREE,
  KEY `idx_po_warehouse`   (`warehouse_id`)          USING BTREE,
  KEY `idx_po_user`        (`user_id`)               USING BTREE,
  KEY `idx_po_auser`       (`approved_user_id`)      USING BTREE,
  KEY `idx_po_branch`      (`branch_id`)             USING BTREE,
  KEY `idx_po_dest_branch` (`destination_branch_id`) USING BTREE,
  KEY `idx_po_company`     (`companies_id`)          USING BTREE,
  CONSTRAINT `fk_po_supplier`    FOREIGN KEY (`supplier_id`)           REFERENCES `supplier` (`id`),
  CONSTRAINT `fk_po_warehouse`   FOREIGN KEY (`warehouse_id`)          REFERENCES `warehouse` (`id`),
  CONSTRAINT `fk_po_user`        FOREIGN KEY (`user_id`)               REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_po_auser`       FOREIGN KEY (`approved_user_id`)      REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_po_branch`      FOREIGN KEY (`branch_id`)             REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_po_dest_branch` FOREIGN KEY (`destination_branch_id`) REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_po_company`     FOREIGN KEY (`companies_id`)          REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 2. Renglones de la orden (materiales pedidos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `detail_purchase_order` (
  `id`                int      NOT NULL AUTO_INCREMENT,
  `quantity_ordered`  double   NOT NULL DEFAULT '0',
  `quantity_received` double   NOT NULL DEFAULT '0',
  `price_without_tax` double   DEFAULT NULL,
  `tax`               int      DEFAULT NULL,
  `cost`              double   DEFAULT NULL,
  `subtotal`          double   NOT NULL DEFAULT '0',
  `active`            tinyint  NOT NULL DEFAULT '1',
  `created_at`        datetime DEFAULT CURRENT_TIMESTAMP,
  `purchase_order_id` int      NOT NULL,
  `item_id`           int      NOT NULL,
  `unit_id`           int      DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dpo_header` (`purchase_order_id`) USING BTREE,
  KEY `idx_dpo_item`   (`item_id`)           USING BTREE,
  KEY `idx_dpo_unit`   (`unit_id`)           USING BTREE,
  CONSTRAINT `fk_dpo_header` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dpo_item`   FOREIGN KEY (`item_id`)           REFERENCES `item` (`id`),
  CONSTRAINT `fk_dpo_unit`   FOREIGN KEY (`unit_id`)           REFERENCES `unit` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------------------
-- 3. Vinculo de la entrada de inventario con la OC que la origino
--    (NULL = entrada directa, sin orden de compra)
-- ---------------------------------------------------------------------
ALTER TABLE `inventory_inflow`
  ADD COLUMN `purchase_order_id` int DEFAULT NULL AFTER `companies_id`,
  ADD KEY `idx_inflow_po` (`purchase_order_id`) USING BTREE,
  ADD CONSTRAINT `fk_inflow_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order` (`id`);
