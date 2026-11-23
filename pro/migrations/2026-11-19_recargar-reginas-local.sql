-- =====================================================================
-- Recarga de Reginas en fayxzvov_pos (SOLO LOCAL)
-- Fecha:  19/11/2026
-- Para:   volver a dejar fayxzvov_pos igual a fayxzvov_reginas despues de
--         importar un respaldo nuevo de alpha. NO va al runbook de prod.
-- Antes:  la base ya cargada una vez (2026-11-06_migrar-reginas-a-pos.sql)
--         y 2026-11-19_base-crm.sql (lealtad y WhatsApp viven en fayxzvov_crm).
-- Despues: 2026-11-13_foto-cortes-alpha.sql
--          2026-11-14_metodos-pago-por-sucursal.sql  (paso 3: pagos de Kafeto
--          y Cuarta a sus propios metodos)
--
-- COMO SE CORRE: una llamada por archivo, con source (por tuberia se rompen
-- los acentos). Tres source en un solo -e fallaron el 19/11/2026: el cliente
-- no leyo el tercero.
--   mysql -u root --default-character-set=utf8mb4 -e "source pro/migrations/2026-11-19_recargar-reginas-local.sql"
--   mysql -u root --default-character-set=utf8mb4 -e "source pro/migrations/2026-11-13_foto-cortes-alpha.sql"
--   mysql -u root --default-character-set=utf8mb4 -e "source pro/migrations/2026-11-14_metodos-pago-por-sucursal.sql"
--
-- QUE BORRA (decision del 19/11/2026: «Borrar y recargar limpio»)
--   Todo lo de ventas, turnos, cierres, clientes y pasteles, incluidas las
--   pruebas hechas en PRO: pedidos, pagos, turnos, cierres, bitacora,
--   cuentas por cobrar, comprobantes del portal, pedidos en linea, sellos.
--   Productos: los pasteles (is_custom = 1) y los del Catalogo de PRO cuyo id
--   choca con un pastel de alpha (id = @off + order_custom.id).
--   Tarjetas, portal y avisos de clientes que solo existian en PRO.
--
-- QUE CONSERVA
--   Catalogo (categorias, grupos, modificadores, productos que no chocan),
--   metodos de pago, tipos de tarjeta, lealtad, tienda en linea, WhatsApp.
--   Las tarjetas ligadas a un cliente que si viene de alpha.
--
-- QUE TRAE: las mismas reglas que el PASO 4 de 2026-11-06_migrar-reginas-a-pos.sql
--   (ids de alpha, folio = id, pasteles en product con id = @off + id).
--   Usuarios: _map_user se llena por correo (usr_users.user = users.email).
--
-- Todo o nada: si algo falla, el borrado tambien se deshace.
-- fayxzvov_reginas y fayxzvov_alpha NO se modifican: solo se leen.
-- =====================================================================

SET NAMES utf8mb4;
USE `fayxzvov_pos`;

-- ---------------------------------------------------------------------
-- PASO 1: MAPAS (se rehacen en cada corrida)
-- Tablas normales, no TEMPORARY: la venta lee _map_user tres veces y
-- MySQL 5.7 no deja abrir una tabla temporal dos veces en la misma consulta.
-- ---------------------------------------------------------------------

SET @company_id := (SELECT `id` FROM `fayxzvov_app`.`companies` WHERE `name` = 'Reginas' LIMIT 1);

