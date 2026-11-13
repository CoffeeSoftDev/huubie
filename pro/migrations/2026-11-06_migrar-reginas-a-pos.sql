-- =====================================================================
-- Copia los datos de fayxzvov_reginas a fayxzvov_pos
-- Fecha:  06/11/2026
-- Antes:  2026-11-06_crear-fayxzvov-pos.sql (la base tiene que estar vacia)
-- Deshacer: 2026-11-06_crear-fayxzvov-pos-rollback.sql y volver a crearla.
--           fayxzvov_reginas NO se modifica: solo se lee.
--
-- COMO SE CORRE (dos vueltas)
--   1a vuelta: crea los mapas _map_branch y _map_user, los precarga con los
--      ids de alpha que usa reginas y SE DETIENE en el guardia con:
--        Duplicate entry 'ALTO: falta branch_id o company_id en _map_branch'
--      Es a proposito: falta decir a que sucursal y usuario de PRO va cada uno.
--   Llena los mapas (PASO 2) y corre el archivo completo otra vez.
--   2a vuelta: los mapas no se pisan, los guardias pasan y se copia todo
--      dentro de una transaccion: o entra completo o no entra nada.
--
-- QUE SE CONSERVA
--   Los ids de origen (folio de la venta = order.id, como en alpha).
--   Los pasteles personalizados (order_custom) entran a product con
--   is_custom = 1 e id = @off + order_custom.id, para no chocar con el
--   catalogo. @off es el siguiente millar arriba de order_products (hoy 1000).
--
-- LO QUE NO SE PUEDE TRAER (queda vacio o en NULL)
--   payment.user_id ........ order_payments no guarda quien cobro.
--   payment.turn_id ........ se busca el turno abierto de la sucursal a la
--                            hora del pago; local: 360 de 1968 sin turno.
--   turn.counted_cash ...... reginas no guarda el efectivo contado.
--   detail_sale.price ...... order_package.price viene vacio en todas las
--                            filas; se toma el precio ACTUAL del producto o
--                            el price_real del personalizado (lo mismo que
--                            muestra alpha hoy).
--   history_log.sale_id .... 43 entradas de la bitacora apuntan a pedidos
--                            que ya no existen.
--   Usuarios sin mapear .... la columna queda en NULL.
-- =====================================================================

SET NAMES utf8mb4;
USE `fayxzvov_pos`;

