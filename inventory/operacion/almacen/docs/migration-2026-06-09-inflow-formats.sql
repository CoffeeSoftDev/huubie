-- =====================================================================
-- MIGRACION (2026-06-09) — Formatos de entrada (plantillas reutilizables)
-- Modulo Inventory / Almacen · BD fayxzvov_inventory
-- MySQL 8.0 · InnoDB · latin1_swedish_ci
-- ---------------------------------------------------------------------
-- Reemplaza la persistencia en localStorage del componente entrada-form.js
-- ('huubie_entradaFormatos') por almacenamiento real en BD.
--
-- Un "formato" es una plantilla guardada de un lote de productos (que
-- productos y en que cantidad) para reutilizarla al registrar entradas.
-- NO es una transaccion que mueva stock, por eso NO usa el prefijo
-- `detail_`: la cabecera es `inflow_format` y los renglones
-- `inflow_format_item` (sub-detalle de plantilla, mismo criterio que los
-- sub-catalogos del modulo).
--
-- Visibilidad por `scope`:
--   user       -> solo el usuario que lo creo (user_id)
--   subsidiary -> toda la sucursal del creador (branch_id)
--   company    -> toda la empresa (companies_id)
-- =====================================================================
USE `fayxzvov_inventory`;

-- ── Cabecera del formato ──
CREATE TABLE IF NOT EXISTS `inflow_format` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(80) NOT NULL,
  `scope`        VARCHAR(20) NOT NULL DEFAULT 'user',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  `user_id`      INT NOT NULL,
  `branch_id`    INT NOT NULL,
  `companies_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inflow_format_user` (`user_id`),
  KEY `idx_inflow_format_branch` (`branch_id`),
  KEY `idx_inflow_format_company` (`companies_id`),
  CONSTRAINT `fk_inflow_format_user`    FOREIGN KEY (`user_id`)      REFERENCES `fayxzvov_erp`.`users` (`id`),
  CONSTRAINT `fk_inflow_format_branch`  FOREIGN KEY (`branch_id`)    REFERENCES `fayxzvov_erp`.`branches` (`id`),
  CONSTRAINT `fk_inflow_format_company` FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_erp`.`companies` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- ── Renglones del formato ──
CREATE TABLE IF NOT EXISTS `inflow_format_item` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `quantity`         DOUBLE NOT NULL DEFAULT 0,
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `active`           TINYINT NOT NULL DEFAULT 1,
  `item_id`          INT NOT NULL,
  `inflow_format_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inflow_format_item_item` (`item_id`),
  KEY `idx_inflow_format_item_header` (`inflow_format_id`),
  CONSTRAINT `fk_inflow_format_item_item`   FOREIGN KEY (`item_id`)          REFERENCES `item` (`id`),
  CONSTRAINT `fk_inflow_format_item_header` FOREIGN KEY (`inflow_format_id`) REFERENCES `inflow_format` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
