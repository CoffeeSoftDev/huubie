-- =====================================================================
-- Crea fayxzvov_inventarios: Inventarios de Huubie PRO (29 tablas + 1 vista)
-- Fecha:    22/11/2026 · rev 23/11/2026: lo que se inventaria son los productos
--           del Catalogo (fayxzvov_pos.product); se quitaron item e item_category.
--           rev 24/11/2026: traspaso con receive_note y moved_at; la vista dice a
--           que almacen va o de cual viene.
-- Pantallas: pro/app/inventarios (stock.php, entradas.php, salidas.php,
--           traspasos.php, kardex.php)
-- Origen:   app/inventarios (generacion alpha, BD fayxzvov_reginas, modo FAKE)
--           + inventory/operacion/almacen (ERP, BD fayxzvov_inventory)
-- Reglas:   ~/.claude/steering/grimorios/db-rules.md
-- Rollback: 2026-11-22_crear-fayxzvov-inventarios-rollback.sql
--
-- MAESTROS (cross-schema, la BD de pro):
--   company_id  -> fayxzvov_app.companies(id)
--   branch_id   -> fayxzvov_app.branches(id)   (tambien origin_/destination_/source_branch_id)
--   *user_id    -> fayxzvov_app.users(id)
-- CATALOGO Y VENTAS DEL POS (cross-schema):
--   *product_id                -> fayxzvov_pos.product(id)  lo que se inventaria: el
--                                 producto del Catalogo con is_inventoriable = 1
--                                 (venta: kind product; insumo: kind supply)
--   inventory_outflow.sale_id  -> fayxzvov_pos.sale(id)     salida por venta
--   fayxzvov_pos.product.unit_id apunta a unit(id) de esta base, sin FK (otra base).
--
-- POLITICA DE FKs (la misma de fayxzvov_pos):
--   detalle -> su raiz ...................... CASCADE
--   -> catalogo opcional / usuario .......... SET NULL
--   -> empresa, sucursal, almacen, producto . RESTRICT (columna NOT NULL; nunca
--      se borra fisico: se marca active = 0)
--   ON UPDATE siempre CASCADE.
--
-- DECISIONES QUE VIENEN DEL ERP (inventory/), YA TOMADAS POR EL USUARIO:
--   - Merma NO es tipo de movimiento: es un motivo de Salida (06/10/2026).
--   - Traspaso en 2 pasos: el origen lo crea (Solicitado, no mueve stock) y el
--     destino lo confirma (descuenta origen y suma destino a la vez). Sin
--     "En transito" (11/06/2026).
--   - Requisicion = pedido interno de material a la Matriz (warehouse.is_main);
--     aprobar = surtir; el surtido genera salida S- y entrada ENT- con "Recibi".
--   - Conteo fisico: Borrador -> Aplicado | Cancelado (cancelar dentro de 48 h).
--   - Folio por sucursal: ENT-KAF-0001 (folio_series).
--   - Catalogos con plantilla: company_id NULL = plantilla de Huubie; al activar
--     el modulo se copian a la empresa.
-- LO QUE APORTA LA GENERACION ALPHA (app/inventarios), PENSADO PARA PASTELERIA:
--   - Producto terminado (pasteles, postres) e insumo en el mismo Catalogo de pro.
--   - Vida util y lotes con caducidad (stock_lot): alerta "por caducar".
--   - Entrada tipo Produccion (nace Pendiente y se confirma) y formatos del dia.
--   - Venta del POS descuenta existencia (inventory_outflow.sale_id).
--
-- MySQL local 5.7.36 trae latin1 por omision: por eso el SET NAMES y el
-- CHARSET explicito en la base y en cada tabla (la vista guarda la collation
-- de la conexion).
-- =====================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_general_ci;

CREATE DATABASE IF NOT EXISTS `fayxzvov_inventarios`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE `fayxzvov_inventarios`;

-- =====================================================================
-- 1. CATALOGOS
-- =====================================================================

CREATE TABLE `unit` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `code`             VARCHAR(20) NOT NULL COMMENT 'PZA, KG, LT, CAJA',
  `name`             VARCHAR(80) NOT NULL,
  `allows_decimals`  TINYINT NOT NULL DEFAULT 0 COMMENT '1 = kilo, litro, gramo: la cantidad acepta decimales',
  `sort_order`       INT NOT NULL DEFAULT 0,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`       INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`           TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `unit_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: unidades de medida';

CREATE TABLE `warehouse` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `name`                VARCHAR(120) NOT NULL,
  `is_main`             TINYINT NOT NULL DEFAULT 0 COMMENT 'almacen principal de la empresa (Matriz): ahi se piden las requisiciones; uno por empresa',
  `is_default`          TINYINT NOT NULL DEFAULT 0 COMMENT 'el de la sucursal cuando no se elige; uno por sucursal',
  `supply_moves_stock`  TINYINT NOT NULL DEFAULT 1 COMMENT 'surtir requisiciones de otra sucursal mueve inventario',
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`          INT NOT NULL,
  `branch_id`           INT NOT NULL,
  `active`              TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `warehouse_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `warehouse_ibfk_2` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: almacenes de cada sucursal';

CREATE TABLE `warehouse_area` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(120) NOT NULL COMMENT 'Refrigerador, Congelador, Anaquel 1',
  `description`   VARCHAR(255) NULL DEFAULT NULL,
  `color_hex`     VARCHAR(9) NULL DEFAULT NULL,
  `sort_order`    INT NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `warehouse_id`  INT NOT NULL,
  `active`        TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `warehouse_area_ibfk_1` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Sub-catalogo: lugar dentro del almacen (categoria = que es; area = donde esta)';

CREATE TABLE `supplier` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(160) NOT NULL,
  `contact_name`  VARCHAR(120) NULL DEFAULT NULL,
  `phone`         VARCHAR(20) NULL DEFAULT NULL COMMENT 'solo digitos, 10',
  `email`         VARCHAR(120) NULL DEFAULT NULL,
  `rfc`           VARCHAR(13) NULL DEFAULT NULL,
  `note`          VARCHAR(255) NULL DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`    INT NOT NULL,
  `branch_id`     INT NULL DEFAULT NULL COMMENT 'NULL = de toda la empresa',
  `active`        TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `supplier_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supplier_ibfk_2` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: proveedores';

CREATE TABLE `department` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(80) NOT NULL COMMENT 'Pasteleria, Panaderia, Batidos, Limpieza',
  `icon`        VARCHAR(40) NULL DEFAULT NULL,
  `color_hex`   VARCHAR(9) NULL DEFAULT NULL,
  `sort_order`  INT NOT NULL DEFAULT 0,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`  INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `department_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: departamento que consume (salidas) o pide (requisiciones)';

CREATE TABLE `inflow_origin` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `code`               VARCHAR(30) NOT NULL,
  `name`               VARCHAR(120) NOT NULL COMMENT 'en pantalla: Tipo de entrada',
  `description`        VARCHAR(255) NULL DEFAULT NULL,
  `icon`               VARCHAR(40) NULL DEFAULT NULL,
  `color_hex`          VARCHAR(9) NULL DEFAULT NULL,
  `requires_supplier`  TINYINT NOT NULL DEFAULT 0,
  `updates_cost`       TINYINT NOT NULL DEFAULT 1 COMMENT 'el costo de la entrada pasa a ultimo costo del producto (fayxzvov_pos.product.cost)',
  `starts_pending`     TINYINT NOT NULL DEFAULT 0 COMMENT 'nace Pendiente y suma stock al confirmarse (Produccion)',
  `is_system`          TINYINT NOT NULL DEFAULT 0 COMMENT 'lo usa el sistema (surtido); no sale al capturar',
  `sort_order`         INT NOT NULL DEFAULT 0,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`         INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `inflow_origin_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: tipos de entrada (Compra, Produccion, Devolucion)';