DROP TABLE IF EXISTS `_map_branch`;
CREATE TABLE `_map_branch` (
  `subsidiary_id`  INT NOT NULL COMMENT 'fayxzvov_alpha.subsidiaries.id (lo que usa reginas)',
  `name`           VARCHAR(255) NULL DEFAULT NULL,
  `branch_id`      INT NULL DEFAULT NULL COMMENT 'fayxzvov_app.branches.id',
  `company_id`     INT NULL DEFAULT NULL COMMENT 'fayxzvov_app.companies.id',
  PRIMARY KEY (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Temporal de recarga: sucursal alpha -> sucursal PRO';

-- Sucursales por NOMBRE en la empresa (como 2026-11-13_usuarios-reginas-pro.sql).
INSERT INTO `_map_branch` (`subsidiary_id`, `name`, `branch_id`, `company_id`)
SELECT m.`subsidiary_id`, m.`name`, b.`id`, b.`company_id`
  FROM (SELECT 4 AS `subsidiary_id`, 'Reginas Guadalupe' AS `name`
        UNION ALL SELECT 25, 'Reginas Kafeto'
        UNION ALL SELECT 22, 'Reginas Cuarta') m
  LEFT JOIN `fayxzvov_app`.`branches` b
    ON b.`company_id` = @company_id
   AND b.`name` = m.`name`;

-- Una sucursal nueva en alpha entra sin par y detiene la recarga (guardia).
INSERT IGNORE INTO `_map_branch` (`subsidiary_id`)
SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order`          WHERE `subsidiaries_id` IS NOT NULL
UNION SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order_payments` WHERE `subsidiaries_id` IS NOT NULL
UNION SELECT `subsidiary_id`   FROM `fayxzvov_reginas`.`cash_shift`     WHERE `subsidiary_id`   IS NOT NULL
UNION SELECT `subsidiary_id`   FROM `fayxzvov_reginas`.`daily_closure`  WHERE `subsidiary_id`   IS NOT NULL
UNION SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order_clients`  WHERE `subsidiaries_id` IS NOT NULL;

DROP TABLE IF EXISTS `_map_user`;
CREATE TABLE `_map_user` (
  `usr_users_id`  INT NOT NULL COMMENT 'fayxzvov_alpha.usr_users.id (lo que usa reginas)',
  `name`          VARCHAR(255) NULL DEFAULT NULL,
  `user_id`       INT NULL DEFAULT NULL COMMENT 'fayxzvov_app.users.id; NULL = se migra sin usuario',
  PRIMARY KEY (`usr_users_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Temporal de recarga: usuario alpha -> usuario PRO';

INSERT IGNORE INTO `_map_user` (`usr_users_id`)
SELECT `created_by`   FROM `fayxzvov_reginas`.`order`           WHERE `created_by`   IS NOT NULL
UNION SELECT `cancelled_by` FROM `fayxzvov_reginas`.`order`           WHERE `cancelled_by` IS NOT NULL
UNION SELECT `produced_by`  FROM `fayxzvov_reginas`.`order`           WHERE `produced_by`  IS NOT NULL
UNION SELECT `employee_id`  FROM `fayxzvov_reginas`.`cash_shift`      WHERE `employee_id`  IS NOT NULL
UNION SELECT `employee_id`  FROM `fayxzvov_reginas`.`daily_closure`   WHERE `employee_id`  IS NOT NULL
UNION SELECT `reopened_by`  FROM `fayxzvov_reginas`.`daily_closure`   WHERE `reopened_by`  IS NOT NULL
UNION SELECT `usr_users_id` FROM `fayxzvov_reginas`.`order_histories` WHERE `usr_users_id` IS NOT NULL;

-- Par por correo. usr_users es latin1: se convierten los dos lados a utf8mb4.
UPDATE `_map_user` m
  JOIN `fayxzvov_alpha`.`usr_users` a ON a.`id` = m.`usr_users_id`
  LEFT JOIN `fayxzvov_app`.`users` u
    ON CONVERT(LOWER(u.`email`) USING utf8mb4) = CONVERT(LOWER(TRIM(a.`user`)) USING utf8mb4)
   AND u.`company_id` = @company_id
   SET m.`name`    = CONVERT(CONCAT_WS(' / ', a.`fullname`, a.`user`) USING utf8mb4),
       m.`user_id` = u.`id`;

-- ---------------------------------------------------------------------
-- PASO 2: GUARDIAS (si una se cumple, MySQL se detiene con
-- "Duplicate entry '<mensaje>'" antes de borrar nada)
-- ---------------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS `_guard`;
CREATE TEMPORARY TABLE `_guard` (
  `msg` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`msg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: no existe la empresa Reginas en fayxzvov_app'
  FROM (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE @company_id IS NULL;

INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: sucursal de alpha sin par en _map_branch'
  FROM `_map_branch` m
 CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE m.`branch_id` IS NULL OR m.`company_id` IS NULL;

-- El catalogo no se recarga: si alpha trae categorias, grupos, modificadores
-- o productos nuevos, las ventas apuntarian a un id que no existe.
INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: alpha trae catalogo nuevo; cargarlo antes de recargar ventas'
  FROM (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE EXISTS (SELECT 1 FROM `fayxzvov_reginas`.`order_category` r          WHERE NOT EXISTS (SELECT 1 FROM `category` p       WHERE p.`id` = r.`id`))
    OR EXISTS (SELECT 1 FROM `fayxzvov_reginas`.`order_modifier` r          WHERE NOT EXISTS (SELECT 1 FROM `modifier_group` p WHERE p.`id` = r.`id`))
    OR EXISTS (SELECT 1 FROM `fayxzvov_reginas`.`order_modifier_products` r WHERE NOT EXISTS (SELECT 1 FROM `modifier` p       WHERE p.`id` = r.`id`))
    OR EXISTS (SELECT 1 FROM `fayxzvov_reginas`.`order_products` r          WHERE NOT EXISTS (SELECT 1 FROM `product` p        WHERE p.`id` = r.`id`));

-- ---------------------------------------------------------------------
-- PASO 3: QUE SE VA (se calcula antes de borrar)
-- ---------------------------------------------------------------------

SET @off := (SELECT (FLOOR(IFNULL(MAX(`id`), 0) / 1000) + 1) * 1000
               FROM `fayxzvov_reginas`.`order_products`);

-- Clientes que solo existen en PRO: su id no viene de alpha, o alpha ya
-- tiene otra persona en ese id (misma fecha de alta = misma persona).
DROP TEMPORARY TABLE IF EXISTS `_gone_customer`;
CREATE TEMPORARY TABLE `_gone_customer` (PRIMARY KEY (`id`)) AS
SELECT p.`id`
  FROM `customer` p
 WHERE NOT EXISTS (SELECT 1 FROM `fayxzvov_reginas`.`order_clients` r
                    WHERE r.`id` = p.`id`
                      AND (r.`date_create` IS NULL OR r.`date_create` = p.`created_at`));

-- Productos: todos los pasteles y lo que ocupe el id de un pastel de alpha.
DROP TEMPORARY TABLE IF EXISTS `_gone_product`;
CREATE TEMPORARY TABLE `_gone_product` (PRIMARY KEY (`id`)) AS
SELECT p.`id`
  FROM `product` p
 WHERE p.`is_custom` = 1
    OR (p.`id` > @off AND (p.`id` - @off) IN (SELECT `id` FROM `fayxzvov_reginas`.`order_custom`));

-- Lealtad y WhatsApp estan en fayxzvov_crm desde 2026-11-19_base-crm.sql.
DROP TEMPORARY TABLE IF EXISTS `_gone_card`;
CREATE TEMPORARY TABLE `_gone_card` (PRIMARY KEY (`id`)) AS
SELECT c.`id` FROM `fayxzvov_crm`.`card` c WHERE c.`customer_id` IN (SELECT `id` FROM `_gone_customer`);

-- ---------------------------------------------------------------------
-- PASO 4: BORRAR Y VOLVER A CARGAR (todo o nada)
-- ---------------------------------------------------------------------

START TRANSACTION;

-- Sin revision de llaves para borrar en cualquier orden. Ojo: asi tampoco
-- corre el ON DELETE CASCADE; por eso cada tabla se borra a mano.
SET FOREIGN_KEY_CHECKS = 0;

-- -- Lo que cuelga de ventas, turnos y clientes de prueba --
DELETE FROM `receivable`;
DELETE FROM `customer_receipt`;
DELETE FROM `online_order`;
DELETE FROM `customer_portal`    WHERE `customer_id` IN (SELECT `id` FROM `_gone_customer`);
DELETE FROM `fayxzvov_crm`.`card_stamp`;
DELETE FROM `fayxzvov_crm`.`wa_proposal`    WHERE `sale_id` IS NOT NULL;
DELETE FROM `fayxzvov_crm`.`wa_reminder`    WHERE `customer_id` IN (SELECT `id` FROM `_gone_customer`);
UPDATE `fayxzvov_crm`.`wa_chat` SET `customer_id` = NULL WHERE `customer_id` IN (SELECT `id` FROM `_gone_customer`);
DELETE FROM `fayxzvov_crm`.`loyalty_signup_log` WHERE `customer_id` IN (SELECT `id` FROM `_gone_customer`)
                                                   OR `card_id`     IN (SELECT `id` FROM `_gone_card`);
DELETE FROM `fayxzvov_crm`.`loyalty_notice`     WHERE `customer_id` IN (SELECT `id` FROM `_gone_customer`)
                                                   OR `card_id`     IN (SELECT `id` FROM `_gone_card`);
DELETE FROM `fayxzvov_crm`.`card_level_log`     WHERE `card_id`     IN (SELECT `id` FROM `_gone_card`);
DELETE FROM `fayxzvov_crm`.`card`               WHERE `id`          IN (SELECT `id` FROM `_gone_card`);

-- -- Ventas, caja y clientes --
DELETE FROM `history_log`;
DELETE FROM `sale_image`;
DELETE FROM `detail_sale`;
DELETE FROM `payment`;
DELETE FROM `sale`;
DELETE FROM `turn_payment`;
DELETE FROM `turn_status`;
DELETE FROM `turn`;
DELETE FROM `daily_closure_payment`;
DELETE FROM `daily_closure_status`;
DELETE FROM `daily_closure`;
DELETE FROM `customer`;

-- -- Pasteles y productos que chocan --
-- Una consulta por columna: MySQL 5.7 no abre la misma tabla temporal dos veces.
DELETE FROM `product_recipe`    WHERE `product_id`   IN (SELECT `id` FROM `_gone_product`);
DELETE FROM `product_recipe`    WHERE `component_id` IN (SELECT `id` FROM `_gone_product`);
DELETE FROM `fayxzvov_crm`.`wa_agent_product` WHERE `product_id` IN (SELECT `id` FROM `_gone_product`);
DELETE FROM `product_modifier`  WHERE `product_id`   IN (SELECT `id` FROM `_gone_product`);
DELETE FROM `product`           WHERE `id`           IN (SELECT `id` FROM `_gone_product`);

-- Desde aqui las llaves se revisan: un id que no exista detiene todo.
SET FOREIGN_KEY_CHECKS = 1;

-- phone en reginas es DOUBLE: se pasa a texto sin decimales.
INSERT INTO `customer`
  (`id`, `name`, `phone`, `email`, `created_at`, `updated_at`, `branch_id`, `active`)
SELECT c.`id`, COALESCE(c.`name`, ''),
       NULLIF(CAST(CAST(c.`phone` AS UNSIGNED) AS CHAR), '0'),
       NULLIF(c.`email`, ''),
       COALESCE(c.`date_create`, NOW()), COALESCE(c.`date_create`, NOW()),
       mb.`branch_id`, COALESCE(c.`active`, 1)
  FROM `fayxzvov_reginas`.`order_clients` c
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = c.`subsidiaries_id`;

-- Pasteles personalizados -> product con is_custom = 1.
-- price = price_real (lo que se cobra); suggested_price = price (lo calculado).
INSERT INTO `product`
  (`id`, `name`, `description`, `image`, `kind`, `price`, `suggested_price`,
   `portion_qty`, `is_custom`, `sell_pos`, `in_catalog`,
   `created_at`, `updated_at`, `company_id`, `branch_id`, `active`)
SELECT @off + c.`id`, COALESCE(c.`name`, 'Pastel personalizado'), c.`description`,
       c.`image`, 'product',
       COALESCE(c.`price_real`, c.`price`, 0), c.`price`, c.`portion_qty`, 1, 0, 0,
       COALESCE(c.`date_created`, NOW()), COALESCE(c.`date_created`, NOW()),
       COALESCE(mb.`company_id`, @company_id), mb.`branch_id`, 1
  FROM `fayxzvov_reginas`.`order_custom` c
  LEFT JOIN (
        SELECT pk.`custom_id`, MIN(o.`subsidiaries_id`) AS `subsidiaries_id`
          FROM `fayxzvov_reginas`.`order_package` pk
          JOIN `fayxzvov_reginas`.`order` o ON o.`id` = pk.`pedidos_id`
         WHERE pk.`custom_id` IS NOT NULL
         GROUP BY pk.`custom_id`
       ) u ON u.`custom_id` = c.`id`
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = u.`subsidiaries_id`;

INSERT INTO `product_modifier`
  (`id`, `details`, `quantity`, `price`, `created_at`, `updated_at`,
   `product_id`, `modifier_id`)
SELECT cp.`id`, NULLIF(cp.`details`, ''), COALESCE(cp.`quantity`, 0),
       COALESCE(cp.`price`, 0),
       COALESCE(cp.`date_created`, NOW()), COALESCE(cp.`date_created`, NOW()),
       @off + cp.`custom_id`, cp.`modifier_id`
  FROM `fayxzvov_reginas`.`order_custom_products` cp;

-- -- Cierres y turnos --

INSERT INTO `daily_closure`
  (`id`, `folio`, `orders_count`, `turns_count`, `reopen_reason`,
   `subtotal`, `discount`, `tax`, `total`, `total_shifts`, `total_cash`,
   `closure_date`, `reopened_at`, `created_at`, `updated_at`,
   `branch_id`, `user_id`, `reopened_user_id`, `active`)
SELECT d.`id`, CAST(d.`id` AS CHAR), COALESCE(d.`total_orders`, 0),
       (SELECT COUNT(*) FROM `fayxzvov_reginas`.`cash_shift` s WHERE s.`daily_closure_id` = d.`id`),
       d.`reopen_reason`,
       COALESCE(d.`subtotal`, 0), COALESCE(d.`total_discount`, 0), COALESCE(d.`tax`, 0),
       COALESCE(d.`total`, 0), COALESCE(d.`total_shifts`, 0), COALESCE(d.`total_cash`, 0),
       d.`closure_date`, d.`reopened_at`,
       COALESCE(d.`created_at`, d.`closure_date`, NOW()),
       COALESCE(d.`reopened_at`, d.`created_at`, d.`closure_date`, NOW()),
       mb.`branch_id`, mu.`user_id`, mr.`user_id`, COALESCE(d.`active`, 1)
  FROM `fayxzvov_reginas`.`daily_closure` d
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = d.`subsidiary_id`
  LEFT JOIN `_map_user`   mu ON mu.`usr_users_id` = d.`employee_id`
  LEFT JOIN `_map_user`   mr ON mr.`usr_users_id` = d.`reopened_by`;

INSERT INTO `turn`
  (`id`, `folio`, `orders_count`, `opening_cash`, `total_sales`,
   `opened_at`, `closed_at`, `created_at`, `updated_at`, `status`,
   `branch_id`, `user_id`, `daily_closure_id`, `active`)
SELECT s.`id`, COALESCE(NULLIF(s.`shift_name`, ''), CAST(s.`id` AS CHAR)),
       COALESCE(s.`total_orders`, 0), COALESCE(s.`opening_amount`, 0),
       COALESCE(s.`total_sales`, 0),
       s.`opened_at`, s.`closed_at`,
       COALESCE(s.`opened_at`, NOW()), COALESCE(s.`closed_at`, s.`opened_at`, NOW()),
       COALESCE(s.`status`, 'open'),
       mb.`branch_id`, mu.`user_id`, s.`daily_closure_id`, COALESCE(s.`active`, 1)
  FROM `fayxzvov_reginas`.`cash_shift` s
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = s.`subsidiary_id`
  LEFT JOIN `_map_user`   mu ON mu.`usr_users_id` = s.`employee_id`;

-- -- Ventas --
-- sale_status_id = order.status (1 Cotizacion, 2 Pendiente, 3 Pagado, 4 Cancelado).
-- sale_type_id: 3 POS si is_pos = 1, si no 1 Pedido.

INSERT INTO `sale`
  (`id`, `folio`, `note`, `location`, `delivery_method`, `delivery_status`, `discount_note`,
   `subtotal`, `discount_amount`, `tip_amount`, `total`,
   `delivery_date`, `delivery_time`, `birthday_date`, `cancelled_at`, `produced_at`,
   `created_at`, `updated_at`,
   `branch_id`, `user_id`, `cancel_user_id`, `produced_user_id`,
   `sale_status_id`, `sale_type_id`, `customer_id`, `turn_id`, `daily_closure_id`, `active`)
SELECT o.`id`, CAST(o.`id` AS CHAR), o.`note`, NULLIF(o.`location`, ''),
       COALESCE(o.`delivery_type`, 0), COALESCE(o.`is_delivered`, 0), o.`info_discount`,
       COALESCE(o.`total_pay`, 0), COALESCE(o.`discount`, 0), COALESCE(o.`tip_amount`, 0),
       COALESCE(o.`total_pay`, 0) - COALESCE(o.`discount`, 0),
       o.`date_order`, o.`time_order`, DATE(o.`date_birthday`), o.`cancelled_at`, o.`produced_at`,
       COALESCE(o.`date_creation`, NOW()), COALESCE(o.`date_creation`, NOW()),
       mb.`branch_id`, mc.`user_id`, mx.`user_id`, mp.`user_id`,
       o.`status`, IF(o.`is_pos` = 1, 3, 1), o.`client_id`, o.`cash_shift_id`,
       o.`daily_closure_id`, 1
  FROM `fayxzvov_reginas`.`order` o
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = o.`subsidiaries_id`
  LEFT JOIN `_map_user`   mc ON mc.`usr_users_id` = o.`created_by`
  LEFT JOIN `_map_user`   mx ON mx.`usr_users_id` = o.`cancelled_by`
  LEFT JOIN `_map_user`   mp ON mp.`usr_users_id` = o.`produced_by`;

INSERT INTO `detail_sale`
  (`id`, `name`, `details`, `dedication`, `price`, `quantity`,
   `created_at`, `updated_at`, `status`, `sale_id`, `product_id`, `active`)
SELECT pk.`id`, COALESCE(pr.`name`, cu.`name`), pk.`order_details`, pk.`dedication`,
       COALESCE(NULLIF(pk.`price`, 0), pr.`price`, cu.`price_real`, cu.`price`, 0),
       COALESCE(pk.`quantity`, 1),
       COALESCE(pk.`date_creation`, NOW()), COALESCE(pk.`date_creation`, NOW()),
       COALESCE(pk.`status`, 1), pk.`pedidos_id`,
       COALESCE(pk.`product_id`, @off + pk.`custom_id`), 1
  FROM `fayxzvov_reginas`.`order_package` pk
  LEFT JOIN `fayxzvov_reginas`.`order_products` pr ON pr.`id` = pk.`product_id`
  LEFT JOIN `fayxzvov_reginas`.`order_custom`   cu ON cu.`id` = pk.`custom_id`;

INSERT INTO `sale_image`
  (`id`, `path`, `name`, `original_name`, `created_at`, `updated_at`, `detail_sale_id`)
SELECT i.`id`, i.`path`, i.`name`, i.`original_name`,
       COALESCE(i.`date_created`, NOW()), COALESCE(i.`date_created`, NOW()),
       i.`package_id`
  FROM `fayxzvov_reginas`.`order_images` i;

-- Pagos. La sucursal es donde se cobro; si no se guardo, la del pedido.
-- turn_id: el turno de esa sucursal abierto a la hora del pago.
INSERT INTO `payment`
  (`id`, `description`, `amount`, `paid_at`, `created_at`, `updated_at`,
   `branch_id`, `sale_id`, `payment_method_id`, `turn_id`, `active`)
SELECT p.`id`, p.`description`, COALESCE(p.`pay`, 0), p.`date_pay`,
       COALESCE(p.`date_pay`, NOW()), COALESCE(p.`date_pay`, NOW()),
       mb.`branch_id`, p.`order_id`, p.`method_pay_id`,
       (SELECT MIN(s.`id`)
          FROM `fayxzvov_reginas`.`cash_shift` s
         WHERE s.`subsidiary_id` = COALESCE(p.`subsidiaries_id`, o.`subsidiaries_id`)
           AND p.`date_pay` BETWEEN s.`opened_at` AND IFNULL(s.`closed_at`, NOW())),
       1
  FROM `fayxzvov_reginas`.`order_payments` p
  JOIN `fayxzvov_reginas`.`order` o ON o.`id` = p.`order_id`
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = COALESCE(p.`subsidiaries_id`, o.`subsidiaries_id`);

INSERT INTO `history_log`
  (`id`, `title`, `action`, `detail`, `type`, `created_at`, `updated_at`, `user_id`, `sale_id`)
SELECT h.`id`, h.`title`, h.`action`, h.`comment`, h.`type`,
       COALESCE(h.`date_action`, NOW()), COALESCE(h.`date_action`, NOW()),
       mu.`user_id`, o.`id`
  FROM `fayxzvov_reginas`.`order_histories` h
  LEFT JOIN `fayxzvov_reginas`.`order` o ON o.`id` = h.`order_id`
  LEFT JOIN `_map_user` mu ON mu.`usr_users_id` = h.`usr_users_id`;

-- -- Totales de turno y de cierre (la foto de PRO la rehace foto-cortes) --

INSERT INTO `turn_payment`
  (`id`, `amount`, `created_at`, `updated_at`, `turn_id`, `payment_method_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(s.`closed_at`, s.`opened_at`, NOW()), COALESCE(s.`closed_at`, s.`opened_at`, NOW()),
       x.`cash_shift_id`, x.`payment_method_id`
  FROM `fayxzvov_reginas`.`shift_payment` x
  JOIN `fayxzvov_reginas`.`cash_shift` s ON s.`id` = x.`cash_shift_id`;

INSERT INTO `turn_status`
  (`id`, `amount`, `created_at`, `updated_at`, `turn_id`, `sale_status_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(s.`closed_at`, s.`opened_at`, NOW()), COALESCE(s.`closed_at`, s.`opened_at`, NOW()),
       x.`cash_shift_id`, x.`status_process_id`
  FROM `fayxzvov_reginas`.`shift_status_process` x
  JOIN `fayxzvov_reginas`.`cash_shift` s ON s.`id` = x.`cash_shift_id`;

INSERT INTO `daily_closure_payment`
  (`id`, `amount`, `created_at`, `updated_at`, `daily_closure_id`, `payment_method_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(d.`created_at`, d.`closure_date`, NOW()), COALESCE(d.`created_at`, d.`closure_date`, NOW()),
       x.`daily_closure_id`, x.`payment_method_id`
  FROM `fayxzvov_reginas`.`closure_payment` x
  JOIN `fayxzvov_reginas`.`daily_closure` d ON d.`id` = x.`daily_closure_id`;

INSERT INTO `daily_closure_status`
  (`id`, `amount`, `created_at`, `updated_at`, `daily_closure_id`, `sale_status_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(d.`created_at`, d.`closure_date`, NOW()), COALESCE(d.`created_at`, d.`closure_date`, NOW()),
       x.`daily_closure_id`, x.`status_process_id`
  FROM `fayxzvov_reginas`.`closure_status_proccess` x
  JOIN `fayxzvov_reginas`.`daily_closure` d ON d.`id` = x.`daily_closure_id`;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS `_gone_card`;
DROP TEMPORARY TABLE IF EXISTS `_gone_product`;
DROP TEMPORARY TABLE IF EXISTS `_gone_customer`;
DROP TEMPORARY TABLE IF EXISTS `_guard`;
DROP TABLE IF EXISTS `_map_branch`, `_map_user`;

-- ---------------------------------------------------------------------
-- PASO 5: COMPROBACION (origen y destino deben coincidir)
-- ---------------------------------------------------------------------

SELECT 'sale'          AS tabla, (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order`)           AS origen, (SELECT COUNT(*) FROM `sale`)                         AS destino
UNION ALL SELECT 'detail_sale',   (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_package`),         (SELECT COUNT(*) FROM `detail_sale`)
UNION ALL SELECT 'payment',       (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_payments`),        (SELECT COUNT(*) FROM `payment`)
UNION ALL SELECT 'pasteles',      (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_custom`),          (SELECT COUNT(*) FROM `product` WHERE `is_custom` = 1)
UNION ALL SELECT 'customer',      (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_clients`),         (SELECT COUNT(*) FROM `customer`)
UNION ALL SELECT 'turn',          (SELECT COUNT(*) FROM `fayxzvov_reginas`.`cash_shift`),            (SELECT COUNT(*) FROM `turn`)
UNION ALL SELECT 'daily_closure', (SELECT COUNT(*) FROM `fayxzvov_reginas`.`daily_closure`),         (SELECT COUNT(*) FROM `daily_closure`)
UNION ALL SELECT 'history_log',   (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_histories`),       (SELECT COUNT(*) FROM `history_log`)
UNION ALL SELECT 'sale_image',    (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_images`),          (SELECT COUNT(*) FROM `sale_image`)
UNION ALL SELECT '$ ventas netas',
          (SELECT ROUND(SUM(COALESCE(`total_pay`, 0) - COALESCE(`discount`, 0)), 2) FROM `fayxzvov_reginas`.`order`),
          (SELECT ROUND(SUM(`total`), 2) FROM `sale`)
UNION ALL SELECT '$ pagos',
          (SELECT ROUND(SUM(COALESCE(`pay`, 0)), 2) FROM `fayxzvov_reginas`.`order_payments`),
          (SELECT ROUND(SUM(`amount`), 2) FROM `payment`);
