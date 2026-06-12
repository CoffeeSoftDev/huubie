-- ============================================================================
-- DDL Traspasos — modulo inventory/operacion/almacen
-- Esquema: fayxzvov_inventory (tenant en fayxzvov_erp: companies / branches / users)
-- Referencia de logica: app/inventarios (reginas) docs/traspasos.md
-- Adaptaciones al esquema inventory:
--   * product_id            -> item_id (fayxzvov_inventory.item)
--   * subsidiaries_id       -> branch_id (fayxzvov_erp.branches)
--   * usuarios alpha        -> fayxzvov_erp.users
-- Convenciones de la casa: montos DOUBLE, soft-delete active, orden de columnas
-- id -> negocio -> montos -> timestamps -> status -> active -> FKs.
-- ============================================================================

-- ── Catalogo de estados del traspaso ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`transfer_status` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(30)  NOT NULL,
  `name`         VARCHAR(80)  NOT NULL,
  `order_index`  INT          NOT NULL DEFAULT 0,
  `is_terminal`  TINYINT      NOT NULL DEFAULT 0,
  `color_hex`    VARCHAR(9)   DEFAULT NULL,
  `created_at`   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `active`       TINYINT      NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_transfer_status_code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- Maquina de estados: REQUESTED -> RECEIVED | REJECTED (flujo simplificado).
-- AUTHORIZED / IN_TRANSIT quedan reservados para el flujo con despacho separado.
INSERT INTO `fayxzvov_inventory`.`transfer_status` (`code`, `name`, `order_index`, `is_terminal`, `color_hex`)
SELECT * FROM (
  SELECT 'REQUESTED'  AS code, 'Solicitado'  AS name, 1 AS order_index, 0 AS is_terminal, '#F59E0B' AS color_hex UNION ALL
  SELECT 'AUTHORIZED',          'Autorizado',          2,                 0,                '#3B82F6'             UNION ALL
  SELECT 'IN_TRANSIT',          'En Transito',         3,                 0,                '#8B5CF6'             UNION ALL
  SELECT 'RECEIVED',            'Recibido',            4,                 1,                '#10B981'             UNION ALL
  SELECT 'REJECTED',            'Rechazado',           5,                 1,                '#EF4444'
) seed
WHERE NOT EXISTS (
  SELECT 1 FROM `fayxzvov_inventory`.`transfer_status` ts WHERE ts.code = seed.code
);