CREATE TABLE `outflow_reason` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `code`                 VARCHAR(30) NOT NULL,
  `name`                 VARCHAR(120) NOT NULL,
  `description`          VARCHAR(255) NULL DEFAULT NULL,
  `icon`                 VARCHAR(40) NULL DEFAULT NULL,
  `color_hex`            VARCHAR(9) NULL DEFAULT NULL,
  `is_loss`              TINYINT NOT NULL DEFAULT 0 COMMENT '1 = merma: sale en el reporte de mermas',
  `requires_evidence`    TINYINT NOT NULL DEFAULT 0 COMMENT 'pide foto',
  `requires_department`  TINYINT NOT NULL DEFAULT 0,
  `is_system`            TINYINT NOT NULL DEFAULT 0 COMMENT 'lo usa el sistema (venta, surtido); no sale al capturar',
  `sort_order`           INT NOT NULL DEFAULT 0,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`           INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`               TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `outflow_reason_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: motivos de salida (Consumo, Merma, Caducidad, Venta)';

CREATE TABLE `adjustment_reason` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `code`          VARCHAR(30) NOT NULL,
  `name`          VARCHAR(120) NOT NULL,
  `icon`          VARCHAR(40) NULL DEFAULT NULL,
  `color_hex`     VARCHAR(9) NULL DEFAULT NULL,
  `affects_cost`  TINYINT NOT NULL DEFAULT 1 COMMENT 'la diferencia cuenta como dinero perdido o ganado',
  `is_system`     TINYINT NOT NULL DEFAULT 0,
  `sort_order`    INT NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`    INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`        TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `adjustment_reason_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: motivos de ajuste (Conteo fisico, Faltante, Sobrante)';

CREATE TABLE `transfer_status` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(30) NOT NULL COMMENT 'REQUESTED, RECEIVED, REJECTED, CANCELLED',
  `name`         VARCHAR(80) NOT NULL,
  `name_out`     VARCHAR(50) NULL DEFAULT NULL COMMENT 'como lo ve quien envia',
  `name_in`      VARCHAR(50) NULL DEFAULT NULL COMMENT 'como lo ve quien recibe',
  `order_index`  INT NOT NULL DEFAULT 0,
  `is_terminal`  TINYINT NOT NULL DEFAULT 0,
  `icon`         VARCHAR(40) NULL DEFAULT NULL,
  `color_hex`    VARCHAR(9) NULL DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`   INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `transfer_status_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: estados del traspaso';

CREATE TABLE `requisition_status` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(30) NOT NULL COMMENT 'BORRADOR, EN_ESPERA, SURTIDO_PARCIAL, ENTREGADO, CONFIRMADO, RECHAZADA, CANCELADA',
  `name`         VARCHAR(80) NOT NULL,
  `order_index`  INT NOT NULL DEFAULT 0,
  `is_terminal`  TINYINT NOT NULL DEFAULT 0,
  `icon`         VARCHAR(40) NULL DEFAULT NULL,
  `color_hex`    VARCHAR(9) NULL DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`   INT NULL DEFAULT NULL COMMENT 'NULL = plantilla de Huubie',
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  CONSTRAINT `requisition_status_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: estados de la requisicion';

CREATE TABLE `folio_series` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `doc_type`     VARCHAR(10) NOT NULL COMMENT 'ENT entrada · S salida · TRA traspaso · AJU conteo · REQ requisicion',
  `branch_code`  VARCHAR(10) NOT NULL COMMENT 'GUA, KAF, CUA: va en medio del folio (ENT-KAF-0001)',
  `last_number`  INT NOT NULL DEFAULT 0,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`   INT NOT NULL,
  `branch_id`    INT NOT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `branch_doc` (`branch_id`, `doc_type`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  CONSTRAINT `folio_series_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `folio_series_ibfk_2` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: consecutivo de folios por sucursal y documento (se lee con SELECT ... FOR UPDATE)';

-- =====================================================================
-- 2. LO QUE SE INVENTARIA = LOS PRODUCTOS DEL CATALOGO (fayxzvov_pos.product)
--    Entra al inventario el producto con is_inventoriable = 1: lo que se vende
--    (pasteles, postres) y los insumos (kind = 'supply', no se venden en el POS).
--    Nombre, SKU, categoria, unidad (unit_id), costo y vida util salen del
--    Catalogo. Aqui solo vive lo que es de inventario.
-- =====================================================================

CREATE TABLE `product_inventory` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `stock_min`          DOUBLE NOT NULL DEFAULT 0 COMMENT 'debajo de esto: Stock bajo',
  `stock_max`          DOUBLE NOT NULL DEFAULT 0 COMMENT '0 = sin maximo',
  `track_lots`         TINYINT NOT NULL DEFAULT 0 COMMENT '1 = pide lote y caducidad al entrar',
  `average_cost`       DOUBLE NOT NULL DEFAULT 0 COMMENT 'costo promedio ponderado; el ultimo costo es fayxzvov_pos.product.cost',
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`         INT NOT NULL,
  `product_id`         INT NOT NULL,
  `warehouse_area_id`  INT NULL DEFAULT NULL COMMENT 'area donde se guarda',
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product` (`product_id`),
  KEY `company_id` (`company_id`),
  KEY `product_id` (`product_id`),
  KEY `warehouse_area_id` (`warehouse_area_id`),
  CONSTRAINT `product_inventory_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_inventory_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_inventory_ibfk_3` FOREIGN KEY (`warehouse_area_id`)
    REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Sub-catalogo: datos de inventario de un producto del Catalogo (1 a 1)';

CREATE TABLE `product_presentation` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `name`               VARCHAR(160) NOT NULL COMMENT 'Caja de 12, Bulto 25 kg',
  `description`        VARCHAR(255) NULL DEFAULT NULL,
  `sku`                VARCHAR(40) NULL DEFAULT NULL,
  `barcode`            VARCHAR(80) NULL DEFAULT NULL,
  `factor`             DOUBLE NOT NULL DEFAULT 1 COMMENT 'cuantas unidades del producto trae (Caja de 12 = 12)',
  `cost`               DOUBLE NOT NULL DEFAULT 0,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`         INT NOT NULL,
  `product_id`         INT NOT NULL,
  `unit_id`            INT NULL DEFAULT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`),
  KEY `product_id` (`product_id`),
  KEY `unit_id` (`unit_id`),
  CONSTRAINT `product_presentation_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_presentation_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_presentation_ibfk_3` FOREIGN KEY (`unit_id`)
    REFERENCES `unit` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Sub-catalogo: presentaciones de compra; el stock vive en el producto base';

-- =====================================================================
-- 3. SALDO VIVO
-- =====================================================================

