-- =====================================================================
-- Deshace 2026-11-13_foto-cortes-alpha.sql
-- Fecha:  13/11/2026
-- Vuelve a poner los totales de alpha (se leen de fayxzvov_reginas) y
-- reactiva los renglones de alpha que la migración apagó.
-- Turnos tocados = los que llevan la nota «Pasado de alpha».
-- Días tocados   = cierres vigentes de alpha con turnos ese día (misma regla).
-- =====================================================================

SET NAMES utf8mb4;
USE `fayxzvov_pos`;

DROP TEMPORARY TABLE IF EXISTS `_foto_turno`;
CREATE TEMPORARY TABLE `_foto_turno` (PRIMARY KEY (`id`)) AS
SELECT t.`id`
  FROM `turn` t
 WHERE t.`reopen_reason` LIKE '%Pasado de alpha:%'
   AND t.`id` IN (SELECT `id` FROM `fayxzvov_reginas`.`cash_shift`);

DROP TEMPORARY TABLE IF EXISTS `_foto_dia`;
CREATE TEMPORARY TABLE `_foto_dia` (PRIMARY KEY (`id`)) AS
SELECT d.`id`
  FROM `daily_closure` d
 WHERE d.`reopened_at` IS NULL
   AND IFNULL(d.`active`, 1) = 1
   AND d.`id` IN (SELECT `id` FROM `fayxzvov_reginas`.`daily_closure`)
   AND EXISTS (SELECT 1 FROM `turn` t
                WHERE t.`branch_id` = d.`branch_id`
                  AND IFNULL(t.`opened_at`, t.`created_at`) >= DATE(d.`closure_date`)
                  AND IFNULL(t.`opened_at`, t.`created_at`) <  DATE(d.`closure_date`) + INTERVAL 1 DAY
                  AND IFNULL(t.`active`, 1) = 1);

START TRANSACTION;

-- -- Ligas --

UPDATE `sale` s
  JOIN `_foto_dia` f ON f.`id` = s.`daily_closure_id`
  JOIN `fayxzvov_reginas`.`order` o ON o.`id` = s.`id`
   SET s.`daily_closure_id` = o.`daily_closure_id`;

UPDATE `turn` t
  JOIN `_foto_dia` f ON f.`id` = t.`daily_closure_id`
  JOIN `fayxzvov_reginas`.`cash_shift` c ON c.`id` = t.`id`
   SET t.`daily_closure_id` = c.`daily_closure_id`;

-- -- Días --

DELETE x FROM `daily_closure_payment` x JOIN `_foto_dia` f ON f.`id` = x.`daily_closure_id` WHERE x.`active` = 1;
UPDATE `daily_closure_payment` x JOIN `_foto_dia` f ON f.`id` = x.`daily_closure_id` SET x.`active` = 1 WHERE x.`active` = 0;

DELETE x FROM `daily_closure_status` x JOIN `_foto_dia` f ON f.`id` = x.`daily_closure_id` WHERE x.`active` = 1;
UPDATE `daily_closure_status` x JOIN `_foto_dia` f ON f.`id` = x.`daily_closure_id` SET x.`active` = 1 WHERE x.`active` = 0;

UPDATE `daily_closure` d
  JOIN `_foto_dia` f ON f.`id` = d.`id`
  JOIN `fayxzvov_reginas`.`daily_closure` a ON a.`id` = d.`id`
   SET d.`note`            = NULL,
       d.`subtotal`        = COALESCE(a.`subtotal`, 0),
       d.`discount`        = COALESCE(a.`total_discount`, 0),
       d.`tip`             = 0,
       d.`total`           = COALESCE(a.`total`, 0),
       d.`orders_count`    = COALESCE(a.`total_orders`, 0),
       d.`sales_count`     = 0,
       d.`cancelled_count` = 0,
       d.`first_folio`     = NULL,
       d.`last_folio`      = NULL,
       d.`turns_count`     = (SELECT COUNT(*) FROM `fayxzvov_reginas`.`cash_shift` c WHERE c.`daily_closure_id` = a.`id`),
       d.`total_shifts`    = COALESCE(a.`total_shifts`, 0),
       d.`total_cash`      = COALESCE(a.`total_cash`, 0);

-- -- Turnos --

DELETE x FROM `turn_payment` x JOIN `_foto_turno` f ON f.`id` = x.`turn_id` WHERE x.`active` = 1;
UPDATE `turn_payment` x JOIN `_foto_turno` f ON f.`id` = x.`turn_id` SET x.`active` = 1 WHERE x.`active` = 0;

DELETE x FROM `turn_status` x JOIN `_foto_turno` f ON f.`id` = x.`turn_id` WHERE x.`active` = 1;
UPDATE `turn_status` x JOIN `_foto_turno` f ON f.`id` = x.`turn_id` SET x.`active` = 1 WHERE x.`active` = 0;

UPDATE `turn` t
  JOIN `_foto_turno` f ON f.`id` = t.`id`
  JOIN `fayxzvov_reginas`.`cash_shift` c ON c.`id` = t.`id`
   SET t.`reopen_reason`    = NULL,
       t.`total_sales`      = COALESCE(c.`total_sales`, 0),
       t.`orders_count`     = COALESCE(c.`total_orders`, 0),
       t.`sales_count`      = 0,
       t.`expected_cash`    = 0,
       t.`counted_cash`     = 0,
       t.`daily_closure_id` = c.`daily_closure_id`;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS `_foto_dia`;
DROP TEMPORARY TABLE IF EXISTS `_foto_turno`;
