# Propuesta de base de datos — módulo Inventarios

> **Producto:** Huubie · Inventarios
> **Esquema destino propuesto:** `fayxzvov_inventario` (nuevo, dedicado al módulo).
> **Charset / Collation:** `utf8mb4` / `utf8mb4_0900_ai_ci`.
> **Engine:** `InnoDB`.
> **Manual de reglas aplicado:** [grimorios/db-rules.md](../../../../Users/CoffeSoft/.claude/agents/grimorios/db-rules.md) (singular inglés snake_case, DOUBLE para montos, FKs al final, `detail_` solo en renglones de raíz).
> **Referencia viva:** esquemas inspeccionados vía MySQL local — `fayxzvov_admin`, `fayxzvov_alpha`, `fayxzvov_reginas`, `fayxzvov_rrhh`, `fayxzvov_almacen`.
> **Fecha:** 2026-05-19

---

## §1. Resumen ejecutivo

El módulo de Inventarios necesita persistir:

1. **Catálogos del propio módulo** — almacenes físicos, áreas, presentaciones, motivos, orígenes.
2. **Productos** — reaprovechando `fayxzvov_reginas.order_products` (vía FK cross-schema) en lugar de duplicar el catálogo POS.
3. **Saldos de stock** por (producto × sucursal × almacén).
4. **Eventos raíz + renglones** para cada tipo de movimiento: entradas, mermas, traspasos, ajustes. (Salidas POS se materializan al lado de Ventas, no en este esquema.)
5. **Bitácora unificada** — vista materializada `inventory_movement` que une todos los eventos para el visor de movimientos.

Cross-schema:
- `companies_id` → `fayxzvov_admin.companies(id)`
- `subsidiaries_id` → `fayxzvov_alpha.subsidiaries(id)`
- `user_id` → `fayxzvov_alpha.usr_users(id)`
- `employee_id` → `fayxzvov_rrhh.rrhh_empleados(id)`
- `order_product_id` → `fayxzvov_reginas.order_products(id)`

> **Nota sobre convención de nombres de FK.** El manual `db-rules.md` prescribe singular (`subsidiary_id`, `company_id`). Sin embargo el ecosistema Huubie tiene en producción `subsidiaries_id` y `companies_id` plurales (ver `fayxzvov_alpha.subsidiaries.companies_id`, `fayxzvov_reginas.order_products.subsidiaries_id`). En esta propuesta se **respeta la convención existente del ecosistema** (plural) por consistencia operativa; las FK nuevas a tablas del propio módulo sí usan singular (`product_id`, `warehouse_id`, etc.).

---

## §2. Tablas clasificadas

### §2.1 Maestros corporativos (cross-schema — solo se referencian, **no se crean**)

| Tabla | Esquema externo | Rol |
|---|---|---|
| `companies` | `fayxzvov_admin` | Empresa raíz (Reginas = id 4). |
| `subsidiaries` | `fayxzvov_alpha` | Sucursales operativas. |
| `usr_users` | `fayxzvov_alpha` | Usuarios (quien registra eventos). |
| `rrhh_empleados` | `fayxzvov_rrhh` | Empleados (autoriza, recibe, envía). |
| `order_products` | `fayxzvov_reginas` | Catálogo de productos terminados POS (97 registros). |
| `order_category` | `fayxzvov_reginas` | Categorías de productos POS (Pasteleria, Postres, …). |

### §2.2 Catálogos del módulo (tablas raíz del nuevo esquema)

| # | Tabla | Tipo | Descripción |
|---|---|---|---|
| 1 | `warehouse` | Catálogo | Almacenes físicos (uno o más por sucursal). |
| 2 | `warehouse_area` | Catálogo | Áreas internas del almacén: Refrigerados, Secos, Congelados. |
| 3 | `product_attribute` | Sub-catálogo | Extensión inventory-specific de `order_products` (SKU, stock_min, stock_max, shelf_life_days, cost_unit, warehouse_area_id). **1:1 con order_products.** |
| 4 | `supplier` | Catálogo | Proveedores externos. |
| 5 | `unit` | Catálogo | Unidades de medida (pza, kg, lt, caja, paquete). |
| 6 | `inflow_origin` | Sub-catálogo | Origen de entrada: Produccion, Proveedor, Transferencia, Devolucion. |
| 7 | `shrinkage_reason` | Sub-catálogo | Motivos de merma: Caducidad, Daniado, Error produccion, Robo, Devolucion. |
| 8 | `adjustment_reason` | Sub-catálogo | Motivos de ajuste: Faltante sin explicar, Entrada no registrada, Conteo fisico, Cierre mensual, etc. |
| 9 | `transfer_status` | Sub-catálogo | Estados del flujo de traspaso: Solicitado, Autorizado, En Transito, Recibido, Rechazado. |

### §2.3 Stock (saldo por (producto, sucursal, almacén))

| # | Tabla | Tipo | Descripción |
|---|---|---|---|
| 10 | `stock` | Saldo | `(order_product_id, warehouse_id) → quantity`. Estado vivo del inventario. Actualizado por triggers/lógica de los eventos. |

### §2.4 Eventos POS (productos terminados) — pares raíz + renglones

| # | Tabla raíz | Detalle | Folio | Descripción |
|---|---|---|---|---|
| 11 | `inventory_inflow` | `detail_inventory_inflow` | `ENT-####` | Entradas (producción, proveedor, transferencia recibida, devolución). |
| 12 | `inventory_shrinkage` | `detail_inventory_shrinkage` | `M-####` | Mermas (productos dados de baja). |
| 13 | `inventory_transfer` | `detail_inventory_transfer` | `TRA-####` | Traspasos entre sucursales. |
| 14 | `inventory_adjustment` | `detail_inventory_adjustment` | `AJU-####` / `INV-FIS-####` | Ajustes individuales o inventario físico. |

### §2.5 Trazabilidad del traspaso

| # | Tabla | Tipo | Descripción |
|---|---|---|---|
| 15 | `inventory_transfer_history` | Histórico | Timeline de cambios de estado del traspaso (un row por transición). |

### §2.6 Bitácora unificada

| # | Objeto | Tipo | Descripción |
|---|---|---|---|
| 16 | `inventory_movement` | Vista (recomendada) o tabla materializada | UNION ALL de todos los eventos para alimentar el visor de Movimientos. |

### §2.7 Tablas paralelas para dimensión Insumos (opcional — Fase 2)

> Solo si se activa la dimensión Insumos (ver [plan/propuesta-salida-insumos.md](../plan/propuesta-salida-insumos.md)). Mismas convenciones, prefijo de tabla `supply_*` y folios `*-INS-####`.

| Tabla raíz | Detalle | Folio |
|---|---|---|
| `supply` | (catálogo de insumos, autónomo, no referencia order_products) | — |
| `supply_category` | (sub-catálogo) | — |
| `consumption_area` | (sub-catálogo: Cocina, Barra, Panaderia) | — |
| `supply_inflow` | `detail_supply_inflow` | `ENT-INS-####` |
| `supply_outflow` | `detail_supply_outflow` | `SAL-INS-####` |
| `supply_shrinkage` | `detail_supply_shrinkage` | `MER-INS-####` |
| `supply_transfer` | `detail_supply_transfer` | `TRA-INS-####` |

---

## §2.bis Diagrama de relaciones (texto plano)

> Convención: caja con **doble borde** `╔══╗` = tabla del esquema actual `fayxzvov_inventario`. Caja con **borde simple** `┌──┐` = tabla cross-schema. Las flechas llevan la cardinalidad pegada (`1` o `N`).

