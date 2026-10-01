-- =====================================================================
-- Ajustes de inventario y conteo físico (F2 del Visor de Stock)
-- Fecha: 01/10/2026
-- BD:    fayxzvov_inventory
--
-- Sigue el patrón del POS (app/inventarios: inventory_adjustment,
-- detail_inventory_adjustment, adjustment_reason) con las llaves del ERP
-- (item_id, branch_id, fayxzvov_erp.users) y agrega lo que el POS no
-- tiene: revisión antes de mover stock y bitácora de estados.
--
-- Crea:
--   adjustment_reason             catálogo de motivos (los 5 del POS).
--   inventory_adjustment          encabezado: un ajuste = un folio (AJU-0001).
--   detail_inventory_adjustment   renglón: un producto ajustado.
--   inventory_adjustment_history  bitácora: cada cambio de estado, con quién y cuándo.
-- Redefine:
--   inventory_movement            agrega el bloque 5, AJUSTE, para el kárdex.
--
-- Tipos (adjustment_type):
--   fisico      conteo físico de un almacén o un área; además llena stock.last_inventory_at.
--   individual  corrección puntual de uno o pocos productos.
--
-- Estados (status). El POS solo usa Pendiente / Aplicado / Cancelado:
--   Borrador -> Pendiente (de revisión) -> Aplicado | Rechazado
--   Rechazado -> Borrador (reabrir y recontar)
--   Borrador -> Cancelado
--   Solo Aplicado mueve stock. Quien registró (registered_user_id) no puede
--   ser quien autoriza (authorized_user_id); en el POS sí pueden ser la
--   misma persona. Lo valida el ctrl, no la BD.
--
-- Qué guarda cada renglón (nombres del POS):
--   system_quantity    stock del sistema al capturar ese producto (counted_at)
--   physical_quantity  lo contado (NULL = pendiente)
--   difference         physical_quantity - system_quantity
--   cost_diff          difference * cost
--   previous_stock / resulting_stock se llenan al autorizar
--
-- Al autorizar (lo hará el ctrl, no este script):
--   previous_stock  = stock.quantity en ese momento
--   resulting_stock = previous_stock + difference
--   stock.quantity  = resulting_stock (y last_inventory_at = NOW() si es fisico)
--   Se suma la diferencia; no se escribe lo contado. Así no se pierde una
--   salida registrada mientras el ajuste esperaba revisión.
--
-- Mismo estilo que purchase_order, shrinkage_reason e inventory_transfer_history:
-- latin1, ROW_FORMAT DYNAMIC, FK internas + FK a fayxzvov_erp (users,
-- branches, companies). Renglones e historial: ON DELETE CASCADE.
--
-- OJO PROD: el paso 5 reescribe la vista inventory_movement completa.
--   Los bloques 1 a 4 son copia de la vista local al 01/10/2026.
--   Antes de correrlo en prod: SHOW CREATE VIEW fayxzvov_inventory.inventory_movement
--   y comparar. Si prod difiere, conservar sus bloques y solo añadir el 5.
--
-- El -rollback borra las 4 tablas y regresa la vista a 4 bloques.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Motivos de ajuste (catálogo global, como shrinkage_reason)
--    affects_cost = 1: la diferencia cuenta como pérdida o ganancia.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`adjustment_reason` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `code`         varchar(30)  NOT NULL,
  `name`         varchar(120) NOT NULL,
  `icon`         varchar(60)  DEFAULT NULL,
  `color_hex`    varchar(9)   DEFAULT NULL,
  `bg_hex`       varchar(9)   DEFAULT NULL,
  `affects_cost` tinyint(4)   NOT NULL DEFAULT '1',
  `sort_order`   int(11)      NOT NULL DEFAULT '0',
  `active`       tinyint(4)   NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_adjr_code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;

INSERT IGNORE INTO `fayxzvov_inventory`.`adjustment_reason`
  (`code`, `name`, `icon`, `color_hex`, `bg_hex`, `affects_cost`, `sort_order`) VALUES
  ('CONTEO_FISICO',  'Conteo físico',         'clipboard-check', '#2563EB', '#DBEAFE', 1, 10),
  ('FALTANTE',       'Faltante sin explicar', 'minus-circle',    '#DC2626', '#FEE2E2', 1, 20),
  ('SOBRANTE',       'Sobrante',              'plus-circle',     '#16A34A', '#DCFCE7', 1, 30),
  ('CIERRE_MENSUAL', 'Cierre mensual',        'calendar-check',  '#7C3AED', '#F3E8FF', 1, 40),
  ('ENTRADA_NO_REG', 'Entrada no registrada', 'file-plus',       '#BE7119', '#FEF3C7', 0, 50);


