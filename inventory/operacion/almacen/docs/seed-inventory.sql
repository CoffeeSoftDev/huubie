-- =====================================================================
-- SIEMBRA INICIAL — Módulo Inventory (insumos)
-- Mapea udn -> companies, crea matriz, migra usuarios -> users,
-- y siembra catálogos base. Idempotencia: pensado para 1ª ejecución.
-- =====================================================================
SET NAMES utf8mb4;

-- ── 1) companies desde udn ──
USE `fayxzvov_erp`;
INSERT INTO `companies` (`name`, `active`, `udn_id`)
SELECT `UDN`, 1, `idUDN`
FROM `udn`
WHERE `Stado` = 1
  AND `idUDN` NOT IN (SELECT `udn_id` FROM `companies` WHERE `udn_id` IS NOT NULL);

-- ── 2) subsidiaries (matriz) por company ──
INSERT INTO `subsidiaries` (`name`, `is_main`, `active`, `companies_id`)
SELECT CONCAT(c.`name`, ' Matriz'), 1, 1, c.`id`
FROM `companies` c
WHERE NOT EXISTS (SELECT 1 FROM `subsidiaries` s WHERE s.`companies_id` = c.`id`);

-- ── 3) usuarios -> users (migración con puente) ──
INSERT INTO `users` (`fullname`, `username`, `password`, `photo`, `login_attempts`,
                     `active`, `role_id`, `companies_id`, `subsidiaries_id`, `legacy_user_id`)
SELECT u.`usser`, u.`usser`, u.`keey`, NULL, 0, 1,
       u.`usr_perfil`, c.`id`,
       (SELECT s.`id` FROM `subsidiaries` s WHERE s.`companies_id` = c.`id` AND s.`is_main` = 1 LIMIT 1),
       u.`idUser`
FROM `usuarios` u
JOIN `companies` c ON c.`udn_id` = u.`usr_udn`
WHERE u.`usr_estado` = 1
  AND u.`idUser` NOT IN (SELECT `legacy_user_id` FROM `users` WHERE `legacy_user_id` IS NOT NULL);

-- ── 4) catálogos GLOBALES ──
USE `fayxzvov_inventory`;
INSERT INTO `inflow_origin` (`code`, `name`, `requires_supplier`, `active`) VALUES
('COMPRA',        'Compra',        1, 1),
('PRODUCCION',    'Producción',    0, 1),
('TRANSFERENCIA', 'Transferencia', 0, 1),
('DEVOLUCION',    'Devolución',    0, 1),
('AJUSTE',        'Ajuste',        0, 1);

INSERT INTO `shrinkage_reason` (`code`, `name`, `active`) VALUES
('MERMA',     'Merma',     1),
('CADUCIDAD', 'Caducidad', 1),
('CONSUMO',   'Consumo',   1),
('FALTANTE',  'Faltante',  1);

-- ── 5) unit por empresa ──
INSERT INTO `unit` (`code`, `name`, `active`, `companies_id`)
SELECT v.`code`, v.`name`, 1, c.`id`
FROM (
  SELECT 'PZA' AS `code`, 'Pieza'     AS `name`
  UNION ALL SELECT 'KG', 'Kilogramo'
  UNION ALL SELECT 'LT', 'Litro'
  UNION ALL SELECT 'GR', 'Gramo'
  UNION ALL SELECT 'ML', 'Mililitro'
) v
CROSS JOIN `fayxzvov_erp`.`companies` c;

-- ── 6) warehouse_area por empresa ──
INSERT INTO `warehouse_area` (`name`, `color_hex`, `active`, `companies_id`)
SELECT v.`name`, v.`color`, 1, c.`id`
FROM (
  SELECT 'Seco'        AS `name`, '#9CA3AF' AS `color`
  UNION ALL SELECT 'Refrigerado', '#3B82F6'
  UNION ALL SELECT 'Congelado',   '#06B6D4'
) v
CROSS JOIN `fayxzvov_erp`.`companies` c;

-- ── 7) item_category por empresa ──
INSERT INTO `item_category` (`name`, `active`, `companies_id`)
SELECT v.`name`, 1, c.`id`
FROM (
  SELECT 'Granos y café' AS `name`
  UNION ALL SELECT 'Lácteos'
  UNION ALL SELECT 'Endulzantes'
  UNION ALL SELECT 'Desechables'
  UNION ALL SELECT 'Otros'
) v
CROSS JOIN `fayxzvov_erp`.`companies` c;

-- ── 8) warehouse default por sucursal (branch) ──
INSERT INTO `warehouse` (`name`, `is_default`, `active`, `branch_id`, `companies_id`)
SELECT 'Almacén General', 1, 1, b.`id`, b.`company_id`
FROM `fayxzvov_erp`.`branches` b
WHERE NOT EXISTS (
  SELECT 1 FROM `warehouse` w WHERE w.`branch_id` = b.`id` AND w.`is_default` = 1
);