```
                          ┌──────────────────────────┐
                          │  fayxzvov_admin          │
                          │  ┌───────────────┐       │
                          │  │  companies    │       │
                          │  └───────┬───────┘       │
                          └──────────┼───────────────┘
                                     │ 1
                                     │
                                     │ N
                          ┌──────────┼───────────────┐
                          │  fayxzvov_alpha          │
                          │  ┌───────▼───────┐       │
                          │  │ subsidiaries  │◀──┐   │
                          │  └───────┬───────┘   │   │
                          │          │ 1         │ N │
                          │          │           │   │
                          │          │ N         │   │
                          │  ┌───────▼───────┐   │   │
                          │  │   usr_users   │───┘   │
                          │  └───────────────┘       │
                          └──────────────────────────┘
                                     │
                                     │ subsidiaries_id
                                     │
        ╔════════════════════════════▼═════════════════════════════╗
        ║                  fayxzvov_inventario                      ║
        ║                                                           ║
        ║  ╔═══════════════╗      N  ╔═══════════════╗              ║
        ║  ║   warehouse   ╠─────────╣ warehouse_area║              ║
        ║  ╚═══════╦═══════╝         ╚═══════════════╝              ║
        ║          │ 1                                              ║
        ║          │                                                ║
        ║          │ N                                              ║
        ║  ╔═══════▼═══════╗                                        ║
        ║  ║     stock     ║                                        ║
        ║  ╚═══════▲═══════╝                                        ║
        ║          │ N                                              ║
        ║          │                                                ║
        ║          │ 1                                              ║
        ║  ┌───────┴───────────┐  fayxzvov_reginas                  ║
        ║  │  order_products   │  (cross-schema)                    ║
        ║  └───────┬───────────┘                                    ║
        ║          │ 1                                              ║
        ║          │ 1:1                                            ║
        ║  ╔═══════▼═══════════╗                                    ║
        ║  ║ product_attribute ║                                    ║
        ║  ╚═══════════════════╝                                    ║
        ║                                                           ║
        ║  ── EVENTOS RAIZ + RENGLONES ──                           ║
        ║                                                           ║
        ║  ╔════════════════════╗      1  ╔══════════════════════╗  ║
        ║  ║  inventory_inflow  ╠─────────╣ detail_inv_inflow    ║  ║
        ║  ╚════════╦═══════════╝   N     ╚══════════╦═══════════╝  ║
        ║           │ N                              │ N            ║
        ║           │                                │              ║
        ║           │ 1                              │ 1            ║
        ║  ╔════════▼═══════════╗           ┌────────▼──────────┐   ║
        ║  ║  inflow_origin     ║           │  order_products   │   ║
        ║  ╚════════════════════╝           │  (cross-schema)   │   ║
        ║                                   └───────────────────┘   ║
        ║                                                           ║
        ║  ╔════════════════════╗      1  ╔══════════════════════╗  ║
        ║  ║ inventory_shrinkage╠─────────╣detail_inv_shrinkage  ║  ║
        ║  ╚════════╦═══════════╝   N     ╚══════════════════════╝  ║
        ║           │ N                                             ║
        ║           │ 1                                             ║
        ║  ╔════════▼═══════════╗                                   ║
        ║  ║  shrinkage_reason  ║                                   ║
        ║  ╚════════════════════╝                                   ║
        ║                                                           ║
        ║  ╔════════════════════╗      1  ╔══════════════════════╗  ║
        ║  ║ inventory_transfer ╠─────────╣ detail_inv_transfer  ║  ║
        ║  ╚════════╦═══════════╝   N     ╚══════════════════════╝  ║
        ║           │ 1                                             ║
        ║           │                                               ║
        ║           │ N                                             ║
        ║  ╔════════▼═══════════════╗                               ║
        ║  ║inventory_transfer_history║                             ║
        ║  ╚══════════════════════════╝                             ║
        ║                                                           ║
        ║  ╔════════════════════╗      1  ╔══════════════════════╗  ║
        ║  ║inventory_adjustment╠─────────╣detail_inv_adjustment ║  ║
        ║  ╚════════╦═══════════╝   N     ╚══════════════════════╝  ║
        ║           │ N                                             ║
        ║           │ 1                                             ║
        ║  ╔════════▼═══════════╗                                   ║
        ║  ║ adjustment_reason  ║                                   ║
        ║  ╚════════════════════╝                                   ║
        ║                                                           ║
        ║                                                           ║
        ║  Cross-schema (todas las tablas raíz tienen):             ║
        ║     subsidiaries_id  → fayxzvov_alpha.subsidiaries        ║
        ║     companies_id     → fayxzvov_admin.companies           ║
        ║     user_id          → fayxzvov_alpha.usr_users           ║
        ║                                                           ║
        ╚═══════════════════════════════════════════════════════════╝

                          ┌──────────────────────────┐
                          │  fayxzvov_rrhh           │
                          │  ┌───────────────┐       │
                          │  │ rrhh_empleados│       │
                          │  └───────────────┘       │
                          │  (referencia opcional    │
                          │   para "autorizo" en     │
                          │   traspasos)             │
                          └──────────────────────────┘
```

### Tabla de cardinalidades (resumen)

| Origen | Cardinalidad | Destino | Esquema destino | Justificación |
|---|---|---|---|---|
| `warehouse` | N : 1 | `subsidiaries` | `fayxzvov_alpha` | Un almacén pertenece a una sucursal; una sucursal tiene varios almacenes. |
| `warehouse` | N : 1 | `warehouse_area` | actual | Un almacén puede tener un área principal (Refrigerados/Secos/Congelados); cada área agrupa varios almacenes a través de la organización. |
| `warehouse` | N : 1 | `companies` | `fayxzvov_admin` | Tenant. |
| `product_attribute` | 1 : 1 | `order_products` | `fayxzvov_reginas` | Extensión inventory-specific de cada producto POS. |
| `product_attribute` | N : 1 | `warehouse_area` | actual | El producto se guarda en un área. |
| `stock` | N : 1 | `order_products` | `fayxzvov_reginas` | Saldo por producto. |
| `stock` | N : 1 | `warehouse` | actual | Saldo por almacén. |
| `inventory_inflow` | N : 1 | `inflow_origin` | actual | Cada entrada tiene un origen tipificado. |
| `inventory_inflow` | N : 1 | `warehouse` | actual | Entrada va a un almacén. |
| `inventory_inflow` | N : 1 | `subsidiaries` | `fayxzvov_alpha` | Sucursal donde se registra. |
| `inventory_inflow` | N : 1 | `supplier` | actual (NULL si origen ≠ Proveedor) | Si aplica. |
| `inventory_inflow` | N : 1 | `usr_users` | `fayxzvov_alpha` | Quién registró. |
| `detail_inventory_inflow` | N : 1 | `inventory_inflow` | actual | Renglón pertenece a entrada. |
| `detail_inventory_inflow` | N : 1 | `order_products` | `fayxzvov_reginas` | Renglón referencia producto. |
| `inventory_shrinkage` | N : 1 | `shrinkage_reason` | actual | Motivo tipificado. |
| `inventory_shrinkage` | N : 1 | `warehouse` | actual | Almacén afectado. |
| `inventory_shrinkage` | N : 1 | `subsidiaries` | `fayxzvov_alpha` | Sucursal. |
| `inventory_shrinkage` | N : 1 | `usr_users` | `fayxzvov_alpha` | Quién registró. |
| `detail_inventory_shrinkage` | N : 1 | `inventory_shrinkage` | actual | Renglón. |
| `detail_inventory_shrinkage` | N : 1 | `order_products` | `fayxzvov_reginas` | Producto. |
| `inventory_transfer` | N : 1 | `transfer_status` | actual | Estado actual del traspaso. |
| `inventory_transfer` | N : 1 | `warehouse` (origen) | actual | Almacén origen. |
| `inventory_transfer` | N : 1 | `warehouse` (destino) | actual | Almacén destino. |
| `inventory_transfer` | N : 1 | `subsidiaries` (origen) | `fayxzvov_alpha` | Sucursal origen. |
| `inventory_transfer` | N : 1 | `subsidiaries` (destino) | `fayxzvov_alpha` | Sucursal destino. |
| `inventory_transfer` | N : 1 | `usr_users` (solicito) | `fayxzvov_alpha` | Solicitante. |
| `inventory_transfer` | N : 1 | `usr_users` (autorizo) | `fayxzvov_alpha` | Autorizador. |
| `detail_inventory_transfer` | N : 1 | `inventory_transfer` | actual | Renglón. |
| `detail_inventory_transfer` | N : 1 | `order_products` | `fayxzvov_reginas` | Producto. |
| `inventory_transfer_history` | N : 1 | `inventory_transfer` | actual | Timeline de transiciones. |
| `inventory_transfer_history` | N : 1 | `transfer_status` | actual | Estado al que transicionó. |
| `inventory_transfer_history` | N : 1 | `usr_users` | `fayxzvov_alpha` | Quién hizo la transición. |
| `inventory_adjustment` | N : 1 | `adjustment_reason` | actual | Motivo tipificado. |
| `inventory_adjustment` | N : 1 | `warehouse` | actual | Almacén ajustado. |
| `inventory_adjustment` | N : 1 | `subsidiaries` | `fayxzvov_alpha` | Sucursal. |
| `inventory_adjustment` | N : 1 | `usr_users` (registro) | `fayxzvov_alpha` | Quién registró. |
| `inventory_adjustment` | N : 1 | `usr_users` (autorizo) | `fayxzvov_alpha` | Quién autorizó (puede ser el mismo). |
| `detail_inventory_adjustment` | N : 1 | `inventory_adjustment` | actual | Renglón. |
| `detail_inventory_adjustment` | N : 1 | `order_products` | `fayxzvov_reginas` | Producto ajustado. |