-- ── Transaccion raiz: encabezado del traspaso ───────────────────────────────
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`inventory_transfer` (
  `id`                       INT NOT NULL AUTO_INCREMENT,
  `folio`                    VARCHAR(20)  NOT NULL,
  `note`                     VARCHAR(255) DEFAULT NULL,
  `total_products`           INT          DEFAULT 0,
  `received_by_name`         VARCHAR(120) DEFAULT NULL,
  `total_units`              DOUBLE       DEFAULT 0,
  `total_cost`               DOUBLE       DEFAULT 0,
  `date_request`             DATETIME     DEFAULT NULL,
  `date_authorized`          DATETIME     DEFAULT NULL,
  `date_sent`                DATETIME     DEFAULT NULL,
  `date_received`            DATETIME     DEFAULT NULL,
  `created_at`               DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`                   TINYINT      NOT NULL DEFAULT 1,
  `status_id`                INT NOT NULL,
  `origin_warehouse_id`      INT NOT NULL,
  `destination_warehouse_id` INT NOT NULL,
  `origin_branch_id`         INT NOT NULL,
  `destination_branch_id`    INT NOT NULL,
  `requested_user_id`        INT DEFAULT NULL,
  `authorized_user_id`       INT DEFAULT NULL,
  `received_user_id`         INT DEFAULT NULL,
  `companies_id`             INT NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_transfer_status`      (`status_id`)                USING BTREE,
  KEY `idx_transfer_origin_wh`   (`origin_warehouse_id`)      USING BTREE,
  KEY `idx_transfer_dest_wh`     (`destination_warehouse_id`) USING BTREE,
  KEY `idx_transfer_origin_br`   (`origin_branch_id`)         USING BTREE,
  KEY `idx_transfer_dest_br`     (`destination_branch_id`)    USING BTREE,
  KEY `idx_transfer_company`     (`companies_id`)             USING BTREE,
  KEY `idx_transfer_folio`       (`folio`, `companies_id`)    USING BTREE,
  CONSTRAINT `fk_transfer_status`    FOREIGN KEY (`status_id`)                REFERENCES `fayxzvov_inventory`.`transfer_status` (`id`),
  CONSTRAINT `fk_transfer_origin_wh` FOREIGN KEY (`origin_warehouse_id`)      REFERENCES `fayxzvov_inventory`.`warehouse` (`id`),
  CONSTRAINT `fk_transfer_dest_wh`   FOREIGN KEY (`destination_warehouse_id`) REFERENCES `fayxzvov_inventory`.`warehouse` (`id`),
  CONSTRAINT `fk_transfer_origin_br` FOREIGN KEY (`origin_branch_id`)         REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_transfer_dest_br`   FOREIGN KEY (`destination_branch_id`)    REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_transfer_req_user`  FOREIGN KEY (`requested_user_id`)        REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_transfer_auth_user` FOREIGN KEY (`authorized_user_id`)       REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_transfer_recv_user` FOREIGN KEY (`received_user_id`)         REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_transfer_company`   FOREIGN KEY (`companies_id`)             REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ── Detalle: renglones del traspaso (snapshot de stock ambos lados) ─────────
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`detail_inventory_transfer` (
  `id`                       INT NOT NULL AUTO_INCREMENT,
  `quantity`                 DOUBLE NOT NULL DEFAULT 0,
  `cost`                     DOUBLE NOT NULL DEFAULT 0,
  `subtotal`                 DOUBLE NOT NULL DEFAULT 0,
  `origin_stock_prev`        DOUBLE DEFAULT NULL,
  `origin_stock_post`        DOUBLE DEFAULT NULL,
  `destination_stock_prev`   DOUBLE DEFAULT NULL,
  `destination_stock_post`   DOUBLE DEFAULT NULL,
  `created_at`               DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`                   TINYINT NOT NULL DEFAULT 1,
  `item_id`                  INT NOT NULL,
  `inventory_transfer_id`    INT NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_dtransfer_item`   (`item_id`)               USING BTREE,
  KEY `idx_dtransfer_header` (`inventory_transfer_id`) USING BTREE,
  CONSTRAINT `fk_dtransfer_item`   FOREIGN KEY (`item_id`)               REFERENCES `fayxzvov_inventory`.`item` (`id`),
  CONSTRAINT `fk_dtransfer_header` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `fayxzvov_inventory`.`inventory_transfer` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

-- ── Historial: timeline de cambios de estado ────────────────────────────────
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`inventory_transfer_history` (
  `id`                       INT NOT NULL AUTO_INCREMENT,
  `note`                     VARCHAR(255) DEFAULT NULL,
  `transitioned_at`          DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`                   TINYINT NOT NULL DEFAULT 1,
  `status_id`                INT NOT NULL,
  `user_id`                  INT DEFAULT NULL,
  `inventory_transfer_id`    INT NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_thistory_status` (`status_id`)              USING BTREE,
  KEY `idx_thistory_header` (`inventory_transfer_id`)  USING BTREE,
  CONSTRAINT `fk_thistory_status` FOREIGN KEY (`status_id`)             REFERENCES `fayxzvov_inventory`.`transfer_status` (`id`),
  CONSTRAINT `fk_thistory_user`   FOREIGN KEY (`user_id`)               REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_thistory_header` FOREIGN KEY (`inventory_transfer_id`) REFERENCES `fayxzvov_inventory`.`inventory_transfer` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;
