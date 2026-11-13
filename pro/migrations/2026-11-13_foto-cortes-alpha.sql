-- =====================================================================
-- Rehace la foto de los turnos y días que vienen de alpha con la regla de PRO
-- Fecha:  13/11/2026
-- Antes:  2026-11-06_migrar-reginas-a-pos.sql (corre justo después)
-- Deshacer: 2026-11-13_foto-cortes-alpha-rollback.sql
--           fayxzvov_reginas NO se modifica: solo se lee.
--
-- POR QUE
--   La carga copió los totales de alpha tal cual y no cuadran con PRO:
--   - cash_shift.total_sales sumaba cotizaciones y no restaba descuentos.
--   - shift_status_process.amount guardaba CUANTOS pedidos, no el importe.
--   - alpha no guardaba esperado ni contado: quedaron en $0.
--   Resultado en local (13/11/2026): 96 turnos y 65 días marcados como
--   «cambió después de su corte» sin que nadie los tocara.
--
-- QUE HACE (lo mismo que closeTurn y closeDay de PRO)
--   Turnos cerrados en alpha (close_user_id NULL):
--     total_sales  = pendientes + pagados (estados 2 y 3)
--     orders_count = pedidos (tipo 1), sales_count = ventas (tipo <> 1)
--     expected_cash = fondo + pagos en efectivo del turno
--     counted_cash  = expected_cash (alpha no contaba la caja: diferencia $0,
--                     igual que se veía antes)
--     turn_payment / turn_status: apaga los renglones de alpha y escribe
--     los de PRO (importe por método y por estado).
--     reopen_reason: deja la nota «Pasado de alpha» (se ve en el modal).
--   Días vigentes de alpha que tienen turnos:
--     totales, conteos, folios, efectivo y renglones por método y estado
--     con la regla del día de PRO; liga turnos y ventas al cierre.
--     note: «Pasado de alpha: vendido $X » $Y.» solo si el total cambió.
--
-- NO TOCA
--   Cierres reabiertos (historia de alpha), cierres sin turnos (2 en local,
--   con closure_date NULL), turnos abiertos y lo cerrado desde PRO.
-- =====================================================================

SET NAMES utf8mb4;
USE `fayxzvov_pos`;

-- -- Guardia: corre una sola vez --