---

## §3. DDL completo

### §3.1 Creación del esquema

```sql
CREATE DATABASE IF NOT EXISTS `fayxzvov_inventario`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `fayxzvov_inventario`;
```

### §3.2 Catálogos del módulo

```sql
-- ════════════════════════════════════════════════════════════════
--  warehouse — almacenes físicos por sucursal
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `warehouse` (
    `id`                  INT NOT NULL AUTO_INCREMENT,
    `name`                VARCHAR(120) NOT NULL,
    `address`             VARCHAR(255) NULL,
    `is_default_general`  TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Solo un warehouse por subsidiaries_id puede tener is_default_general=1',
    `active`              TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `warehouse_area_id`   INT NULL,
    `subsidiaries_id`     INT NOT NULL,
    `companies_id`        INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_warehouse_default_per_subsidiary` (`subsidiaries_id`, `is_default_general`),
    KEY `idx_warehouse_subsidiary` (`subsidiaries_id`),
    KEY `idx_warehouse_company` (`companies_id`),
    KEY `idx_warehouse_area` (`warehouse_area_id`),
    KEY `idx_warehouse_active` (`active`),
    CONSTRAINT `fk_warehouse_area`
        FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_warehouse_subsidiary`
        FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries`(`id`),
    CONSTRAINT `fk_warehouse_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  warehouse_area — áreas físicas: Refrigerados, Secos, Congelados
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `warehouse_area` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `name`         VARCHAR(80) NOT NULL,
    `description`  VARCHAR(255) NULL,
    `color_hex`    VARCHAR(7) NULL,
    `active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `companies_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_warehouse_area_name_company` (`name`, `companies_id`),
    KEY `idx_warehouse_area_company` (`companies_id`),
    CONSTRAINT `fk_warehouse_area_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  product_attribute — extensión 1:1 de fayxzvov_reginas.order_products
--  Contiene los datos inventory-specific que no caben en el catálogo POS.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `product_attribute` (
    `id`                INT NOT NULL AUTO_INCREMENT,
    `sku`               VARCHAR(40) NOT NULL,
    `cost_unit`         DOUBLE NOT NULL DEFAULT 0,
    `stock_min`         DOUBLE NOT NULL DEFAULT 0,
    `stock_max`         DOUBLE NOT NULL DEFAULT 0,
    `shelf_life_days`   INT NULL COMMENT 'Vida útil en días',
    `description`       VARCHAR(255) NULL,
    `active`            TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `order_product_id`  INT NOT NULL,
    `warehouse_area_id` INT NULL,
    `unit_id`           INT NOT NULL,
    `companies_id`      INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_product_attribute_order_product` (`order_product_id`),
    UNIQUE KEY `uq_product_attribute_sku_company` (`sku`, `companies_id`),
    KEY `idx_product_attribute_area` (`warehouse_area_id`),
    KEY `idx_product_attribute_unit` (`unit_id`),
    KEY `idx_product_attribute_company` (`companies_id`),
    KEY `idx_product_attribute_active` (`active`),
    CONSTRAINT `fk_product_attribute_order_product`
        FOREIGN KEY (`order_product_id`) REFERENCES `fayxzvov_reginas`.`order_products`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_product_attribute_area`
        FOREIGN KEY (`warehouse_area_id`) REFERENCES `warehouse_area`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_product_attribute_unit`
        FOREIGN KEY (`unit_id`) REFERENCES `unit`(`id`),
    CONSTRAINT `fk_product_attribute_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  supplier — proveedores externos
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `supplier` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `name`         VARCHAR(180) NOT NULL,
    `contact_name` VARCHAR(120) NULL,
    `phone`        VARCHAR(40) NULL,
    `email`        VARCHAR(120) NULL,
    `address`      VARCHAR(255) NULL,
    `rfc`          VARCHAR(13) NULL,
    `active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `companies_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_supplier_company` (`companies_id`),
    KEY `idx_supplier_active` (`active`),
    CONSTRAINT `fk_supplier_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  unit — unidades de medida (pza, kg, lt, caja, paquete)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `unit` (
    `id`          INT NOT NULL AUTO_INCREMENT,
    `code`        VARCHAR(10) NOT NULL COMMENT 'pza, kg, lt, caja, pq',
    `name`        VARCHAR(40) NOT NULL,
    `decimals`    TINYINT NOT NULL DEFAULT 0 COMMENT 'cuántos decimales se permiten para esta unidad',
    `active`      TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_unit_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inflow_origin — Produccion, Proveedor, Transferencia, Devolucion
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inflow_origin` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `code`         VARCHAR(30) NOT NULL,
    `name`         VARCHAR(80) NOT NULL,
    `icon`         VARCHAR(40) NULL,
    `color_hex`    VARCHAR(7) NULL,
    `requires_supplier` TINYINT(1) NOT NULL DEFAULT 0,
    `active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inflow_origin_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  shrinkage_reason — Caducidad, Daniado, Error produccion, Robo, ...
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `shrinkage_reason` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `code`         VARCHAR(30) NOT NULL,
    `name`         VARCHAR(80) NOT NULL,
    `icon`         VARCHAR(40) NULL,
    `color_hex`    VARCHAR(7) NULL,
    `active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shrinkage_reason_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  adjustment_reason — Faltante sin explicar, Conteo fisico, ...
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `adjustment_reason` (
    `id`           INT NOT NULL AUTO_INCREMENT,
    `code`         VARCHAR(30) NOT NULL,
    `name`         VARCHAR(80) NOT NULL,
    `icon`         VARCHAR(40) NULL,
    `color_hex`    VARCHAR(7) NULL,
    `affects_cost` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Si el ajuste contabiliza pérdida/ganancia',
    `active`       TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_adjustment_reason_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  transfer_status — Solicitado, Autorizado, En Transito, Recibido, Rechazado
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `transfer_status` (
    `id`            INT NOT NULL AUTO_INCREMENT,
    `code`          VARCHAR(30) NOT NULL,
    `name`          VARCHAR(60) NOT NULL,
    `order_index`   TINYINT NOT NULL DEFAULT 0 COMMENT 'Orden en el flujo (1=Solicitado, 2=Autorizado, ...)',
    `is_terminal`   TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si bloquea más transiciones (Recibido / Rechazado)',
    `color_hex`     VARCHAR(7) NULL,
    `active`        TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_transfer_status_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### §3.3 Stock (saldo vivo)

```sql
-- ════════════════════════════════════════════════════════════════
--  stock — saldo por producto / almacén
--  Actualizado por la capa de servicio cuando se aplica un evento.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `stock` (
    `id`                  INT NOT NULL AUTO_INCREMENT,
    `quantity`            DOUBLE NOT NULL DEFAULT 0,
    `last_movement_at`    DATETIME NULL,
    `last_inventory_at`   DATETIME NULL COMMENT 'Última vez que se hizo conteo físico',
    `active`              TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `order_product_id`    INT NOT NULL,
    `warehouse_id`        INT NOT NULL,
    `companies_id`        INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_stock_product_warehouse` (`order_product_id`, `warehouse_id`),
    KEY `idx_stock_warehouse` (`warehouse_id`),
    KEY `idx_stock_company` (`companies_id`),
    CONSTRAINT `fk_stock_product`
        FOREIGN KEY (`order_product_id`) REFERENCES `fayxzvov_reginas`.`order_products`(`id`),
    CONSTRAINT `fk_stock_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`),
    CONSTRAINT `fk_stock_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### §3.4 Eventos POS — pares raíz + renglones

#### §3.4.1 Entradas

```sql
-- ════════════════════════════════════════════════════════════════
--  inventory_inflow — entradas (ENT-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inventory_inflow` (
    `id`               INT NOT NULL AUTO_INCREMENT,
    `folio`            VARCHAR(20) NOT NULL,
    `date_inflow`      DATE NOT NULL,
    `time_inflow`      TIME NOT NULL,
    `note`             VARCHAR(500) NULL,
    `status`           ENUM('Pendiente','Aplicada','Reversada') NOT NULL DEFAULT 'Aplicada',
    `total_products`   INT NOT NULL DEFAULT 0,
    `total_units`      DOUBLE NOT NULL DEFAULT 0,
    `total_cost`       DOUBLE NOT NULL DEFAULT 0,
    `active`           TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `inflow_origin_id` INT NOT NULL,
    `warehouse_id`     INT NOT NULL,
    `supplier_id`      INT NULL,
    `subsidiaries_id`  INT NOT NULL,
    `user_id`          INT NOT NULL,
    `companies_id`     INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inflow_folio_company` (`folio`, `companies_id`),
    KEY `idx_inflow_date` (`date_inflow`),
    KEY `idx_inflow_origin` (`inflow_origin_id`),
    KEY `idx_inflow_warehouse` (`warehouse_id`),
    KEY `idx_inflow_supplier` (`supplier_id`),
    KEY `idx_inflow_subsidiary` (`subsidiaries_id`),
    KEY `idx_inflow_user` (`user_id`),
    KEY `idx_inflow_company` (`companies_id`),
    KEY `idx_inflow_status` (`status`),
    CONSTRAINT `fk_inflow_origin`
        FOREIGN KEY (`inflow_origin_id`) REFERENCES `inflow_origin`(`id`),
    CONSTRAINT `fk_inflow_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`),
    CONSTRAINT `fk_inflow_supplier`
        FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_inflow_subsidiary`
        FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries`(`id`),
    CONSTRAINT `fk_inflow_user`
        FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_inflow_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  detail_inventory_inflow — renglones de cada entrada
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `detail_inventory_inflow` (
    `id`                    INT NOT NULL AUTO_INCREMENT,
    `quantity`              DOUBLE NOT NULL,
    `cost_unit_snap`        DOUBLE NOT NULL COMMENT 'Snapshot del costo en el momento del registro',
    `subtotal`              DOUBLE NOT NULL,
    `previous_stock`        DOUBLE NOT NULL,
    `resulting_stock`       DOUBLE NOT NULL,
    `expires_at`            DATE NULL COMMENT 'Caducidad declarada al recibir',
    `batch_code`            VARCHAR(40) NULL COMMENT 'Lote del proveedor o producción',
    `active`                TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `inventory_inflow_id`   INT NOT NULL,
    `order_product_id`      INT NOT NULL,
    `unit_id`               INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_detail_inflow_root` (`inventory_inflow_id`),
    KEY `idx_detail_inflow_product` (`order_product_id`),
    KEY `idx_detail_inflow_unit` (`unit_id`),
    CONSTRAINT `fk_detail_inflow_root`
        FOREIGN KEY (`inventory_inflow_id`) REFERENCES `inventory_inflow`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_detail_inflow_product`
        FOREIGN KEY (`order_product_id`) REFERENCES `fayxzvov_reginas`.`order_products`(`id`),
    CONSTRAINT `fk_detail_inflow_unit`
        FOREIGN KEY (`unit_id`) REFERENCES `unit`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### §3.4.2 Mermas

```sql
-- ════════════════════════════════════════════════════════════════
--  inventory_shrinkage — mermas (M-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inventory_shrinkage` (
    `id`                  INT NOT NULL AUTO_INCREMENT,
    `folio`               VARCHAR(20) NOT NULL,
    `date_shrinkage`      DATE NOT NULL,
    `time_shrinkage`      TIME NOT NULL,
    `note`                VARCHAR(500) NULL,
    `evidence_url`        VARCHAR(255) NULL COMMENT 'Foto de la merma',
    `status`              ENUM('Aplicada','Reversada') NOT NULL DEFAULT 'Aplicada',
    `total_products`      INT NOT NULL DEFAULT 0,
    `total_units`         DOUBLE NOT NULL DEFAULT 0,
    `total_cost_loss`     DOUBLE NOT NULL DEFAULT 0,
    `active`              TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `shrinkage_reason_id` INT NOT NULL,
    `warehouse_id`        INT NOT NULL,
    `subsidiaries_id`     INT NOT NULL,
    `user_id`             INT NOT NULL,
    `companies_id`        INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shrinkage_folio_company` (`folio`, `companies_id`),
    KEY `idx_shrinkage_date` (`date_shrinkage`),
    KEY `idx_shrinkage_reason` (`shrinkage_reason_id`),
    KEY `idx_shrinkage_warehouse` (`warehouse_id`),
    KEY `idx_shrinkage_subsidiary` (`subsidiaries_id`),
    KEY `idx_shrinkage_user` (`user_id`),
    KEY `idx_shrinkage_company` (`companies_id`),
    KEY `idx_shrinkage_status` (`status`),
    CONSTRAINT `fk_shrinkage_reason`
        FOREIGN KEY (`shrinkage_reason_id`) REFERENCES `shrinkage_reason`(`id`),
    CONSTRAINT `fk_shrinkage_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`),
    CONSTRAINT `fk_shrinkage_subsidiary`
        FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries`(`id`),
    CONSTRAINT `fk_shrinkage_user`
        FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_shrinkage_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  detail_inventory_shrinkage — renglones de cada merma
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `detail_inventory_shrinkage` (
    `id`                       INT NOT NULL AUTO_INCREMENT,
    `quantity`                 DOUBLE NOT NULL,
    `cost_unit_snap`           DOUBLE NOT NULL,
    `subtotal_loss`            DOUBLE NOT NULL,
    `previous_stock`           DOUBLE NOT NULL,
    `resulting_stock`          DOUBLE NOT NULL,
    `active`                   TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `inventory_shrinkage_id`   INT NOT NULL,
    `order_product_id`         INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_detail_shrinkage_root` (`inventory_shrinkage_id`),
    KEY `idx_detail_shrinkage_product` (`order_product_id`),
    CONSTRAINT `fk_detail_shrinkage_root`
        FOREIGN KEY (`inventory_shrinkage_id`) REFERENCES `inventory_shrinkage`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_detail_shrinkage_product`
        FOREIGN KEY (`order_product_id`) REFERENCES `fayxzvov_reginas`.`order_products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### §3.4.3 Traspasos

```sql
-- ════════════════════════════════════════════════════════════════
--  inventory_transfer — traspasos entre sucursales (TRA-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inventory_transfer` (
    `id`                       INT NOT NULL AUTO_INCREMENT,
    `folio`                    VARCHAR(20) NOT NULL,
    `date_request`             DATETIME NOT NULL,
    `date_authorized`          DATETIME NULL,
    `date_sent`                DATETIME NULL,
    `date_received`            DATETIME NULL,
    `note`                     VARCHAR(500) NULL,
    `total_products`           INT NOT NULL DEFAULT 0,
    `total_units`              DOUBLE NOT NULL DEFAULT 0,
    `total_cost`               DOUBLE NOT NULL DEFAULT 0,
    `active`                   TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`               DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `transfer_status_id`       INT NOT NULL,
    `origin_warehouse_id`      INT NOT NULL,
    `destination_warehouse_id` INT NOT NULL,
    `origin_subsidiaries_id`   INT NOT NULL,
    `destination_subsidiaries_id` INT NOT NULL,
    `requested_user_id`        INT NOT NULL,
    `authorized_user_id`       INT NULL,
    `received_user_id`         INT NULL,
    `companies_id`             INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_transfer_folio_company` (`folio`, `companies_id`),
    KEY `idx_transfer_status` (`transfer_status_id`),
    KEY `idx_transfer_origin_wh` (`origin_warehouse_id`),
    KEY `idx_transfer_dest_wh` (`destination_warehouse_id`),
    KEY `idx_transfer_origin_sub` (`origin_subsidiaries_id`),
    KEY `idx_transfer_dest_sub` (`destination_subsidiaries_id`),
    KEY `idx_transfer_requested_user` (`requested_user_id`),
    KEY `idx_transfer_authorized_user` (`authorized_user_id`),
    KEY `idx_transfer_received_user` (`received_user_id`),
    KEY `idx_transfer_company` (`companies_id`),
    KEY `idx_transfer_date_request` (`date_request`),
    CONSTRAINT `fk_transfer_status`
        FOREIGN KEY (`transfer_status_id`) REFERENCES `transfer_status`(`id`),
    CONSTRAINT `fk_transfer_origin_wh`
        FOREIGN KEY (`origin_warehouse_id`) REFERENCES `warehouse`(`id`),
    CONSTRAINT `fk_transfer_dest_wh`
        FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouse`(`id`),
    CONSTRAINT `fk_transfer_origin_sub`
        FOREIGN KEY (`origin_subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries`(`id`),
    CONSTRAINT `fk_transfer_dest_sub`
        FOREIGN KEY (`destination_subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries`(`id`),
    CONSTRAINT `fk_transfer_requested_user`
        FOREIGN KEY (`requested_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_transfer_authorized_user`
        FOREIGN KEY (`authorized_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_transfer_received_user`
        FOREIGN KEY (`received_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_transfer_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  detail_inventory_transfer — renglones de cada traspaso
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `detail_inventory_transfer` (
    `id`                       INT NOT NULL AUTO_INCREMENT,
    `quantity`                 DOUBLE NOT NULL,
    `cost_unit_snap`           DOUBLE NOT NULL,
    `subtotal`                 DOUBLE NOT NULL,
    `origin_stock_prev`        DOUBLE NOT NULL,
    `origin_stock_post`        DOUBLE NOT NULL,
    `destination_stock_prev`   DOUBLE NULL COMMENT 'Se llena al recibir',
    `destination_stock_post`   DOUBLE NULL,
    `active`                   TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `inventory_transfer_id`    INT NOT NULL,
    `order_product_id`         INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_detail_transfer_root` (`inventory_transfer_id`),
    KEY `idx_detail_transfer_product` (`order_product_id`),
    CONSTRAINT `fk_detail_transfer_root`
        FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfer`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_detail_transfer_product`
        FOREIGN KEY (`order_product_id`) REFERENCES `fayxzvov_reginas`.`order_products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inventory_transfer_history — timeline de transiciones del flujo
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inventory_transfer_history` (
    `id`                      INT NOT NULL AUTO_INCREMENT,
    `note`                    VARCHAR(500) NULL,
    `transitioned_at`         DATETIME NOT NULL,
    `active`                  TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `inventory_transfer_id`   INT NOT NULL,
    `transfer_status_id`      INT NOT NULL,
    `user_id`                 INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_transfer_history_transfer` (`inventory_transfer_id`),
    KEY `idx_transfer_history_status` (`transfer_status_id`),
    KEY `idx_transfer_history_user` (`user_id`),
    KEY `idx_transfer_history_date` (`transitioned_at`),
    CONSTRAINT `fk_transfer_history_transfer`
        FOREIGN KEY (`inventory_transfer_id`) REFERENCES `inventory_transfer`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_transfer_history_status`
        FOREIGN KEY (`transfer_status_id`) REFERENCES `transfer_status`(`id`),
    CONSTRAINT `fk_transfer_history_user`
        FOREIGN KEY (`user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### §3.4.4 Ajustes

```sql
-- ════════════════════════════════════════════════════════════════
--  inventory_adjustment — ajustes (AJU-#### / INV-FIS-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inventory_adjustment` (
    `id`                       INT NOT NULL AUTO_INCREMENT,
    `folio`                    VARCHAR(20) NOT NULL,
    `date_adjustment`          DATE NOT NULL,
    `time_adjustment`          TIME NOT NULL,
    `note`                     VARCHAR(500) NULL,
    `adjustment_type`          ENUM('individual','fisico') NOT NULL DEFAULT 'individual',
    `status`                   ENUM('Pendiente','Aplicado','Reversado') NOT NULL DEFAULT 'Aplicado',
    `total_products`           INT NOT NULL DEFAULT 0,
    `total_diff_units`         DOUBLE NOT NULL DEFAULT 0,
    `total_diff_cost`          DOUBLE NOT NULL DEFAULT 0,
    `active`                   TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`               DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `adjustment_reason_id`     INT NOT NULL,
    `warehouse_id`             INT NOT NULL,
    `subsidiaries_id`          INT NOT NULL,
    `registered_user_id`       INT NOT NULL,
    `authorized_user_id`       INT NULL,
    `companies_id`             INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_adjustment_folio_company` (`folio`, `companies_id`),
    KEY `idx_adjustment_date` (`date_adjustment`),
    KEY `idx_adjustment_reason` (`adjustment_reason_id`),
    KEY `idx_adjustment_warehouse` (`warehouse_id`),
    KEY `idx_adjustment_subsidiary` (`subsidiaries_id`),
    KEY `idx_adjustment_registered_user` (`registered_user_id`),
    KEY `idx_adjustment_authorized_user` (`authorized_user_id`),
    KEY `idx_adjustment_company` (`companies_id`),
    KEY `idx_adjustment_type` (`adjustment_type`),
    KEY `idx_adjustment_status` (`status`),
    CONSTRAINT `fk_adjustment_reason`
        FOREIGN KEY (`adjustment_reason_id`) REFERENCES `adjustment_reason`(`id`),
    CONSTRAINT `fk_adjustment_warehouse`
        FOREIGN KEY (`warehouse_id`) REFERENCES `warehouse`(`id`),
    CONSTRAINT `fk_adjustment_subsidiary`
        FOREIGN KEY (`subsidiaries_id`) REFERENCES `fayxzvov_alpha`.`subsidiaries`(`id`),
    CONSTRAINT `fk_adjustment_registered_user`
        FOREIGN KEY (`registered_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_adjustment_authorized_user`
        FOREIGN KEY (`authorized_user_id`) REFERENCES `fayxzvov_alpha`.`usr_users`(`id`),
    CONSTRAINT `fk_adjustment_company`
        FOREIGN KEY (`companies_id`) REFERENCES `fayxzvov_admin`.`companies`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  detail_inventory_adjustment — renglones de cada ajuste
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `detail_inventory_adjustment` (
    `id`                       INT NOT NULL AUTO_INCREMENT,
    `system_quantity`          DOUBLE NOT NULL COMMENT 'Lo que el sistema decía',
    `physical_quantity`        DOUBLE NOT NULL COMMENT 'Lo que se contó físicamente',
    `difference`               DOUBLE NOT NULL COMMENT '+ sobrante / - faltante',
    `cost_unit_snap`           DOUBLE NOT NULL,
    `cost_diff`                DOUBLE NOT NULL,
    `previous_stock`           DOUBLE NOT NULL,
    `resulting_stock`          DOUBLE NOT NULL,
    `active`                   TINYINT(1) NOT NULL DEFAULT 1,
    `created_at`               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `inventory_adjustment_id`  INT NOT NULL,
    `order_product_id`         INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_detail_adjustment_root` (`inventory_adjustment_id`),
    KEY `idx_detail_adjustment_product` (`order_product_id`),
    CONSTRAINT `fk_detail_adjustment_root`
        FOREIGN KEY (`inventory_adjustment_id`) REFERENCES `inventory_adjustment`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_detail_adjustment_product`
        FOREIGN KEY (`order_product_id`) REFERENCES `fayxzvov_reginas`.`order_products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### §3.5 Bitácora unificada (vista)

```sql
-- ════════════════════════════════════════════════════════════════
--  inventory_movement — vista que une TODOS los eventos como
--  filas individuales para el visor de Movimientos.
--  Cada UNION genera una fila por renglón.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW `inventory_movement` AS

    -- Entradas
    SELECT
        CONCAT('IN-', d.id)                 AS movement_uid,
        'ENTRADA'                           AS movement_type,
        r.folio                             AS folio,
        d.order_product_id                  AS order_product_id,
        d.quantity                          AS quantity,
        d.previous_stock                    AS stock_prev,
        d.resulting_stock                   AS stock_post,
        d.cost_unit_snap                    AS cost_unit,
        d.subtotal                          AS cost_total,
        CONCAT(r.date_inflow, ' ', r.time_inflow) AS occurred_at,
        r.warehouse_id                      AS warehouse_id,
        r.subsidiaries_id                   AS subsidiaries_id,
        r.user_id                           AS user_id,
        r.note                              AS note,
        r.status                            AS status,
        r.companies_id                      AS companies_id
    FROM `detail_inventory_inflow` d
    JOIN `inventory_inflow` r ON r.id = d.inventory_inflow_id
    WHERE d.active = 1 AND r.active = 1

    UNION ALL

    -- Mermas
    SELECT
        CONCAT('SH-', d.id),
        'MERMA',
        r.folio,
        d.order_product_id,
        d.quantity,
        d.previous_stock,
        d.resulting_stock,
        d.cost_unit_snap,
        d.subtotal_loss,
        CONCAT(r.date_shrinkage, ' ', r.time_shrinkage),
        r.warehouse_id,
        r.subsidiaries_id,
        r.user_id,
        r.note,
        r.status,
        r.companies_id
    FROM `detail_inventory_shrinkage` d
    JOIN `inventory_shrinkage` r ON r.id = d.inventory_shrinkage_id
    WHERE d.active = 1 AND r.active = 1

    UNION ALL

    -- Traspasos (origen y destino se ven como filas separadas)
    SELECT
        CONCAT('TR-OUT-', d.id),
        'TRANSFERENCIA',
        r.folio,
        d.order_product_id,
        -d.quantity,                            -- salida del origen
        d.origin_stock_prev,
        d.origin_stock_post,
        d.cost_unit_snap,
        -d.subtotal,
        r.date_sent,
        r.origin_warehouse_id,
        r.origin_subsidiaries_id,
        r.requested_user_id,
        r.note,
        ts.code,
        r.companies_id
    FROM `detail_inventory_transfer` d
    JOIN `inventory_transfer` r ON r.id = d.inventory_transfer_id
    JOIN `transfer_status` ts ON ts.id = r.transfer_status_id
    WHERE d.active = 1 AND r.active = 1 AND r.date_sent IS NOT NULL

    UNION ALL

    SELECT
        CONCAT('TR-IN-', d.id),
        'TRANSFERENCIA',
        r.folio,
        d.order_product_id,
        d.quantity,
        d.destination_stock_prev,
        d.destination_stock_post,
        d.cost_unit_snap,
        d.subtotal,
        r.date_received,
        r.destination_warehouse_id,
        r.destination_subsidiaries_id,
        r.received_user_id,
        r.note,
        ts.code,
        r.companies_id
    FROM `detail_inventory_transfer` d
    JOIN `inventory_transfer` r ON r.id = d.inventory_transfer_id
    JOIN `transfer_status` ts ON ts.id = r.transfer_status_id
    WHERE d.active = 1 AND r.active = 1 AND r.date_received IS NOT NULL

    UNION ALL

    -- Ajustes
    SELECT
        CONCAT('AD-', d.id),
        'AJUSTE',
        r.folio,
        d.order_product_id,
        d.difference,
        d.previous_stock,
        d.resulting_stock,
        d.cost_unit_snap,
        d.cost_diff,
        CONCAT(r.date_adjustment, ' ', r.time_adjustment),
        r.warehouse_id,
        r.subsidiaries_id,
        r.registered_user_id,
        r.note,
        r.status,
        r.companies_id
    FROM `detail_inventory_adjustment` d
    JOIN `inventory_adjustment` r ON r.id = d.inventory_adjustment_id
    WHERE d.active = 1 AND r.active = 1;
```

### §3.6 Seeds básicos

```sql
-- ════════════════════════════════════════════════════════════════
--  Catálogos sembrados — alineados con los SAMPLE_* del módulo
-- ════════════════════════════════════════════════════════════════

INSERT INTO `unit` (`code`, `name`, `decimals`) VALUES
    ('pza',  'Pieza',     0),
    ('kg',   'Kilogramo', 3),
    ('lt',   'Litro',     3),
    ('caja', 'Caja',      0),
    ('pq',   'Paquete',   0),
    ('m',    'Metro',     2);

INSERT INTO `inflow_origin` (`code`, `name`, `icon`, `color_hex`, `requires_supplier`) VALUES
    ('PRODUCTION',    'Produccion',    'factory',  '#A78BFA', 0),
    ('SUPPLIER',      'Proveedor',     'truck',    '#FBBF24', 1),
    ('TRANSFER_IN',   'Transferencia', 'arrow-left-right', '#60A5FA', 0),
    ('RETURN',        'Devolucion',    'undo',     '#F43F5E', 0);

INSERT INTO `shrinkage_reason` (`code`, `name`, `icon`, `color_hex`) VALUES
    ('EXPIRY',         'Caducidad',         'calendar-x',     '#E02424'),
    ('DAMAGED',        'Daniado',           'package-x',      '#FBBF24'),
    ('PRODUCTION_ERR', 'Error produccion',  'flame',          '#1C64F2'),
    ('THEFT',          'Robo/Faltante',     'shield-alert',   '#7C3AED'),
    ('CUSTOMER_RET',   'Devolucion',        'rotate-ccw',     '#3FC189');

INSERT INTO `adjustment_reason` (`code`, `name`, `icon`, `color_hex`, `affects_cost`) VALUES
    ('MISSING',          'Faltante sin explicar',    'minus-circle',  '#F43F5E', 1),
    ('UNRECORDED_IN',    'Entrada no registrada',    'plus-circle',   '#3FC189', 1),
    ('UNRECORDED_OUT',   'Entregados sin registrar', 'arrow-up-right','#FBBF24', 1),
    ('MONTH_CLOSE',      'Cierre mensual',           'calendar-check','#A78BFA', 0),
    ('FOUND_PRODUCT',    'Producto encontrado',      'search-check',  '#60A5FA', 1),
    ('PHYSICAL_COUNT',   'Conteo fisico',            'clipboard-check','#A78BFA', 1),
    ('ADMIN_CORRECTION', 'Correccion administrativa','file-edit',     '#D1D5DB', 0);

INSERT INTO `transfer_status` (`code`, `name`, `order_index`, `is_terminal`, `color_hex`) VALUES
    ('REQUESTED',  'Solicitado',  1, 0, '#FBBF24'),
    ('AUTHORIZED', 'Autorizado',  2, 0, '#A78BFA'),
    ('IN_TRANSIT', 'En Transito', 3, 0, '#FB923C'),
    ('RECEIVED',   'Recibido',    4, 1, '#3FC189'),
    ('REJECTED',   'Rechazado',   99,1, '#F43F5E');

-- warehouse_area sembrado para Reginas (companies_id = 4)
INSERT INTO `warehouse_area` (`name`, `description`, `color_hex`, `companies_id`) VALUES
    ('Refrigerados', 'Lácteos, frutas frescas, productos perecederos', '#60A5FA', 4),
    ('Secos',        'Harinas, granos, conservas, pan',                '#FB923C', 4),
    ('Congelados',   'Productos congelados',                           '#22D3EE', 4);
```

### §3.7 Tablas paralelas para dimensión Insumos (esquema — Fase 2)

> Estas tablas se generan **solo cuando se active** el módulo de Insumos. Mismo patrón que las POS; cambian el catálogo base (`supply` autónomo, no referencia `order_products`) y los catálogos satélites. El DDL detallado vive en [plan/propuesta-salida-insumos.md §4](../plan/propuesta-salida-insumos.md).

```
supply (catálogo autónomo)
supply_category (sub-catálogo)
consumption_area (sub-catálogo: Cocina, Barra, Panaderia)
outflow_reason (sub-catálogo: Consumo interno, Donativo, Baja, ...)

supply_inflow + detail_supply_inflow          -- ENT-INS-####
supply_outflow + detail_supply_outflow        -- SAL-INS-####  (solo en scope=supply)
supply_shrinkage + detail_supply_shrinkage    -- MER-INS-####
supply_transfer + detail_supply_transfer      -- TRA-INS-####
supply_adjustment + detail_supply_adjustment  -- AJU-INS-####

supply_stock (saldo: supply_id + warehouse_id + quantity)
```

---

## §4. Auto-revisión (checklist db-rules)

| Regla | Estado | Notas |
|---|---|---|
| **Singular inglés snake_case** | ✅ | Todas las tablas en singular: `warehouse`, `inventory_inflow`, `detail_inventory_inflow`. |
| **`detail_` solo en renglones de raíz** | ✅ | Solo `detail_inventory_inflow`, `detail_inventory_shrinkage`, `detail_inventory_transfer`, `detail_inventory_adjustment`. Sub-catálogos (`shrinkage_reason`, `inflow_origin`, etc.) NO usan prefijo `detail_`. |
| **Montos en DOUBLE** | ✅ | `cost_unit`, `cost_unit_snap`, `subtotal`, `total_cost`, `subtotal_loss`, `total_diff_cost` — todos DOUBLE. |
| **FKs al final (después de active + timestamps)** | ✅ | Patrón aplicado consistentemente: campos de negocio → `active` → `created_at` → `updated_at` → FKs (`*_id`). |
| **Columnas obligatorias `active` + `created_at`** | ✅ | Presentes en todas las tablas (catálogos, raíces y detalles). |
| **`updated_at` con ON UPDATE CURRENT_TIMESTAMP** | ✅ | En tablas mutables (warehouse, product_attribute, eventos raíz). |
| **InnoDB + utf8mb4_0900_ai_ci** | ✅ | Declarado en todas las tablas y a nivel CREATE DATABASE. |
| **Cross-schema FKs identificadas** | ✅ | `subsidiaries_id`, `companies_id`, `user_id` y `order_product_id` referencian otros esquemas. Constraints declaradas (`fayxzvov_alpha.subsidiaries`, `fayxzvov_admin.companies`, `fayxzvov_alpha.usr_users`, `fayxzvov_reginas.order_products`). |
| **Excepción a la regla singular para FKs cross-schema** | ⚠️ | Se mantienen `subsidiaries_id` y `companies_id` plurales por consistencia con el ecosistema ya en producción. Las FKs propias del esquema sí siguen singular (`product_id`, `warehouse_id`, etc.). Documentado en §1. |
| **Unique keys donde aplica** | ✅ | `(folio, companies_id)` por evento, `(sku, companies_id)` en product_attribute, `(order_product_id, warehouse_id)` en stock, `(subsidiaries_id, is_default_general)` para almacén general único. |
| **Indices en columnas filtrables** | ✅ | `date_*`, `status`, FKs y `active` indexados en cada raíz. |
| **ON DELETE / ON UPDATE explícitos** | ✅ | CASCADE en raíz→detalle. SET NULL en FKs opcionales (supplier_id, warehouse_area_id). RESTRICT/default en cross-schema (no propagar borrados desde otros esquemas). |
| **Bitácora unificada como vista** | ✅ | `inventory_movement` es VIEW (no materializada). Evita drift. Si crece mucho, migrar a tabla materializada con triggers. |
| **Snapshots por renglón** | ✅ | Cada `detail_*` guarda `previous_stock`, `resulting_stock`, `cost_unit_snap` para auditoría. |
| **ENUMs para estados internos del módulo** | ✅ | Status de eventos: `inflow.status`, `shrinkage.status`, `adjustment.status`. Estados del traspaso son catálogo (`transfer_status`) porque tienen flujo. |
| **No se duplica catálogo POS** | ✅ | `product_attribute` extiende `order_products` 1:1 vía FK cross-schema. |
| **Folios prefijados por tipo** | ✅ | `ENT-`, `M-`, `TRA-`, `AJU-`, `INV-FIS-` documentados. UNIQUE por `(folio, companies_id)`. |
| **Timestamps de auditoría** | ✅ | `created_at` en todas; `updated_at` en mutables; campos de fecha de evento separados de `created_at` (date_inflow + time_inflow vs created_at). |
| **Cardinalidad documentada** | ✅ | Tabla aparte en §2.bis con todas las relaciones y cardinalidades. |
| **Diagrama texto plano según regla §2.bis** | ✅ | Cajas doble borde para esquema actual, simple para cross-schema, cardinalidades pegadas a flechas, tabla de cardinalidades aparte. |

### Desviaciones declaradas

1. **Plural en FKs cross-schema (`subsidiaries_id`, `companies_id`)** — se respeta la convención de producción del ecosistema en lugar de la regla teórica. Es consistencia local > pureza del manual.
2. **Bitácora como VIEW en lugar de tabla** — decisión deliberada para evitar mantenimiento dual. Si performance lo exige, se migrará a tabla materializada actualizada por triggers en cada evento.
3. **Salidas POS no tienen tabla propia** — se materializan al lado de Ventas (módulo `app/ventas` o similar). El visor de Movimientos podrá hacer UNION con esa tabla cuando exista.

---

## §5. Notas de implementación

### §5.1 Triggers / lógica de aplicación

Cuando un evento pasa a `Aplicada` / `Aplicado`, la capa de servicio debe:

1. Validar que el stock origen sea suficiente (en mermas, traspasos, salidas).
2. Generar las filas `detail_*` con `previous_stock` y `resulting_stock` calculados.
3. Actualizar `stock.quantity` por cada par `(order_product_id, warehouse_id)`.
4. Tocar `stock.last_movement_at = NOW()`.
5. Recalcular totales del header (`total_units`, `total_cost`, etc.).

Si se reversa, generar un evento espejo automático (no borrar). Documentar `note = 'Reverso de [folio]'`.

### §5.2 Folios secuenciales

Recomendación: secuencias por empresa + tipo:

```sql
CREATE TABLE folio_sequence (
    companies_id  INT NOT NULL,
    sequence_code VARCHAR(20) NOT NULL,  -- 'ENT', 'M', 'TRA', 'AJU', 'INV-FIS'
    last_number   INT NOT NULL DEFAULT 0,
    PRIMARY KEY (companies_id, sequence_code)
) ENGINE=InnoDB;
```

Cada `INSERT` en una tabla raíz hace primero un `UPDATE folio_sequence SET last_number = LAST_INSERT_ID(last_number + 1) WHERE companies_id = ? AND sequence_code = ?` y compone el folio.

### §5.3 Migración desde SAMPLE_*

Para sembrar productos reales:

```sql
-- product_attribute para todos los productos de Reginas (companies_id=4)
INSERT INTO product_attribute (sku, cost_unit, stock_min, stock_max, shelf_life_days,
                               order_product_id, warehouse_area_id, unit_id, companies_id)
SELECT
    CONCAT('RG-', LPAD(op.id, 3, '0')) AS sku,
    op.price * 0.55                    AS cost_unit,    -- margen estimado
    CASE op.category_id
        WHEN 1 THEN 8 WHEN 2 THEN 5 WHEN 3 THEN 12 ELSE 20
    END AS stock_min,
    CASE op.category_id
        WHEN 1 THEN 40 WHEN 2 THEN 30 WHEN 3 THEN 80 ELSE 200
    END AS stock_max,
    CASE op.category_id
        WHEN 1 THEN 5 WHEN 8 THEN 30 ELSE 7
    END AS shelf_life_days,
    op.id,
    NULL,  -- warehouse_area_id se asigna manualmente
    1,     -- unit_id = 'pza' por default
    4
FROM fayxzvov_reginas.order_products op
WHERE op.subsidiaries_id = 4 AND op.active = 1;
```

### §5.4 Consultas tipo

**Stock total por sucursal:**
```sql
SELECT s.quantity, w.name AS warehouse, sub.name AS subsidiary, op.name AS product
FROM stock s
JOIN warehouse w ON w.id = s.warehouse_id
JOIN fayxzvov_alpha.subsidiaries sub ON sub.id = w.subsidiaries_id
JOIN fayxzvov_reginas.order_products op ON op.id = s.order_product_id
WHERE sub.id = :subsidiary_id;
```

**Productos en stock bajo:**
```sql
SELECT op.name, pa.sku, s.quantity, pa.stock_min, w.name AS warehouse
FROM stock s
JOIN product_attribute pa ON pa.order_product_id = s.order_product_id
JOIN fayxzvov_reginas.order_products op ON op.id = s.order_product_id
JOIN warehouse w ON w.id = s.warehouse_id
WHERE s.quantity < pa.stock_min AND s.active = 1;
```

**Bitácora del producto:**
```sql
SELECT *
FROM inventory_movement
WHERE order_product_id = :product_id
ORDER BY occurred_at DESC
LIMIT 50;
```

---

## §6. Preguntas abiertas

1. **¿Confirmar `companies_id = 4` para Reginas?** Inspección dice sí (todas las sucursales activas de Reginas cuelgan de companies_id=4).

2. **¿`product_attribute` se considera "extensión" o "catálogo"?** Si crece (color, imagen, código de barras adicional, supplier preferido), puede absorber más responsabilidades y replantear si conviene migrar el catálogo de productos POS a este esquema. **Recomendación inicial:** mantenerlo como extensión 1:1 para no acoplar.

3. **¿Cómo se integran las SALIDAS POS?** Hoy se generan vía Ventas. Cuando el módulo Ventas tenga tabla `pos_order_item` con stock impact, conviene:
   - Opción A: agregarla al UNION ALL de la vista `inventory_movement`.
   - Opción B: trigger en `pos_order_item` que inserte un row dummy en una tabla `inventory_outflow + detail_inventory_outflow` para mantener todo en este esquema.

4. **¿Quién actualiza `stock`?** Capa de aplicación (PHP) o trigger MySQL. Recomendación: capa de aplicación (más controlable, testeable, permite validaciones complejas como verificar autorizaciones).

5. **¿Activar dimensión Insumos en esta iteración o dejarlo para Fase 2?** El plan ya está; el DDL adicional son ~9 tablas más. Decisión del usuario.

6. **¿Cross-schema `user_id` referencia a `fayxzvov_alpha.usr_users` o a `fayxzvov_rrhh.rrhh_empleados`?** Hoy se asume `usr_users` (quien tiene sesión en el sistema). El nexo con empleado se hace vía `rrhh_empleados.usr_users_id`. Si en algún submódulo se quiere registrar al empleado físico (no el usuario), agregar columna `employee_id` opcional.

7. **¿Eliminar `inventory_inflow.supplier_id` o hacerlo obligatorio cuando `inflow_origin.code = 'SUPPLIER'`?** Validar en capa de aplicación. La constraint `requires_supplier` en `inflow_origin` permite hacer esa validación dinámica.

---

## §7. Resumen final

15 tablas nuevas en el esquema `fayxzvov_inventario` + 1 vista de bitácora, todas respetando convenciones del manual `db-rules.md` con dos desviaciones declaradas (plural en FKs cross-schema, bitácora como vista). Catálogo de productos POS se respeta vía FK cross-schema a `fayxzvov_reginas.order_products` sin duplicar. La propuesta cubre el 100% del flujo POS observado en el código (entradas, mermas, traspasos, ajustes) y deja sembrada la extensión paralela para Insumos como Fase 2. Cuenta con seeds para arranque y queries de referencia para los visores existentes.

— **Coffee Intelligence 🧠☕**