CREATE TABLE `stock` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `quantity`          DOUBLE NOT NULL DEFAULT 0,
  `stock_min`         DOUBLE NULL DEFAULT NULL COMMENT 'NULL = el de product_inventory; permite minimo por sucursal',
  `stock_max`         DOUBLE NULL DEFAULT NULL,
  `last_movement_at`  DATETIME NULL DEFAULT NULL,
  `last_count_at`     DATETIME NULL DEFAULT NULL COMMENT 'ultimo conteo fisico aplicado',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`        INT NOT NULL,
  `warehouse_id`      INT NOT NULL,
  `product_id`           INT NOT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `warehouse_product` (`warehouse_id`, `product_id`),
  KEY `company_id` (`company_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_ibfk_3` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Saldo: existencia por producto y almacen (puede quedar negativa si se surte sin stock)';

-- =====================================================================
-- 4. PLANTILLAS DE ENTRADA (formato del dia: "Produccion lunes")
-- =====================================================================

CREATE TABLE `inflow_format` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(80) NOT NULL,
  `description`       VARCHAR(255) NULL DEFAULT NULL,
  `scope`             VARCHAR(20) NOT NULL DEFAULT 'branch' COMMENT 'user = solo quien lo guardo · branch = toda la sucursal',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id`           INT NULL DEFAULT NULL,
  `company_id`        INT NOT NULL,
  `branch_id`         INT NOT NULL,
  `inflow_origin_id`  INT NULL DEFAULT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  KEY `inflow_origin_id` (`inflow_origin_id`),
  CONSTRAINT `inflow_format_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inflow_format_ibfk_2` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inflow_format_ibfk_3` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inflow_format_ibfk_4` FOREIGN KEY (`inflow_origin_id`)
    REFERENCES `inflow_origin` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Catalogo: formatos guardados para capturar entradas repetidas';

CREATE TABLE `inflow_format_item` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `quantity`              DOUBLE NOT NULL DEFAULT 0,
  `sort_order`            INT NOT NULL DEFAULT 0,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inflow_format_id`      INT NOT NULL,
  `product_id`               INT NOT NULL,
  `product_presentation_id`  INT NULL DEFAULT NULL,
  `active`                TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inflow_format_id` (`inflow_format_id`),
  KEY `product_id` (`product_id`),
  KEY `product_presentation_id` (`product_presentation_id`),
  CONSTRAINT `inflow_format_item_ibfk_1` FOREIGN KEY (`inflow_format_id`)
    REFERENCES `inflow_format` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inflow_format_item_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inflow_format_item_ibfk_3` FOREIGN KEY (`product_presentation_id`)
    REFERENCES `product_presentation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Sub-catalogo: renglones de un formato de entrada';

-- =====================================================================
-- 5. ENTRADAS (folio ENT-KAF-0001)
-- =====================================================================