DROP TEMPORARY TABLE IF EXISTS `_guard`;
CREATE TEMPORARY TABLE `_guard` (
  `msg` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`msg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `_guard` (`msg`)
SELECT 'ALTO: las fotos de alpha ya se rehicieron'
  FROM (SELECT 1 AS n UNION ALL SELECT 2) d
 WHERE EXISTS (SELECT 1 FROM `turn` WHERE `reopen_reason` LIKE '%Pasado de alpha:%');

START TRANSACTION;

-- -- Turnos --

DROP TEMPORARY TABLE IF EXISTS `_foto_turno`;
CREATE TEMPORARY TABLE `_foto_turno` (PRIMARY KEY (`id`)) AS
SELECT t.`id`,
       t.`total_sales`                                  AS `before_sales`,
       ROUND(IFNULL(v.`total_sales`, 0), 2)             AS `total_sales`,
       IFNULL(v.`orders_count`, 0)                      AS `orders_count`,
       IFNULL(v.`sales_count`, 0)                       AS `sales_count`,
       ROUND(t.`opening_cash` + IFNULL(c.`cash`, 0), 2) AS `expected_cash`
  FROM `turn` t
  LEFT JOIN (
        SELECT s.`turn_id`,
               SUM(IF(s.`sale_status_id` IN (2, 3), s.`total`, 0))                         AS `total_sales`,
               SUM(IF(s.`sale_status_id` IN (2, 3) AND s.`sale_type_id` = 1, 1, 0))  AS `orders_count`,
               SUM(IF(s.`sale_status_id` IN (2, 3) AND s.`sale_type_id` <> 1, 1, 0)) AS `sales_count`
          FROM `sale` s
         WHERE IFNULL(s.`active`, 1) = 1
         GROUP BY s.`turn_id`
       ) v ON v.`turn_id` = t.`id`
  LEFT JOIN (
        SELECT p.`turn_id`, SUM(p.`amount`) AS `cash`
          FROM `payment` p
          JOIN `payment_method` pm ON pm.`id` = p.`payment_method_id` AND pm.`is_cash` = 1
         WHERE IFNULL(p.`active`, 1) = 1
           AND p.`deleted_at` IS NULL
         GROUP BY p.`turn_id`
       ) c ON c.`turn_id` = t.`id`
 WHERE t.`status` = 'closed'
   AND t.`close_user_id` IS NULL
   AND t.`reopen_reason` IS NULL
   AND t.`id` IN (SELECT `id` FROM `fayxzvov_reginas`.`cash_shift`);

UPDATE `turn` t
  JOIN `_foto_turno` f ON f.`id` = t.`id`
   SET t.`reopen_reason` = CONCAT(
           DATE_FORMAT(NOW(), '%d/%m/%Y'), ' · Pasado de alpha: sin conteo de caja (contado = esperado)',
           IF(ABS(f.`total_sales` - f.`before_sales`) >= 0.005,
              CONCAT(' · vendido $', FORMAT(f.`before_sales`, 2), ' » $', FORMAT(f.`total_sales`, 2)),
              '')),
       t.`total_sales`   = f.`total_sales`,
       t.`orders_count`  = f.`orders_count`,
       t.`sales_count`   = f.`sales_count`,
       t.`expected_cash` = f.`expected_cash`,
       t.`counted_cash`  = f.`expected_cash`;

UPDATE `turn_payment` x
  JOIN `_foto_turno` f ON f.`id` = x.`turn_id`
   SET x.`active` = 0, x.`updated_at` = NOW()
 WHERE x.`active` = 1;

UPDATE `turn_status` x
  JOIN `_foto_turno` f ON f.`id` = x.`turn_id`
   SET x.`active` = 0, x.`updated_at` = NOW()
 WHERE x.`active` = 1;

INSERT INTO `turn_payment` (`turn_id`, `payment_method_id`, `amount`, `created_at`, `updated_at`, `active`)
SELECT p.`turn_id`, pm.`id`, ROUND(SUM(p.`amount`), 2), NOW(), NOW(), 1
  FROM `payment` p
  JOIN `_foto_turno` f ON f.`id` = p.`turn_id`
  LEFT JOIN `payment_method` pm ON pm.`id` = p.`payment_method_id`
 WHERE IFNULL(p.`active`, 1) = 1
   AND p.`deleted_at` IS NULL
 GROUP BY p.`turn_id`, pm.`id`;

INSERT INTO `turn_status` (`turn_id`, `sale_status_id`, `amount`, `created_at`, `updated_at`, `active`)
SELECT s.`turn_id`, s.`sale_status_id`, ROUND(SUM(s.`total`), 2), NOW(), NOW(), 1
  FROM `sale` s
  JOIN `_foto_turno` f ON f.`id` = s.`turn_id`
 WHERE IFNULL(s.`active`, 1) = 1
 GROUP BY s.`turn_id`, s.`sale_status_id`;

-- -- Días --
-- Los turnos de un día son los que abrieron esa fecha en esa sucursal (como en PRO).

DROP TEMPORARY TABLE IF EXISTS `_foto_dia_turno`;
CREATE TEMPORARY TABLE `_foto_dia_turno` (PRIMARY KEY (`turn_id`), KEY (`closure_id`)) AS
SELECT t.`id` AS `turn_id`, d.`id` AS `closure_id`
  FROM `daily_closure` d
  JOIN `turn` t ON t.`branch_id` = d.`branch_id`
   AND IFNULL(t.`opened_at`, t.`created_at`) >= DATE(d.`closure_date`)
   AND IFNULL(t.`opened_at`, t.`created_at`) <  DATE(d.`closure_date`) + INTERVAL 1 DAY
   AND IFNULL(t.`active`, 1) = 1
 WHERE d.`reopened_at` IS NULL
   AND IFNULL(d.`active`, 1) = 1
   AND d.`id` IN (SELECT `id` FROM `fayxzvov_reginas`.`daily_closure`);

DROP TEMPORARY TABLE IF EXISTS `_foto_dia`;
CREATE TEMPORARY TABLE `_foto_dia` (PRIMARY KEY (`id`)) AS
SELECT m.`closure_id`                                                                     AS `id`,
       MAX(d.`total`)                                                                     AS `before_total`,
       COUNT(DISTINCT m.`turn_id`)                                                        AS `turns`,
       IFNULL(SUM(IF(s.`sale_status_id` IN (2, 3), s.`subtotal`, 0)), 0)                  AS `subtotal`,
       IFNULL(SUM(IF(s.`sale_status_id` IN (2, 3), s.`discount_amount`, 0)), 0)           AS `discount`,
       IFNULL(SUM(IF(s.`sale_status_id` IN (2, 3), s.`tip_amount`, 0)), 0)                AS `tip`,
       IFNULL(SUM(IF(s.`sale_status_id` IN (2, 3), s.`total`, 0)), 0)                     AS `total`,
       IFNULL(SUM(IF(s.`sale_status_id` IN (2, 3) AND s.`sale_type_id` = 1, 1, 0)), 0)   AS `orders_count`,
       IFNULL(SUM(IF(s.`sale_status_id` IN (2, 3) AND s.`sale_type_id` <> 1, 1, 0)), 0)  AS `sales_count`,
       IFNULL(SUM(IF(s.`sale_status_id` = 4, 1, 0)), 0)                                   AS `cancelled_count`,
       MIN(IF(s.`sale_status_id` <> 1, s.`id`, NULL))                                     AS `first_id`,
       MAX(IF(s.`sale_status_id` <> 1, s.`id`, NULL))                                     AS `last_id`,
       CAST(0 AS DECIMAL(14, 2))                                                          AS `cash`
  FROM `_foto_dia_turno` m
  JOIN `daily_closure` d ON d.`id` = m.`closure_id`
  LEFT JOIN `sale` s ON s.`turn_id` = m.`turn_id` AND IFNULL(s.`active`, 1) = 1
 GROUP BY m.`closure_id`;

UPDATE `_foto_dia` f
  JOIN (
        SELECT m.`closure_id`, SUM(p.`amount`) AS `cash`
          FROM `payment` p
          JOIN `_foto_dia_turno` m ON m.`turn_id` = p.`turn_id`
          JOIN `payment_method` pm ON pm.`id` = p.`payment_method_id` AND pm.`is_cash` = 1
         WHERE IFNULL(p.`active`, 1) = 1
           AND p.`deleted_at` IS NULL
         GROUP BY m.`closure_id`
       ) c ON c.`closure_id` = f.`id`
   SET f.`cash` = ROUND(c.`cash`, 2);

UPDATE `daily_closure` d
  JOIN `_foto_dia` f ON f.`id` = d.`id`
   SET d.`note` = IF(ABS(f.`total` - f.`before_total`) >= 0.005,
           CONCAT('Pasado de alpha: vendido $', FORMAT(f.`before_total`, 2), ' » $', FORMAT(f.`total`, 2), '.'),
           d.`note`),
       d.`subtotal`        = ROUND(f.`subtotal`, 2),
       d.`discount`        = ROUND(f.`discount`, 2),
       d.`tip`             = ROUND(f.`tip`, 2),
       d.`total`           = ROUND(f.`total`, 2),
       d.`orders_count`    = f.`orders_count`,
       d.`sales_count`     = f.`sales_count`,
       d.`cancelled_count` = f.`cancelled_count`,
       d.`first_folio`     = CAST(f.`first_id` AS CHAR),
       d.`last_folio`      = CAST(f.`last_id` AS CHAR),
       d.`turns_count`     = f.`turns`,
       d.`total_shifts`    = f.`turns`,
       d.`total_cash`      = f.`cash`;

UPDATE `daily_closure_payment` x
  JOIN `_foto_dia` f ON f.`id` = x.`daily_closure_id`
   SET x.`active` = 0, x.`updated_at` = NOW()
 WHERE x.`active` = 1;

UPDATE `daily_closure_status` x
  JOIN `_foto_dia` f ON f.`id` = x.`daily_closure_id`
   SET x.`active` = 0, x.`updated_at` = NOW()
 WHERE x.`active` = 1;

-- 'venta' = el pedido es de un turno de ese mismo día; 'abono' = de otro día.
INSERT INTO `daily_closure_payment`
  (`daily_closure_id`, `payment_method_id`, `source`, `payments_count`, `amount`, `tip`, `created_at`, `updated_at`, `active`)
SELECT m.`closure_id`, pm.`id`, IF(st.`id` IS NULL, 'abono', 'venta') AS `source`,
       COUNT(p.`id`), ROUND(SUM(p.`amount`), 2), 0, NOW(), NOW(), 1
  FROM `payment` p
  JOIN `_foto_dia_turno` m ON m.`turn_id` = p.`turn_id`
  JOIN `turn` t ON t.`id` = p.`turn_id`
  LEFT JOIN `payment_method` pm ON pm.`id` = p.`payment_method_id`
  LEFT JOIN `sale` s ON s.`id` = p.`sale_id`
  LEFT JOIN `turn` st ON st.`id` = s.`turn_id`
   AND st.`branch_id` = t.`branch_id`
   AND DATE(IFNULL(st.`opened_at`, st.`created_at`)) = DATE(IFNULL(t.`opened_at`, t.`created_at`))
 WHERE IFNULL(p.`active`, 1) = 1
   AND p.`deleted_at` IS NULL
 GROUP BY m.`closure_id`, pm.`id`, `source`;

INSERT INTO `daily_closure_status` (`daily_closure_id`, `sale_status_id`, `amount`, `created_at`, `updated_at`, `active`)
SELECT m.`closure_id`, s.`sale_status_id`, ROUND(SUM(s.`total`), 2), NOW(), NOW(), 1
  FROM `sale` s
  JOIN `_foto_dia_turno` m ON m.`turn_id` = s.`turn_id`
 WHERE IFNULL(s.`active`, 1) = 1
 GROUP BY m.`closure_id`, s.`sale_status_id`;

-- Ligas, como qLinkClosure: el turno y sus ventas (sin cotizaciones) al cierre del día.
UPDATE `turn` t
  JOIN `_foto_dia_turno` m ON m.`turn_id` = t.`id`
   SET t.`daily_closure_id` = m.`closure_id`;

UPDATE `sale` s
  JOIN `_foto_dia_turno` m ON m.`turn_id` = s.`turn_id`
   SET s.`daily_closure_id` = m.`closure_id`
 WHERE s.`sale_status_id` <> 1
   AND IFNULL(s.`active`, 1) = 1;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS `_foto_dia`;
DROP TEMPORARY TABLE IF EXISTS `_foto_dia_turno`;
DROP TEMPORARY TABLE IF EXISTS `_foto_turno`;
DROP TEMPORARY TABLE IF EXISTS `_guard`;

-- -- Comprobación: las dos columnas en 0 --

SELECT
  (SELECT COUNT(*)
     FROM `turn` t
    WHERE t.`status` = 'closed'
      AND t.`id` IN (SELECT `id` FROM `fayxzvov_reginas`.`cash_shift`)
      AND ABS(t.`total_sales` - (SELECT IFNULL(SUM(s.`total`), 0) FROM `sale` s
                                  WHERE s.`turn_id` = t.`id` AND s.`sale_status_id` IN (2, 3)
                                    AND IFNULL(s.`active`, 1) = 1)) >= 0.005) AS `turnos_que_no_cuadran`,
  (SELECT COUNT(*)
     FROM `daily_closure` d
    WHERE d.`reopened_at` IS NULL
      AND IFNULL(d.`active`, 1) = 1
      AND d.`id` IN (SELECT `id` FROM `fayxzvov_reginas`.`daily_closure`)
      AND EXISTS (SELECT 1 FROM `turn` t
                   WHERE t.`branch_id` = d.`branch_id`
                     AND IFNULL(t.`opened_at`, t.`created_at`) >= DATE(d.`closure_date`)
                     AND IFNULL(t.`opened_at`, t.`created_at`) <  DATE(d.`closure_date`) + INTERVAL 1 DAY)
      AND ABS(d.`total` - (SELECT IFNULL(SUM(s.`total`), 0) FROM `sale` s
                             JOIN `turn` t ON t.`id` = s.`turn_id`
                            WHERE t.`branch_id` = d.`branch_id`
                              AND IFNULL(t.`opened_at`, t.`created_at`) >= DATE(d.`closure_date`)
                              AND IFNULL(t.`opened_at`, t.`created_at`) <  DATE(d.`closure_date`) + INTERVAL 1 DAY
                              AND IFNULL(t.`active`, 1) = 1
                              AND s.`sale_status_id` IN (2, 3)
                              AND IFNULL(s.`active`, 1) = 1)) >= 0.005) AS `dias_que_no_cuadran`;
