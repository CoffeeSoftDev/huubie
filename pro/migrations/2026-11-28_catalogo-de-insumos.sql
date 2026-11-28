-- =============================================================================
-- Propuesta B: «Catálogo de venta» y «Catálogo de insumos»
-- Fecha:     28/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app) y fayxzvov_inventarios
-- Requiere:  2026-11-22_crear-fayxzvov-inventarios.sql (la base del modulo)
--            2026-11-23_inventarios-paginas.sql (la ruta de inv-catalogo)
-- Rollback:  2026-11-28_catalogo-de-insumos-rollback.sql
--
-- 1) Los dos catálogos se llaman por lo que tienen. El menú no se mueve:
--      catalogo      (Punto de venta)  Catálogo -> Catálogo de venta
--      inv-catalogo  (Inventarios)     Catálogo -> Catálogo de insumos
-- 2) Grupos de insumos (Harinas, Lácteos, Empaques): tabla de la empresa,
--    aparte de las categorías de venta, como los «Grupos de insumos» de Soft.
-- 3) product_inventory guarda también el grupo del insumo y su proveedor
--    habitual (la ficha del insumo).
--
-- Orden en prod: ANTES del código (los ctrl leen las columnas nuevas).
-- Los UPDATE van por code: se pueden volver a correr. El CREATE y el ALTER no.
-- =============================================================================

SET NAMES utf8mb4;

-- 1) Nombres del menú.
UPDATE sections SET name = 'Catálogo de venta'   WHERE code = 'catalogo';
UPDATE sections SET name = 'Catálogo de insumos' WHERE code = 'inv-catalogo';

-- 2) Grupos de insumos.
CREATE TABLE fayxzvov_inventarios.supply_group (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(120) NOT NULL COMMENT 'Harinas, Lácteos, Empaques',
  `description`  VARCHAR(255) NULL DEFAULT NULL,
  `color_hex`    VARCHAR(9) NULL DEFAULT NULL,
  `sort_order`   INT NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`   INT NOT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `supply_group_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Grupos de insumos de la empresa (no son las categorias de venta)';

-- 3) Grupo y proveedor habitual del insumo.
ALTER TABLE fayxzvov_inventarios.product_inventory
  ADD COLUMN `supply_group_id` INT NULL DEFAULT NULL COMMENT 'grupo del insumo' AFTER `warehouse_area_id`,
  ADD COLUMN `supplier_id`     INT NULL DEFAULT NULL COMMENT 'proveedor habitual' AFTER `supply_group_id`,
  ADD KEY `supply_group_id` (`supply_group_id`),
  ADD KEY `supplier_id` (`supplier_id`),
  ADD CONSTRAINT `product_inventory_ibfk_4` FOREIGN KEY (`supply_group_id`)
    REFERENCES `fayxzvov_inventarios`.`supply_group` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `product_inventory_ibfk_5` FOREIGN KEY (`supplier_id`)
    REFERENCES `fayxzvov_inventarios`.`supplier` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Comprobación: los dos nombres y las columnas nuevas.
SELECT code, name, route FROM sections WHERE code IN ('catalogo', 'inv-catalogo');

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_inventarios'
  AND TABLE_NAME = 'product_inventory'
  AND COLUMN_NAME IN ('supply_group_id', 'supplier_id');