-- ---------------------------------------------------------------------
-- PASO 1: MAPAS (se pueden correr N veces; no pisan lo que ya llenaste)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `_map_branch` (
  `subsidiary_id`  INT NOT NULL COMMENT 'fayxzvov_alpha.subsidiaries.id (lo que usa reginas)',
  `name`           VARCHAR(255) NULL DEFAULT NULL COMMENT 'solo para saber cual es',
  `branch_id`      INT NULL DEFAULT NULL COMMENT 'fayxzvov_app.branches.id',
  `company_id`     INT NULL DEFAULT NULL COMMENT 'fayxzvov_app.companies.id',
  PRIMARY KEY (`subsidiary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Temporal de migracion: sucursal alpha -> sucursal PRO';

CREATE TABLE IF NOT EXISTS `_map_user` (
  `usr_users_id`  INT NOT NULL COMMENT 'fayxzvov_alpha.usr_users.id (lo que usa reginas)',
  `name`          VARCHAR(255) NULL DEFAULT NULL COMMENT 'solo para saber quien es',
  `user_id`       INT NULL DEFAULT NULL COMMENT 'fayxzvov_app.users.id; NULL = se migra sin usuario',
  PRIMARY KEY (`usr_users_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Temporal de migracion: usuario alpha -> usuario PRO';

INSERT IGNORE INTO `_map_branch` (`subsidiary_id`)
SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order`          WHERE `subsidiaries_id` IS NOT NULL
UNION SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order_payments` WHERE `subsidiaries_id` IS NOT NULL
UNION SELECT `subsidiary_id`   FROM `fayxzvov_reginas`.`cash_shift`     WHERE `subsidiary_id`   IS NOT NULL
UNION SELECT `subsidiary_id`   FROM `fayxzvov_reginas`.`daily_closure`  WHERE `subsidiary_id`   IS NOT NULL
UNION SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order_clients`  WHERE `subsidiaries_id` IS NOT NULL
UNION SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order_category` WHERE `subsidiaries_id` IS NOT NULL
UNION SELECT `subsidiaries_id` FROM `fayxzvov_reginas`.`order_products` WHERE `subsidiaries_id` IS NOT NULL;

INSERT IGNORE INTO `_map_user` (`usr_users_id`)
SELECT `created_by`   FROM `fayxzvov_reginas`.`order`           WHERE `created_by`   IS NOT NULL
UNION SELECT `cancelled_by` FROM `fayxzvov_reginas`.`order`           WHERE `cancelled_by` IS NOT NULL
UNION SELECT `produced_by`  FROM `fayxzvov_reginas`.`order`           WHERE `produced_by`  IS NOT NULL
UNION SELECT `employee_id`  FROM `fayxzvov_reginas`.`cash_shift`      WHERE `employee_id`  IS NOT NULL
UNION SELECT `employee_id`  FROM `fayxzvov_reginas`.`daily_closure`   WHERE `employee_id`  IS NOT NULL
UNION SELECT `reopened_by`  FROM `fayxzvov_reginas`.`daily_closure`   WHERE `reopened_by`  IS NOT NULL
UNION SELECT `usr_users_id` FROM `fayxzvov_reginas`.`order_histories` WHERE `usr_users_id` IS NOT NULL;

-- Nombres de alpha para que sepas a quien mapear.
-- Si fayxzvov_alpha no esta en este servidor, borra estos dos UPDATE.
UPDATE `_map_branch` m
  JOIN `fayxzvov_alpha`.`subsidiaries` s ON s.`id` = m.`subsidiary_id`
   SET m.`name` = s.`name`
 WHERE m.`name` IS NULL;

UPDATE `_map_user` m
  JOIN `fayxzvov_alpha`.`usr_users` u ON u.`id` = m.`usr_users_id`
   SET m.`name` = CONCAT_WS(' / ', u.`fullname`, u.`user`)
 WHERE m.`name` IS NULL;

-- ---------------------------------------------------------------------
-- PASO 2: LLENAR LOS MAPAS A MANO (entre la 1a y la 2a vuelta)
--
--   SELECT * FROM fayxzvov_pos._map_branch;   -- local: 4, 22, 25 (empresa alpha 4)
--   SELECT * FROM fayxzvov_pos._map_user;     -- local: 42 usuarios
--
--   UPDATE fayxzvov_pos._map_branch SET branch_id = ?, company_id = ? WHERE subsidiary_id = 4;
--   UPDATE fayxzvov_pos._map_user   SET user_id = ?                   WHERE usr_users_id = 49;
--
--   _map_branch es obligatorio y las 3 sucursales van a UNA sola empresa.
--   _map_user es opcional: el que quede en NULL se migra sin usuario.
--   Un id que no exista en fayxzvov_app detiene la migracion (FK) y no
--   entra nada.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- PASO 3: GUARDIAS
-- Cada uno inserta su mensaje DOS veces en una tabla con llave primaria:
-- si la condicion se cumple, MySQL se detiene con
-- "Duplicate entry '<mensaje>'". Si no, no inserta nada y sigue.
-- ---------------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS `_guard`;
CREATE TEMPORARY TABLE `_guard` (
  `msg` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`msg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: falta branch_id o company_id en _map_branch'
  FROM `_map_branch` m
 CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE m.`branch_id` IS NULL OR m.`company_id` IS NULL;

INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: _map_branch apunta a mas de una empresa'
  FROM (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE (SELECT COUNT(DISTINCT `company_id`) FROM `_map_branch`) > 1;

INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: fayxzvov_pos ya tiene datos; esta migracion corre una sola vez'
  FROM (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE EXISTS (SELECT 1 FROM `sale`)
    OR EXISTS (SELECT 1 FROM `product`)
    OR EXISTS (SELECT 1 FROM `customer`)
    OR EXISTS (SELECT 1 FROM `turn`);

-- ---------------------------------------------------------------------
-- PASO 4: COPIA (todo o nada)
-- ---------------------------------------------------------------------

SET @company_id := (SELECT MIN(`company_id`) FROM `_map_branch`);
SET @off        := (SELECT (FLOOR(IFNULL(MAX(`id`), 0) / 1000) + 1) * 1000
                      FROM `fayxzvov_reginas`.`order_products`);

SET FOREIGN_KEY_CHECKS = 1;
START TRANSACTION;

-- -- Catalogos --

INSERT INTO `category`
  (`id`, `name`, `description`, `created_at`, `updated_at`, `branch_id`, `active`)
SELECT c.`id`, COALESCE(c.`classification`, ''), c.`description`,
       COALESCE(c.`date_creation`, NOW()), COALESCE(c.`date_creation`, NOW()),
       mb.`branch_id`, COALESCE(c.`active`, 1)
  FROM `fayxzvov_reginas`.`order_category` c
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = c.`subsidiaries_id`;

INSERT INTO `modifier_group`
  (`id`, `name`, `is_extra`, `created_at`, `updated_at`, `company_id`, `active`)
SELECT g.`id`, COALESCE(g.`name`, ''), COALESCE(g.`isExtra`, 0),
       COALESCE(g.`date_creation`, NOW()), COALESCE(g.`date_creation`, NOW()),
       @company_id, COALESCE(g.`active`, 1)
  FROM `fayxzvov_reginas`.`order_modifier` g;

INSERT INTO `modifier`
  (`id`, `name`, `description`, `price`, `quantity`, `created_at`, `updated_at`,
   `modifier_group_id`, `active`)
SELECT m.`id`, COALESCE(m.`name`, ''), m.`description`,
       COALESCE(m.`price`, 0), COALESCE(m.`cant`, 0),
       COALESCE(m.`date_creation`, NOW()), COALESCE(m.`date_creation`, NOW()),
       m.`modifier_id`, COALESCE(m.`active`, 1)
  FROM `fayxzvov_reginas`.`order_modifier_products` m;

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

-- -- Productos del catalogo --

INSERT INTO `product`
  (`id`, `name`, `description`, `image`, `kind`, `price`, `is_custom`,
   `created_at`, `updated_at`, `company_id`, `branch_id`, `category_id`, `active`)
SELECT p.`id`, COALESCE(p.`name`, ''), p.`description`, p.`image`, 'product',
       COALESCE(p.`price`, 0), 0,
       COALESCE(p.`date_creation`, NOW()), COALESCE(p.`date_creation`, NOW()),
       COALESCE(mb.`company_id`, @company_id), mb.`branch_id`, p.`category_id`,
       COALESCE(p.`active`, 1)
  FROM `fayxzvov_reginas`.`order_products` p
  LEFT JOIN `_map_branch` mb ON mb.`subsidiary_id` = p.`subsidiaries_id`;

-- -- Pasteles personalizados -> product con is_custom = 1 --
-- price = price_real (lo que se cobra); suggested_price = price (lo calculado).
-- La sucursal sale del pedido que lo usa; 54 nunca se usaron y quedan sin sucursal.

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
-- order.type_id no se migra: repite el mismo estado sin el cancelado.
-- sale_type_id: 3 POS si is_pos = 1, si no 1 Pedido (en local todos son Pedido).

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
-- turn_id: el turno de esa sucursal abierto a la hora del pago (el primero
-- si hay dos). Sin turno que coincida queda NULL.
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

-- -- Totales de turno y de cierre --

INSERT INTO `detail_turn_payment`
  (`id`, `amount`, `created_at`, `updated_at`, `turn_id`, `payment_method_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(s.`closed_at`, s.`opened_at`, NOW()), COALESCE(s.`closed_at`, s.`opened_at`, NOW()),
       x.`cash_shift_id`, x.`payment_method_id`
  FROM `fayxzvov_reginas`.`shift_payment` x
  JOIN `fayxzvov_reginas`.`cash_shift` s ON s.`id` = x.`cash_shift_id`;

INSERT INTO `detail_turn_status`
  (`id`, `amount`, `created_at`, `updated_at`, `turn_id`, `sale_status_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(s.`closed_at`, s.`opened_at`, NOW()), COALESCE(s.`closed_at`, s.`opened_at`, NOW()),
       x.`cash_shift_id`, x.`status_process_id`
  FROM `fayxzvov_reginas`.`shift_status_process` x
  JOIN `fayxzvov_reginas`.`cash_shift` s ON s.`id` = x.`cash_shift_id`;

INSERT INTO `detail_daily_closure_payment`
  (`id`, `amount`, `created_at`, `updated_at`, `daily_closure_id`, `payment_method_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(d.`created_at`, d.`closure_date`, NOW()), COALESCE(d.`created_at`, d.`closure_date`, NOW()),
       x.`daily_closure_id`, x.`payment_method_id`
  FROM `fayxzvov_reginas`.`closure_payment` x
  JOIN `fayxzvov_reginas`.`daily_closure` d ON d.`id` = x.`daily_closure_id`;

INSERT INTO `detail_daily_closure_status`
  (`id`, `amount`, `created_at`, `updated_at`, `daily_closure_id`, `sale_status_id`)
SELECT x.`id`, COALESCE(x.`amount`, 0),
       COALESCE(d.`created_at`, d.`closure_date`, NOW()), COALESCE(d.`created_at`, d.`closure_date`, NOW()),
       x.`daily_closure_id`, x.`status_process_id`
  FROM `fayxzvov_reginas`.`closure_status_proccess` x
  JOIN `fayxzvov_reginas`.`daily_closure` d ON d.`id` = x.`daily_closure_id`;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS `_guard`;

-- ---------------------------------------------------------------------
-- PASO 5: COMPROBACION (origen y destino deben coincidir)
-- ---------------------------------------------------------------------

SELECT 'sale'         AS tabla, (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order`)           AS origen, (SELECT COUNT(*) FROM `sale`)                         AS destino
UNION ALL SELECT 'detail_sale',  (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_package`),         (SELECT COUNT(*) FROM `detail_sale`)
UNION ALL SELECT 'payment',      (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_payments`),        (SELECT COUNT(*) FROM `payment`)
UNION ALL SELECT 'product',      (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_products`)
                               + (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_custom`),          (SELECT COUNT(*) FROM `product`)
UNION ALL SELECT 'customer',     (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_clients`),         (SELECT COUNT(*) FROM `customer`)
UNION ALL SELECT 'turn',         (SELECT COUNT(*) FROM `fayxzvov_reginas`.`cash_shift`),            (SELECT COUNT(*) FROM `turn`)
UNION ALL SELECT 'daily_closure',(SELECT COUNT(*) FROM `fayxzvov_reginas`.`daily_closure`),         (SELECT COUNT(*) FROM `daily_closure`)
UNION ALL SELECT 'history_log',  (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_histories`),       (SELECT COUNT(*) FROM `history_log`)
UNION ALL SELECT 'sale_image',   (SELECT COUNT(*) FROM `fayxzvov_reginas`.`order_images`),          (SELECT COUNT(*) FROM `sale_image`)
UNION ALL SELECT '$ ventas netas',
          (SELECT ROUND(SUM(COALESCE(`total_pay`, 0) - COALESCE(`discount`, 0)), 2) FROM `fayxzvov_reginas`.`order`),
          (SELECT ROUND(SUM(`total`), 2) FROM `sale`)
UNION ALL SELECT '$ pagos',
          (SELECT ROUND(SUM(COALESCE(`pay`, 0)), 2) FROM `fayxzvov_reginas`.`order_payments`),
          (SELECT ROUND(SUM(`amount`), 2) FROM `payment`);

-- Cuando todo cuadre, los mapas ya no hacen falta:
-- DROP TABLE `_map_branch`, `_map_user`;