-- ---------------------------------------------------------------------
-- 2. Encabezado del ajuste
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`inventory_adjustment` (
  `id`                   int(11)      NOT NULL AUTO_INCREMENT,
  `folio`                varchar(20)  NOT NULL,
  `note`                 varchar(255) DEFAULT NULL,
  `adjustment_type`      varchar(20)  NOT NULL DEFAULT 'fisico',
  `is_blind`             tinyint(4)   NOT NULL DEFAULT '0',
  `total_products`       int(11)      DEFAULT '0',
  `total_counted`        int(11)      DEFAULT '0',
  `total_differences`    int(11)      DEFAULT '0',
  `total_diff_units`     double       DEFAULT '0',
  `total_diff_cost`      double       DEFAULT '0',
  `date_adjustment`      date         DEFAULT NULL,
  `time_adjustment`      time         DEFAULT NULL,
  `submitted_at`         datetime     DEFAULT NULL,
  `authorized_at`        datetime     DEFAULT NULL,
  `reject_reason`        varchar(255) DEFAULT NULL,
  `created_at`           datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`               varchar(20)  DEFAULT 'Borrador',
  `adjustment_reason_id` int(11)      NOT NULL,
  `registered_user_id`   int(11)      DEFAULT NULL,
  `authorized_user_id`   int(11)      DEFAULT NULL,
  `warehouse_id`         int(11)      NOT NULL,
  `warehouse_area_id`    int(11)      DEFAULT NULL,
  `branch_id`            int(11)      DEFAULT NULL,
  `companies_id`         int(11)      DEFAULT NULL,
  `active`               tinyint(4)   NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_adj_reason`  (`adjustment_reason_id`) USING BTREE,
  KEY `idx_adj_ruser`   (`registered_user_id`)   USING BTREE,
  KEY `idx_adj_auser`   (`authorized_user_id`)   USING BTREE,
  KEY `idx_adj_wh`      (`warehouse_id`)         USING BTREE,
  KEY `idx_adj_area`    (`warehouse_area_id`)    USING BTREE,
  KEY `idx_adj_branch`  (`branch_id`)            USING BTREE,
  KEY `idx_adj_company` (`companies_id`)         USING BTREE,
  CONSTRAINT `fk_adj_reason`  FOREIGN KEY (`adjustment_reason_id`) REFERENCES `fayxzvov_inventory`.`adjustment_reason` (`id`),
  CONSTRAINT `fk_adj_ruser`   FOREIGN KEY (`registered_user_id`)   REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_adj_auser`   FOREIGN KEY (`authorized_user_id`)   REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_adj_wh`      FOREIGN KEY (`warehouse_id`)         REFERENCES `fayxzvov_inventory`.`warehouse` (`id`),
  CONSTRAINT `fk_adj_area`    FOREIGN KEY (`warehouse_area_id`)    REFERENCES `fayxzvov_inventory`.`warehouse_area` (`id`),
  CONSTRAINT `fk_adj_branch`  FOREIGN KEY (`branch_id`)            REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_adj_company` FOREIGN KEY (`companies_id`)         REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;


-- ---------------------------------------------------------------------
-- 3. Renglones: un producto ajustado
--    uk_dadj_item: un producto aparece una sola vez por ajuste.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`detail_inventory_adjustment` (
  `id`                      int(11)      NOT NULL AUTO_INCREMENT,
  `system_quantity`         double       DEFAULT NULL,
  `physical_quantity`       double       DEFAULT NULL,
  `difference`              double       DEFAULT NULL,
  `cost`                    double       DEFAULT NULL,
  `cost_diff`               double       NOT NULL DEFAULT '0',
  `previous_stock`          double       DEFAULT NULL,
  `resulting_stock`         double       DEFAULT NULL,
  `note`                    varchar(255) DEFAULT NULL,
  `counted_at`              datetime     DEFAULT NULL,
  `created_at`              datetime     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              datetime     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inventory_adjustment_id` int(11)      NOT NULL,
  `item_id`                 int(11)      NOT NULL,
  `active`                  tinyint(4)   NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_dadj_item` (`inventory_adjustment_id`, `item_id`) USING BTREE,
  KEY `idx_dadj_item` (`item_id`) USING BTREE,
  CONSTRAINT `fk_dadj_header` FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `fayxzvov_inventory`.`inventory_adjustment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dadj_item`   FOREIGN KEY (`item_id`)                 REFERENCES `fayxzvov_inventory`.`item` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;


-- ---------------------------------------------------------------------
-- 4. Bitácora de estados (mismo patrón que inventory_transfer_history,
--    con el estado como texto igual que purchase_order.status)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fayxzvov_inventory`.`inventory_adjustment_history` (
  `id`                      int(11)      NOT NULL AUTO_INCREMENT,
  `status`                  varchar(20)  NOT NULL,
  `note`                    varchar(255) DEFAULT NULL,
  `transitioned_at`         datetime     DEFAULT CURRENT_TIMESTAMP,
  `user_id`                 int(11)      DEFAULT NULL,
  `inventory_adjustment_id` int(11)      NOT NULL,
  `active`                  tinyint(4)   NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_hadj_header` (`inventory_adjustment_id`) USING BTREE,
  KEY `idx_hadj_user`   (`user_id`)                 USING BTREE,
  CONSTRAINT `fk_hadj_header` FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `fayxzvov_inventory`.`inventory_adjustment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_hadj_user`   FOREIGN KEY (`user_id`)                 REFERENCES `fayxzvov_erp`.`users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 ROW_FORMAT=DYNAMIC;


-- ---------------------------------------------------------------------
-- 5. Vista del kárdex: bloques 1-4 sin cambios + bloque 5 AJUSTE
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW `fayxzvov_inventory`.`inventory_movement` AS

-- 1) Entradas
SELECT CONCAT('IN-', d.id)                                 AS movement_uid,
       'ENTRADA'                                           AS movement_type,
       r.folio                                             AS folio,
       r.note                                              AS note,
       COALESCE(d.confirmed_quantity, d.quantity)          AS quantity,
       d.previous_stock                                    AS stock_prev,
       d.resulting_stock                                   AS stock_post,
       d.cost                                              AS cost_unit,
       d.subtotal                                          AS cost_total,
       COALESCE(r.date_inflow, CAST(r.created_at AS DATE)) AS occurred_at,
       r.created_at                                        AS created_at,
       r.status                                            AS status,
       d.item_id                                           AS item_id,
       r.warehouse_id                                      AS warehouse_id,
       r.user_id                                           AS user_id,
       r.branch_id                                         AS branch_id,
       r.companies_id                                      AS companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_inflow` d
  JOIN `fayxzvov_inventory`.`inventory_inflow` r ON r.id = d.inventory_inflow_id
 WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

UNION ALL

-- 2) Salidas y mermas
SELECT CONCAT('SH-', d.id),
       'MERMA',
       r.folio,
       r.note,
       -d.quantity,
       d.previous_stock,
       d.resulting_stock,
       d.cost,
       d.subtotal,
       COALESCE(r.date_shrinkage, CAST(r.created_at AS DATE)),
       r.created_at,
       r.status,
       d.item_id,
       r.warehouse_id,
       r.user_id,
       r.branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_shrinkage` d
  JOIN `fayxzvov_inventory`.`inventory_shrinkage` r ON r.id = d.inventory_shrinkage_id
 WHERE d.active = 1 AND r.active = 1 AND r.status <> 'Cancelada'

UNION ALL

-- 3) Traspasos: lo que sale del almacén origen
SELECT CONCAT('TR-OUT-', d.id),
       'TRANSFERENCIA',
       r.folio,
       r.note,
       -d.quantity,
       d.origin_stock_prev,
       d.origin_stock_post,
       d.cost,
       -d.subtotal,
       COALESCE(r.date_received, CAST(r.created_at AS DATE)),
       r.created_at,
       ts.name,
       d.item_id,
       r.origin_warehouse_id,
       r.received_user_id,
       r.origin_branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_transfer` d
  JOIN `fayxzvov_inventory`.`inventory_transfer` r ON r.id = d.inventory_transfer_id
  JOIN `fayxzvov_inventory`.`transfer_status` ts   ON ts.id = r.status_id
 WHERE d.active = 1 AND r.active = 1 AND ts.code = 'RECEIVED' AND d.origin_stock_post IS NOT NULL

UNION ALL

-- 4) Traspasos: lo que entra al almacén destino
SELECT CONCAT('TR-IN-', d.id),
       'TRANSFERENCIA',
       r.folio,
       r.note,
       d.quantity,
       d.destination_stock_prev,
       d.destination_stock_post,
       d.cost,
       d.subtotal,
       COALESCE(r.date_received, CAST(r.created_at AS DATE)),
       r.created_at,
       ts.name,
       d.item_id,
       r.destination_warehouse_id,
       r.received_user_id,
       r.destination_branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_transfer` d
  JOIN `fayxzvov_inventory`.`inventory_transfer` r ON r.id = d.inventory_transfer_id
  JOIN `fayxzvov_inventory`.`transfer_status` ts   ON ts.id = r.status_id
 WHERE d.active = 1 AND r.active = 1 AND ts.code = 'RECEIVED' AND d.destination_stock_post IS NOT NULL

UNION ALL

-- 5) NUEVO: ajustes autorizados. Solo status Aplicado y renglones con
--    diferencia; fecha y usuario son los de la autorización.
SELECT CONCAT('ADJ-', d.id),
       'AJUSTE',
       r.folio,
       r.note,
       d.difference,
       d.previous_stock,
       d.resulting_stock,
       d.cost,
       d.cost_diff,
       COALESCE(CAST(r.authorized_at AS DATE), r.date_adjustment),
       COALESCE(r.authorized_at, r.created_at),
       r.status,
       d.item_id,
       r.warehouse_id,
       COALESCE(r.authorized_user_id, r.registered_user_id),
       r.branch_id,
       r.companies_id
  FROM `fayxzvov_inventory`.`detail_inventory_adjustment` d
  JOIN `fayxzvov_inventory`.`inventory_adjustment` r ON r.id = d.inventory_adjustment_id
 WHERE d.active = 1 AND r.active = 1 AND r.status = 'Aplicado' AND d.difference <> 0;