CREATE TABLE `inventory_inflow` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `folio`              VARCHAR(20) NOT NULL,
  `note`               VARCHAR(255) NULL DEFAULT NULL,
  `invoice_folio`      VARCHAR(50) NULL DEFAULT NULL COMMENT 'folio de la factura o nota del proveedor',
  `voucher_url`        VARCHAR(255) NULL DEFAULT NULL COMMENT 'comprobante (foto o PDF), ruta relativa',
  `total_products`     INT NOT NULL DEFAULT 0,
  `total_units`        DOUBLE NOT NULL DEFAULT 0,
  `subtotal`           DOUBLE NOT NULL DEFAULT 0,
  `tax`                DOUBLE NOT NULL DEFAULT 0,
  `total`              DOUBLE NOT NULL DEFAULT 0,
  `operation_date`     DATE NOT NULL COMMENT 'fecha de la entrada (no futura)',
  `confirmed_at`       DATETIME NULL DEFAULT NULL COMMENT 'Produccion confirmada o "Recibi" de un surtido',
  `edited_at`          DATETIME NULL DEFAULT NULL,
  `cancelled_at`       DATETIME NULL DEFAULT NULL,
  `cancel_reason`      VARCHAR(255) NULL DEFAULT NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`             VARCHAR(20) NOT NULL DEFAULT 'applied' COMMENT 'pending | applied | cancelled',
  `user_id`            INT NULL DEFAULT NULL,
  `confirmed_user_id`  INT NULL DEFAULT NULL,
  `edited_user_id`     INT NULL DEFAULT NULL,
  `cancelled_user_id`  INT NULL DEFAULT NULL,
  `company_id`         INT NOT NULL,
  `branch_id`          INT NOT NULL,
  `warehouse_id`       INT NOT NULL COMMENT 'en pantalla: Origen (el almacen donde entra)',
  `warehouse_area_id`  INT NULL DEFAULT NULL COMMENT 'en pantalla: Destino (informativo)',
  `inflow_origin_id`   INT NULL DEFAULT NULL COMMENT 'en pantalla: Tipo de entrada',
  `supplier_id`        INT NULL DEFAULT NULL,
  `inflow_format_id`   INT NULL DEFAULT NULL COMMENT 'formato con que se capturo',
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_folio` (`company_id`, `folio`),
  KEY `operation_date` (`operation_date`),
  KEY `user_id` (`user_id`),
  KEY `confirmed_user_id` (`confirmed_user_id`),
  KEY `edited_user_id` (`edited_user_id`),
  KEY `cancelled_user_id` (`cancelled_user_id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `warehouse_area_id` (`warehouse_area_id`),
  KEY `inflow_origin_id` (`inflow_origin_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `inflow_format_id` (`inflow_format_id`),
  CONSTRAINT `inventory_inflow_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_2` FOREIGN KEY (`confirmed_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_3` FOREIGN KEY (`edited_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_4` FOREIGN KEY (`cancelled_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_5` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_6` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_7` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_8` FOREIGN KEY (`warehouse_area_id`)
    REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_9` FOREIGN KEY (`inflow_origin_id`)
    REFERENCES `inflow_origin` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_10` FOREIGN KEY (`supplier_id`)
    REFERENCES `supplier` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_inflow_ibfk_11` FOREIGN KEY (`inflow_format_id`)
    REFERENCES `inflow_format` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Transaccion raiz: entrada de mercancia (compra, produccion, devolucion, surtido)';

CREATE TABLE `detail_inventory_inflow` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `quantity`               DOUBLE NOT NULL DEFAULT 0 COMMENT 'en la unidad del producto base',
  `presentation_quantity`  DOUBLE NULL DEFAULT NULL COMMENT 'lo capturado en presentacion (2 cajas)',
  `cost`                   DOUBLE NOT NULL DEFAULT 0 COMMENT 'costo unitario sin IVA',
  `tax`                    DOUBLE NOT NULL DEFAULT 0 COMMENT '% de IVA',
  `subtotal`               DOUBLE NOT NULL DEFAULT 0,
  `batch_code`             VARCHAR(40) NULL DEFAULT NULL COMMENT 'lote',
  `expires_at`             DATE NULL DEFAULT NULL COMMENT 'caducidad',
  `previous_stock`         DOUBLE NOT NULL DEFAULT 0 COMMENT 'Antes',
  `resulting_stock`        DOUBLE NOT NULL DEFAULT 0 COMMENT 'Quedo',
  `cancel_previous_stock`  DOUBLE NULL DEFAULT NULL COMMENT 'al cancelar una aplicada: lo que habia (renglon Cancelacion del kardex)',
  `cancel_resulting_stock` DOUBLE NULL DEFAULT NULL COMMENT 'al cancelar una aplicada: lo que quedo',
  `moved_at`               DATETIME(6) NULL DEFAULT NULL COMMENT 'cuando movio la existencia (al aplicarse): ordena el kardex',
  `cancel_moved_at`        DATETIME(6) NULL DEFAULT NULL COMMENT 'cuando la cancelacion la regreso',
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inventory_inflow_id`    INT NOT NULL,
  `product_id`                INT NOT NULL,
  `product_presentation_id`   INT NULL DEFAULT NULL,
  `active`                 TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inventory_inflow_id` (`inventory_inflow_id`),
  KEY `product_id` (`product_id`),
  KEY `product_presentation_id` (`product_presentation_id`),
  CONSTRAINT `detail_inventory_inflow_ibfk_1` FOREIGN KEY (`inventory_inflow_id`)
    REFERENCES `inventory_inflow` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_inflow_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_inflow_ibfk_3` FOREIGN KEY (`product_presentation_id`)
    REFERENCES `product_presentation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: renglones de la entrada';

CREATE TABLE `stock_lot` (
  `id`                          INT NOT NULL AUTO_INCREMENT,
  `batch_code`                  VARCHAR(40) NULL DEFAULT NULL,
  `initial_quantity`            DOUBLE NOT NULL DEFAULT 0,
  `quantity`                    DOUBLE NOT NULL DEFAULT 0 COMMENT 'lo que queda del lote',
  `cost`                        DOUBLE NOT NULL DEFAULT 0,
  `produced_at`                 DATE NULL DEFAULT NULL,
  `expires_at`                  DATE NULL DEFAULT NULL,
  `created_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_id`                  INT NOT NULL,
  `warehouse_id`                INT NOT NULL,
  `product_id`                     INT NOT NULL,
  `detail_inventory_inflow_id`  INT NULL DEFAULT NULL COMMENT 'renglon de entrada que lo creo',
  `active`                      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `expires_at` (`expires_at`),
  KEY `company_id` (`company_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `product_id` (`product_id`),
  KEY `detail_inventory_inflow_id` (`detail_inventory_inflow_id`),
  CONSTRAINT `stock_lot_ibfk_1` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_lot_ibfk_2` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_lot_ibfk_3` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `stock_lot_ibfk_4` FOREIGN KEY (`detail_inventory_inflow_id`)
    REFERENCES `detail_inventory_inflow` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Saldo: lotes con caducidad (solo product_inventory.track_lots = 1); las salidas los consumen del que vence primero';

-- =====================================================================
-- 6. SALIDAS (folio S-KAF-0001). Merma = motivo con is_loss = 1
-- =====================================================================

CREATE TABLE `inventory_outflow` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `folio`              VARCHAR(20) NOT NULL COMMENT 'S-KAF-0001; venta del POS: el folio de la venta (V123, P1653)',
  `note`               VARCHAR(255) NULL DEFAULT NULL,
  `evidence_url`       VARCHAR(255) NULL DEFAULT NULL COMMENT 'foto de la merma',
  `total_products`     INT NOT NULL DEFAULT 0,
  `total_units`        DOUBLE NOT NULL DEFAULT 0,
  `total_cost`         DOUBLE NOT NULL DEFAULT 0,
  `operation_date`     DATE NOT NULL,
  `cancelled_at`       DATETIME NULL DEFAULT NULL,
  `cancel_reason`      VARCHAR(255) NULL DEFAULT NULL,
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`             VARCHAR(20) NOT NULL DEFAULT 'applied' COMMENT 'applied | cancelled',
  `user_id`            INT NULL DEFAULT NULL,
  `cancelled_user_id`  INT NULL DEFAULT NULL,
  `company_id`         INT NOT NULL,
  `branch_id`          INT NOT NULL,
  `warehouse_id`       INT NOT NULL COMMENT 'de donde sale',
  `outflow_reason_id`  INT NULL DEFAULT NULL,
  `department_id`      INT NULL DEFAULT NULL COMMENT 'quien lo consume',
  `sale_id`            INT NULL DEFAULT NULL COMMENT 'venta o pedido del POS que la genero',
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_folio` (`company_id`, `folio`),
  KEY `operation_date` (`operation_date`),
  KEY `user_id` (`user_id`),
  KEY `cancelled_user_id` (`cancelled_user_id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `outflow_reason_id` (`outflow_reason_id`),
  KEY `department_id` (`department_id`),
  KEY `sale_id` (`sale_id`),
  CONSTRAINT `inventory_outflow_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_2` FOREIGN KEY (`cancelled_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_3` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_4` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_5` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_6` FOREIGN KEY (`outflow_reason_id`)
    REFERENCES `outflow_reason` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_7` FOREIGN KEY (`department_id`)
    REFERENCES `department` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_outflow_ibfk_8` FOREIGN KEY (`sale_id`)
    REFERENCES `fayxzvov_pos`.`sale` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Transaccion raiz: salida de mercancia (consumo, merma, venta, surtido)';

CREATE TABLE `detail_inventory_outflow` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `quantity`               DOUBLE NOT NULL DEFAULT 0 COMMENT 'positiva; el signo lo pone la vista',
  `presentation_quantity`  DOUBLE NULL DEFAULT NULL,
  `cost`                   DOUBLE NOT NULL DEFAULT 0 COMMENT 'ultimo costo al momento de salir (no editable)',
  `subtotal`               DOUBLE NOT NULL DEFAULT 0,
  `previous_stock`         DOUBLE NOT NULL DEFAULT 0,
  `resulting_stock`        DOUBLE NOT NULL DEFAULT 0,
  `cancel_previous_stock`  DOUBLE NULL DEFAULT NULL COMMENT 'al cancelar: lo que habia (renglon Cancelacion del kardex)',
  `cancel_resulting_stock` DOUBLE NULL DEFAULT NULL COMMENT 'al cancelar: lo que quedo',
  `moved_at`               DATETIME(6) NULL DEFAULT NULL COMMENT 'cuando movio la existencia: ordena el kardex',
  `cancel_moved_at`        DATETIME(6) NULL DEFAULT NULL COMMENT 'cuando la cancelacion la regreso',
  `note`                   VARCHAR(255) NULL DEFAULT NULL,
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inventory_outflow_id`   INT NOT NULL,
  `product_id`                INT NOT NULL,
  `product_presentation_id`   INT NULL DEFAULT NULL,
  `stock_lot_id`           INT NULL DEFAULT NULL COMMENT 'lote del que salio',
  `active`                 TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inventory_outflow_id` (`inventory_outflow_id`),
  KEY `product_id` (`product_id`),
  KEY `product_presentation_id` (`product_presentation_id`),
  KEY `stock_lot_id` (`stock_lot_id`),
  CONSTRAINT `detail_inventory_outflow_ibfk_1` FOREIGN KEY (`inventory_outflow_id`)
    REFERENCES `inventory_outflow` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_outflow_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_outflow_ibfk_3` FOREIGN KEY (`product_presentation_id`)
    REFERENCES `product_presentation` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_outflow_ibfk_4` FOREIGN KEY (`stock_lot_id`)
    REFERENCES `stock_lot` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: renglones de la salida';

-- =====================================================================
-- 7. TRASPASOS (folio TRA-KAF-0001): Solicitado -> Recibido | Rechazado | Cancelado
-- =====================================================================

CREATE TABLE `inventory_transfer` (
  `id`                        INT NOT NULL AUTO_INCREMENT,
  `folio`                     VARCHAR(20) NOT NULL,
  `note`                      VARCHAR(255) NULL DEFAULT NULL,
  `total_products`            INT NOT NULL DEFAULT 0,
  `total_units`               DOUBLE NOT NULL DEFAULT 0,
  `total_cost`                DOUBLE NOT NULL DEFAULT 0,
  `requested_at`              DATETIME NULL DEFAULT NULL,
  `received_at`               DATETIME NULL DEFAULT NULL COMMENT 'aqui se mueve el stock de los dos almacenes',
  `receive_note`              VARCHAR(255) NULL DEFAULT NULL COMMENT 'lo que dijo quien recibio (llego menos, llego danado)',
  `reject_reason`             VARCHAR(255) NULL DEFAULT NULL COMMENT 'por que se rechazo (destino) o se cancelo (origen)',
  `created_at`                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `transfer_status_id`        INT NOT NULL,
  `requested_user_id`         INT NULL DEFAULT NULL,
  `received_user_id`          INT NULL DEFAULT NULL,
  `company_id`                INT NOT NULL,
  `origin_branch_id`          INT NOT NULL,
  `destination_branch_id`     INT NOT NULL,
  `origin_warehouse_id`       INT NOT NULL,
  `destination_warehouse_id`  INT NOT NULL,
  `active`                    TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_folio` (`company_id`, `folio`),
  KEY `transfer_status_id` (`transfer_status_id`),
  KEY `requested_user_id` (`requested_user_id`),
  KEY `received_user_id` (`received_user_id`),
  KEY `company_id` (`company_id`),
  KEY `origin_branch_id` (`origin_branch_id`),
  KEY `destination_branch_id` (`destination_branch_id`),
  KEY `origin_warehouse_id` (`origin_warehouse_id`),
  KEY `destination_warehouse_id` (`destination_warehouse_id`),
  CONSTRAINT `inventory_transfer_ibfk_1` FOREIGN KEY (`transfer_status_id`)
    REFERENCES `transfer_status` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_2` FOREIGN KEY (`requested_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_3` FOREIGN KEY (`received_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_4` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_5` FOREIGN KEY (`origin_branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_6` FOREIGN KEY (`destination_branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_7` FOREIGN KEY (`origin_warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_ibfk_8` FOREIGN KEY (`destination_warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Transaccion raiz: traspaso entre almacenes o sucursales';

CREATE TABLE `detail_inventory_transfer` (
  `id`                           INT NOT NULL AUTO_INCREMENT,
  `quantity`                     DOUBLE NOT NULL DEFAULT 0 COMMENT 'lo que envia el origen',
  `quantity_received`            DOUBLE NULL DEFAULT NULL COMMENT 'lo que confirma el destino',
  `cost`                         DOUBLE NOT NULL DEFAULT 0,
  `subtotal`                     DOUBLE NOT NULL DEFAULT 0,
  `origin_previous_stock`        DOUBLE NULL DEFAULT NULL,
  `origin_resulting_stock`       DOUBLE NULL DEFAULT NULL,
  `destination_previous_stock`   DOUBLE NULL DEFAULT NULL,
  `destination_resulting_stock`  DOUBLE NULL DEFAULT NULL,
  `moved_at`                     DATETIME(6) NULL DEFAULT NULL COMMENT 'cuando se recibio y movio los dos almacenes: ordena el kardex',
  `created_at`                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inventory_transfer_id`        INT NOT NULL,
  `product_id`                      INT NOT NULL,
  `active`                       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inventory_transfer_id` (`inventory_transfer_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `detail_inventory_transfer_ibfk_1` FOREIGN KEY (`inventory_transfer_id`)
    REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_transfer_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: renglones del traspaso';

CREATE TABLE `inventory_transfer_history` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `note`                   VARCHAR(255) NULL DEFAULT NULL,
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id`                INT NULL DEFAULT NULL,
  `inventory_transfer_id`  INT NOT NULL,
  `transfer_status_id`     INT NOT NULL,
  `active`                 TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `inventory_transfer_id` (`inventory_transfer_id`),
  KEY `transfer_status_id` (`transfer_status_id`),
  CONSTRAINT `inventory_transfer_history_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_history_ibfk_2` FOREIGN KEY (`inventory_transfer_id`)
    REFERENCES `inventory_transfer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventory_transfer_history_ibfk_3` FOREIGN KEY (`transfer_status_id`)
    REFERENCES `transfer_status` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: linea de tiempo del traspaso (cada cambio de estado)';

-- =====================================================================
-- 8. CONTEO FISICO / AJUSTES (folio AJU-KAF-0001): Borrador -> Aplicado | Cancelado
-- =====================================================================

CREATE TABLE `inventory_adjustment` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `folio`                 VARCHAR(20) NOT NULL,
  `note`                  VARCHAR(255) NULL DEFAULT NULL,
  `adjustment_type`       VARCHAR(20) NOT NULL DEFAULT 'fisico' COMMENT 'fisico = conteo · presentacion = paso automatico a presentacion',
  `is_blind`              TINYINT NOT NULL DEFAULT 0 COMMENT '1 = a ciegas: quien cuenta no ve el sistema',
  `total_products`        INT NOT NULL DEFAULT 0,
  `total_counted`         INT NOT NULL DEFAULT 0,
  `total_differences`     INT NOT NULL DEFAULT 0,
  `total_diff_units`      DOUBLE NOT NULL DEFAULT 0,
  `total_diff_cost`       DOUBLE NOT NULL DEFAULT 0,
  `operation_date`        DATE NOT NULL,
  `applied_at`            DATETIME NULL DEFAULT NULL,
  `cancelled_at`          DATETIME NULL DEFAULT NULL COMMENT 'se puede cancelar hasta 48 h despues de aplicar',
  `cancel_reason`         VARCHAR(255) NULL DEFAULT NULL,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`                VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft | applied | cancelled',
  `user_id`               INT NULL DEFAULT NULL,
  `applied_user_id`       INT NULL DEFAULT NULL,
  `cancelled_user_id`     INT NULL DEFAULT NULL,
  `company_id`            INT NOT NULL,
  `branch_id`             INT NOT NULL,
  `warehouse_id`          INT NOT NULL,
  `warehouse_area_id`     INT NULL DEFAULT NULL COMMENT 'NULL = todo el almacen',
  `adjustment_reason_id`  INT NULL DEFAULT NULL,
  `active`                TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_folio` (`company_id`, `folio`),
  KEY `user_id` (`user_id`),
  KEY `applied_user_id` (`applied_user_id`),
  KEY `cancelled_user_id` (`cancelled_user_id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `warehouse_area_id` (`warehouse_area_id`),
  KEY `adjustment_reason_id` (`adjustment_reason_id`),
  CONSTRAINT `inventory_adjustment_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_2` FOREIGN KEY (`applied_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_3` FOREIGN KEY (`cancelled_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_4` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_5` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_6` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_7` FOREIGN KEY (`warehouse_area_id`)
    REFERENCES `warehouse_area` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inventory_adjustment_ibfk_8` FOREIGN KEY (`adjustment_reason_id`)
    REFERENCES `adjustment_reason` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Transaccion raiz: conteo fisico y ajuste de existencias';

CREATE TABLE `detail_inventory_adjustment` (
  `id`                       INT NOT NULL AUTO_INCREMENT,
  `system_quantity`          DOUBLE NOT NULL DEFAULT 0 COMMENT 'lo que decia el sistema al abrir el conteo',
  `physical_quantity`        DOUBLE NULL DEFAULT NULL COMMENT 'NULL = aun no se cuenta',
  `difference`               DOUBLE NOT NULL DEFAULT 0 COMMENT 'fisico - sistema',
  `cost`                     DOUBLE NOT NULL DEFAULT 0,
  `cost_difference`          DOUBLE NOT NULL DEFAULT 0,
  `previous_stock`           DOUBLE NULL DEFAULT NULL COMMENT 'al aplicar',
  `resulting_stock`          DOUBLE NULL DEFAULT NULL,
  `note`                     VARCHAR(255) NULL DEFAULT NULL,
  `counted_at`               DATETIME NULL DEFAULT NULL,
  `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inventory_adjustment_id`  INT NOT NULL,
  `product_id`                  INT NOT NULL,
  `active`                   TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inventory_adjustment_id` (`inventory_adjustment_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `detail_inventory_adjustment_ibfk_1` FOREIGN KEY (`inventory_adjustment_id`)
    REFERENCES `inventory_adjustment` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_inventory_adjustment_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: hoja del conteo (un renglon por producto)';

-- =====================================================================
-- 9. REQUISICIONES (folio REQ-KAF-0001): una sucursal pide material a la Matriz
-- =====================================================================

CREATE TABLE `requisition` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `folio`                  VARCHAR(20) NOT NULL,
  `note`                   VARCHAR(255) NULL DEFAULT NULL,
  `approval_note`          VARCHAR(255) NULL DEFAULT NULL,
  `reject_reason`          VARCHAR(255) NULL DEFAULT NULL,
  `share_token`            CHAR(32) NULL DEFAULT NULL COMMENT 'enlace publico para WhatsApp',
  `total_products`         INT NOT NULL DEFAULT 0,
  `total_units`            DOUBLE NOT NULL DEFAULT 0,
  `total_cost`             DOUBLE NOT NULL DEFAULT 0 COMMENT 'estimado con el ultimo costo',
  `needed_date`            DATE NULL DEFAULT NULL COMMENT 'en pantalla: Lo necesita para',
  `sent_at`                DATETIME NULL DEFAULT NULL,
  `approved_at`            DATETIME NULL DEFAULT NULL COMMENT 'aprobar = surtir',
  `confirmed_at`           DATETIME NULL DEFAULT NULL COMMENT 'Recibi de quien pidio',
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `requisition_status_id`  INT NOT NULL,
  `user_id`                INT NULL DEFAULT NULL COMMENT 'quien pide',
  `approved_user_id`       INT NULL DEFAULT NULL COMMENT 'quien surte',
  `confirmed_user_id`      INT NULL DEFAULT NULL,
  `company_id`             INT NOT NULL,
  `branch_id`              INT NOT NULL COMMENT 'sucursal que pide',
  `source_branch_id`       INT NOT NULL COMMENT 'sucursal que surte (la Matriz)',
  `warehouse_id`           INT NULL DEFAULT NULL COMMENT 'almacen que surte; lo elige quien surte',
  `department_id`          INT NULL DEFAULT NULL,
  `active`                 TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_folio` (`company_id`, `folio`),
  KEY `requisition_status_id` (`requisition_status_id`),
  KEY `user_id` (`user_id`),
  KEY `approved_user_id` (`approved_user_id`),
  KEY `confirmed_user_id` (`confirmed_user_id`),
  KEY `company_id` (`company_id`),
  KEY `branch_id` (`branch_id`),
  KEY `source_branch_id` (`source_branch_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `requisition_ibfk_1` FOREIGN KEY (`requisition_status_id`)
    REFERENCES `requisition_status` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_3` FOREIGN KEY (`approved_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_4` FOREIGN KEY (`confirmed_user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_5` FOREIGN KEY (`company_id`)
    REFERENCES `fayxzvov_app`.`companies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_6` FOREIGN KEY (`branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_7` FOREIGN KEY (`source_branch_id`)
    REFERENCES `fayxzvov_app`.`branches` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_8` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_ibfk_9` FOREIGN KEY (`department_id`)
    REFERENCES `department` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Transaccion raiz: requisicion interna de material';

CREATE TABLE `detail_requisition` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `quantity`           DOUBLE NOT NULL DEFAULT 0 COMMENT 'lo pedido',
  `quantity_supplied`  DOUBLE NOT NULL DEFAULT 0 COMMENT 'lo surtido hasta hoy',
  `note`               VARCHAR(255) NULL DEFAULT NULL COMMENT 'Observacion',
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `requisition_id`     INT NOT NULL,
  `product_id`            INT NOT NULL,
  `delivered_product_id`  INT NULL DEFAULT NULL COMMENT 'sustituto: Pidio X · Se entrego Y',
  `unit_id`            INT NULL DEFAULT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `requisition_id` (`requisition_id`),
  KEY `product_id` (`product_id`),
  KEY `delivered_product_id` (`delivered_product_id`),
  KEY `unit_id` (`unit_id`),
  CONSTRAINT `detail_requisition_ibfk_1` FOREIGN KEY (`requisition_id`)
    REFERENCES `requisition` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_requisition_ibfk_2` FOREIGN KEY (`product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `detail_requisition_ibfk_3` FOREIGN KEY (`delivered_product_id`)
    REFERENCES `fayxzvov_pos`.`product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `detail_requisition_ibfk_4` FOREIGN KEY (`unit_id`)
    REFERENCES `unit` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: renglones de la requisicion';

CREATE TABLE `requisition_supply` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `total_products`        INT NOT NULL DEFAULT 0,
  `total_units`           DOUBLE NOT NULL DEFAULT 0,
  `total_cost`            DOUBLE NOT NULL DEFAULT 0,
  `note`                  VARCHAR(255) NULL DEFAULT NULL COMMENT 'Por que no se surtio todo',
  `moves_stock`           TINYINT NOT NULL DEFAULT 1 COMMENT '0 = solo se marco surtido (warehouse.supply_moves_stock = 0)',
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id`               INT NULL DEFAULT NULL,
  `requisition_id`        INT NOT NULL,
  `warehouse_id`          INT NULL DEFAULT NULL,
  `inventory_outflow_id`  INT NULL DEFAULT NULL COMMENT 'salida S- de quien surte',
  `inventory_inflow_id`   INT NULL DEFAULT NULL COMMENT 'entrada ENT- a quien pidio (espera su Recibi)',
  `active`                TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `requisition_id` (`requisition_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `inventory_outflow_id` (`inventory_outflow_id`),
  KEY `inventory_inflow_id` (`inventory_inflow_id`),
  CONSTRAINT `requisition_supply_ibfk_1` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_app`.`users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_supply_ibfk_2` FOREIGN KEY (`requisition_id`)
    REFERENCES `requisition` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `requisition_supply_ibfk_3` FOREIGN KEY (`warehouse_id`)
    REFERENCES `warehouse` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_supply_ibfk_4` FOREIGN KEY (`inventory_outflow_id`)
    REFERENCES `inventory_outflow` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `requisition_supply_ibfk_5` FOREIGN KEY (`inventory_inflow_id`)
    REFERENCES `inventory_inflow` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Detalle: historial de surtimientos de una requisicion (surtido parcial = varios)';

-- =====================================================================
-- 10. KARDEX: vista de solo lectura (Movimientos). No se inserta aqui:
--     se arma con los renglones aplicados de cada documento.
--     Tipos: ENTRADA, SALIDA, TRANSFERENCIA, AJUSTE (los mismos del ERP) y
--     CANCELACION: una entrada o salida que se aplico y luego se cancelo
--     conserva su renglon y suma otro, a la hora de la cancelacion, con la
--     cantidad al reves. Asi la cadena Antes -> Quedo no se rompe.
--     occurred_at = la fecha del documento (la que se ve); sort_at = cuando
--     de verdad cambio la existencia, con microsegundos (el orden de la cadena).
-- =====================================================================

CREATE OR REPLACE VIEW `inventory_movement` AS
SELECT CONCAT('IN-', d.id)        AS movement_uid,
       'ENTRADA'                  AS movement_type,
       r.folio                    AS folio,
       o.name                     AS concept,
       r.note                     AS note,
       d.quantity                 AS quantity,
       d.previous_stock           AS stock_prev,
       d.resulting_stock          AS stock_post,
       d.cost                     AS cost_unit,
       d.subtotal                 AS cost_total,
       TIMESTAMP(r.operation_date, TIME(r.created_at)) AS occurred_at,
       r.created_at               AS created_at,
       COALESCE(d.moved_at, r.confirmed_at, r.created_at) AS sort_at,
       d.product_id               AS product_id,
       r.warehouse_id             AS warehouse_id,
       r.user_id                  AS user_id,
       r.branch_id                AS branch_id,
       r.company_id               AS company_id
  FROM detail_inventory_inflow d
  JOIN inventory_inflow r ON r.id = d.inventory_inflow_id
  LEFT JOIN inflow_origin o ON o.id = r.inflow_origin_id
 WHERE d.active = 1 AND r.active = 1
   AND (r.status = 'applied' OR (r.status = 'cancelled' AND d.cancel_resulting_stock IS NOT NULL))
UNION ALL
SELECT CONCAT('IN-X-', d.id), 'CANCELACION', r.folio, CONCAT('Cancelación de entrada: ', IFNULL(r.cancel_reason, '')), r.note,
       -d.quantity, d.cancel_previous_stock, d.cancel_resulting_stock, d.cost, -d.subtotal,
       r.cancelled_at, r.cancelled_at, COALESCE(d.cancel_moved_at, r.cancelled_at),
       d.product_id, r.warehouse_id, r.cancelled_user_id, r.branch_id, r.company_id
  FROM detail_inventory_inflow d
  JOIN inventory_inflow r ON r.id = d.inventory_inflow_id
 WHERE d.active = 1 AND r.active = 1 AND r.status = 'cancelled' AND d.cancel_resulting_stock IS NOT NULL
UNION ALL
SELECT CONCAT('OUT-', d.id), 'SALIDA', r.folio, m.name, r.note,
       -d.quantity, d.previous_stock, d.resulting_stock, d.cost, -d.subtotal,
       TIMESTAMP(r.operation_date, TIME(r.created_at)), r.created_at, COALESCE(d.moved_at, r.created_at),
       d.product_id, r.warehouse_id, r.user_id, r.branch_id, r.company_id
  FROM detail_inventory_outflow d
  JOIN inventory_outflow r ON r.id = d.inventory_outflow_id
  LEFT JOIN outflow_reason m ON m.id = r.outflow_reason_id
 WHERE d.active = 1 AND r.active = 1
   AND (r.status = 'applied' OR (r.status = 'cancelled' AND d.cancel_resulting_stock IS NOT NULL))
UNION ALL
SELECT CONCAT('OUT-X-', d.id), 'CANCELACION', r.folio, CONCAT('Cancelación de salida: ', IFNULL(r.cancel_reason, '')), r.note,
       d.quantity, d.cancel_previous_stock, d.cancel_resulting_stock, d.cost, d.subtotal,
       r.cancelled_at, r.cancelled_at, COALESCE(d.cancel_moved_at, r.cancelled_at),
       d.product_id, r.warehouse_id, r.cancelled_user_id, r.branch_id, r.company_id
  FROM detail_inventory_outflow d
  JOIN inventory_outflow r ON r.id = d.inventory_outflow_id
 WHERE d.active = 1 AND r.active = 1 AND r.status = 'cancelled' AND d.cancel_resulting_stock IS NOT NULL
UNION ALL
SELECT CONCAT('TR-OUT-', d.id), 'TRANSFERENCIA', r.folio, CONCAT('Traspaso a ', IFNULL(wd.name, '')), r.note,
       -d.quantity, d.origin_previous_stock, d.origin_resulting_stock, d.cost, -d.subtotal,
       r.received_at, r.created_at, COALESCE(d.moved_at, r.received_at),
       d.product_id, r.origin_warehouse_id, r.received_user_id, r.origin_branch_id, r.company_id
  FROM detail_inventory_transfer d
  JOIN inventory_transfer r ON r.id = d.inventory_transfer_id
  JOIN transfer_status s ON s.id = r.transfer_status_id
  LEFT JOIN warehouse wd ON wd.id = r.destination_warehouse_id
 WHERE d.active = 1 AND r.active = 1 AND s.code = 'RECEIVED'
UNION ALL
SELECT CONCAT('TR-IN-', d.id), 'TRANSFERENCIA', r.folio, CONCAT('Traspaso de ', IFNULL(wo.name, '')), r.note,
       COALESCE(d.quantity_received, d.quantity), d.destination_previous_stock, d.destination_resulting_stock,
       d.cost, COALESCE(d.quantity_received, d.quantity) * d.cost,
       r.received_at, r.created_at, COALESCE(d.moved_at, r.received_at),
       d.product_id, r.destination_warehouse_id, r.received_user_id, r.destination_branch_id, r.company_id
  FROM detail_inventory_transfer d
  JOIN inventory_transfer r ON r.id = d.inventory_transfer_id
  JOIN transfer_status s ON s.id = r.transfer_status_id
  LEFT JOIN warehouse wo ON wo.id = r.origin_warehouse_id
 WHERE d.active = 1 AND r.active = 1 AND s.code = 'RECEIVED'
   AND COALESCE(d.quantity_received, d.quantity) > 0
UNION ALL
SELECT CONCAT('ADJ-', d.id), 'AJUSTE', r.folio, a.name, r.note,
       d.difference, d.previous_stock, d.resulting_stock, d.cost, d.cost_difference,
       r.applied_at, r.created_at, r.applied_at,
       d.product_id, r.warehouse_id, COALESCE(r.applied_user_id, r.user_id), r.branch_id, r.company_id
  FROM detail_inventory_adjustment d
  JOIN inventory_adjustment r ON r.id = d.inventory_adjustment_id
  LEFT JOIN adjustment_reason a ON a.id = r.adjustment_reason_id
 WHERE d.active = 1 AND r.active = 1 AND r.status = 'applied' AND d.difference <> 0;

-- =====================================================================
-- 11. PLANTILLAS DE HUUBIE (company_id NULL). Al activar Inventarios en una
--     empresa se copian con su company_id; la empresa las edita a su gusto.
-- =====================================================================

INSERT INTO `unit` (`code`, `name`, `allows_decimals`, `sort_order`) VALUES
  ('PZA',    'Pieza',     0,  1),
  ('KG',     'Kilo',      1,  2),
  ('G',      'Gramo',     1,  3),
  ('LT',     'Litro',     1,  4),
  ('ML',     'Mililitro', 1,  5),
  ('CAJA',   'Caja',      0,  6),
  ('PAQ',    'Paquete',   0,  7),
  ('BOLSA',  'Bolsa',     0,  8),
  ('LATA',   'Lata',      0,  9),
  ('BOTE',   'Bote',      0, 10),
  ('FRASCO', 'Frasco',    0, 11),
  ('ROLLO',  'Rollo',     0, 12),
  ('BOT',    'Botella',   0, 13),
  ('REB',    'Rebanada',  0, 14);

INSERT INTO `department` (`name`, `icon`, `color_hex`, `sort_order`) VALUES
  ('Pastelería',  'cake-slice',   '#C05A40', 1),
  ('Panadería',   'croissant',    '#B45309', 2),
  ('Postres',     'ice-cream-cone', '#DB2777', 3),
  ('Bocadillos',  'sandwich',     '#0369A1', 4),
  ('Batidos',     'cup-soda',     '#7C3AED', 5),
  ('Mostrador',   'store',        '#047857', 6),
  ('Limpieza',    'spray-can',    '#4B5563', 7);

INSERT INTO `inflow_origin`
  (`code`, `name`, `description`, `icon`, `color_hex`, `requires_supplier`, `updates_cost`, `starts_pending`, `is_system`, `sort_order`) VALUES
  ('COMPRA',      'Compra',                 'Mercancía que llega de un proveedor con factura o nota.',           'shopping-bag',   '#047857', 1, 1, 0, 0, 1),
  ('COMPRA_SP',   'Compra sin proveedor',   'Compra en tienda o mercado sin proveedor dado de alta.',           'shopping-basket','#0369A1', 0, 1, 0, 0, 2),
  ('PRODUCCION',  'Producción',             'Lo que salió del horno: nace pendiente y suma al confirmarla.',    'chef-hat',       '#C05A40', 0, 0, 1, 0, 3),
  ('DEVOLUCION',  'Devolución',             'Producto que regresa al almacén y se puede volver a usar.',        'undo-2',         '#7C3AED', 0, 0, 0, 0, 4),
  ('INICIAL',     'Inventario inicial',     'Carga de arranque del módulo.',                                    'flag',           '#4B5563', 0, 1, 0, 0, 5),
  ('AJUSTE',      'Entrada por ajuste',     'Corrección manual de existencia fuera de un conteo.',              'sliders-horizontal', '#B45309', 0, 0, 0, 0, 6),
  ('EDA',         'Nota sencilla',          'Entrada rápida sin documento.',                                    'sticky-note',    '#6B7280', 0, 0, 0, 0, 7),
  ('SURTIDO_SUC', 'Surtido de la Matriz',   'La crea el sistema al surtir una requisición; espera tu «Recibí».', 'truck',          '#0369A1', 0, 0, 0, 1, 8);

INSERT INTO `outflow_reason`
  (`code`, `name`, `description`, `icon`, `color_hex`, `is_loss`, `requires_evidence`, `requires_department`, `is_system`, `sort_order`) VALUES
  ('CONSUMO',          'Consumo de producción',  'Insumos que usa un departamento para producir.',       'chef-hat',        '#C05A40', 0, 0, 1, 0, 1),
  ('PEDIDO_COMP',      'Pedido complementario',  'Material extra para un pedido especial.',              'cake',            '#B45309', 0, 0, 0, 0, 2),
  ('DEGUSTACION',      'Degustación',            'Producto que se da a probar.',                         'utensils',        '#7C3AED', 0, 0, 0, 0, 3),
  ('MERMA',            'Merma',                  'Pérdida sin otra clasificación.',                      'trash-2',         '#E11D48', 1, 1, 0, 0, 4),
  ('CADUCIDAD',        'Caducidad',              'Venció la vida útil.',                                 'calendar-x',      '#E11D48', 1, 1, 0, 0, 5),
  ('DANO',             'Dañado',                 'Golpeado, roto o derramado.',                          'package-x',       '#E11D48', 1, 1, 0, 0, 6),
  ('ERROR_PROD',       'Error de producción',    'Salió mal del horno o de la decoración.',              'flame',           '#E11D48', 1, 1, 0, 0, 7),
  ('FALTANTE',         'Robo / Faltante',        'Desapareció sin explicación.',                         'shield-alert',    '#E11D48', 1, 0, 0, 0, 8),
  ('SURTIDO_SUC',      'Surtido a sucursal',     'La crea el sistema al surtir una requisición.',        'truck',           '#0369A1', 0, 0, 0, 1, 9),
  ('SALIDA_POR_VENTA', 'Venta POS',              'La crea el POS al cobrar o entregar.',                 'shopping-cart',   '#047857', 0, 0, 0, 1, 10);

INSERT INTO `adjustment_reason` (`code`, `name`, `icon`, `color_hex`, `affects_cost`, `is_system`, `sort_order`) VALUES
  ('CONTEO_FISICO',  'Conteo físico',          'clipboard-check', '#C05A40', 1, 0, 1),
  ('FALTANTE',       'Faltante sin explicar',  'circle-minus',    '#E11D48', 1, 0, 2),
  ('SOBRANTE',       'Sobrante',               'circle-plus',     '#047857', 1, 0, 3),
  ('CIERRE_MENSUAL', 'Cierre mensual',         'calendar-check',  '#0369A1', 1, 0, 4),
  ('ENTRADA_NO_REG', 'Entrada no registrada',  'file-question',   '#B45309', 0, 0, 5),
  ('PRESENTACION',   'Pasó a presentación',    'boxes',           '#4B5563', 0, 1, 6);

INSERT INTO `transfer_status` (`code`, `name`, `name_out`, `name_in`, `order_index`, `is_terminal`, `icon`, `color_hex`) VALUES
  ('REQUESTED', 'Solicitado', 'Enviado',   'Por recibir', 1, 0, 'send',          '#B45309'),
  ('RECEIVED',  'Recibido',   'Entregado', 'Recibido',    2, 1, 'circle-check',  '#047857'),
  ('REJECTED',  'Rechazado',  'Rechazado', 'Rechazado',   3, 1, 'circle-x',      '#E11D48'),
  ('CANCELLED', 'Cancelado',  'Cancelado', 'Cancelado',   4, 1, 'ban',           '#6B7280');

INSERT INTO `requisition_status` (`code`, `name`, `order_index`, `is_terminal`, `icon`, `color_hex`) VALUES
  ('BORRADOR',        'Borrador',             1, 0, 'pencil-line',   '#6B7280'),
  ('EN_ESPERA',       'En espera',            2, 0, 'clock-3',       '#B45309'),
  ('SURTIDO_PARCIAL', 'Surtido parcialmente', 3, 0, 'circle-dashed', '#0369A1'),
  ('ENTREGADO',       'Entregado',            4, 0, 'truck',         NULL),
  ('CONFIRMADO',      'Confirmado',           5, 1, 'circle-check',  '#047857'),
  ('RECHAZADA',       'Rechazada',            6, 1, 'circle-x',      '#E11D48'),
  ('CANCELADA',       'Cancelada',            7, 1, 'ban',           '#6B7280');

-- 12. Comprobacion: debe salir tablas = 29, vistas = 1.
SELECT SUM(table_type = 'BASE TABLE') AS tablas, SUM(table_type = 'VIEW') AS vistas
  FROM information_schema.tables WHERE table_schema = 'fayxzvov_inventarios';
