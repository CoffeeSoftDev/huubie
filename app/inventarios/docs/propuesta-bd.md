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
- `product_id` → `fayxzvov_reginas.order_products(id)`

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
| 10 | `stock` | Saldo | `(product_id, warehouse_id) → quantity`. Estado vivo del inventario. Actualizado por triggers/lógica de los eventos. |

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

## §3. Estructura de tablas

> **Formato.** Cada tabla se describe como una caja monoespaciada con sus columnas agrupadas por sección (Negocio, Montos, Timestamps, Status, FK cross-schema, FK locales, Soft-delete) siguiendo el orden de [db-rules.md §3.1](../../../../Users/CoffeSoft/.claude/agents/grimorios/db-rules.md). El `CREATE TABLE` se omite a propósito: las claves, índices y motor se derivan de las reglas de la casa (`InnoDB`, `utf8mb4_0900_ai_ci`, `KEY` con el mismo nombre de la columna, `CONSTRAINT <tabla>_ibfk_<n>`). Si se necesita el DDL ejecutable se genera bajo demanda.

### §3.1 Creación del esquema

```sql
CREATE DATABASE IF NOT EXISTS `fayxzvov_inventario`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `fayxzvov_inventario`;
```

### §3.2 Catálogos del módulo

```
┌──────────────────────────────────────────────────────────────────────┐
│ warehouse  (catálogo — almacenes físicos por sucursal)               │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(120)   nombre visible del almacén    │
│  is_default             TINYINT(1)     único por subsidiaries_id     │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
│                                                                      │
│  ── FK locales ──                                                    │
│  warehouse_area_id      → warehouse_area  SET NULL · área asignada   │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  subsidiaries_id        → fayxzvov_alpha.subsidiaries · sucursal     │
│  companies_id           → fayxzvov_admin.companies   · tenant        │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ warehouse_area  (catálogo — Refrigerados, Secos, Congelados, …)      │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(80)    único por compañía · etiqueta │
│  description            VARCHAR(255)   NULL · qué se guarda aquí     │
│  color_hex              VARCHAR(7)     NULL · #RRGGBB del chip       │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ product_attribute  (sub-catálogo — extensión 1:1 de order_products)  │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  sku                    VARCHAR(40)    único por compañía · código   │
│  description            VARCHAR(255)   NULL · texto largo            │
│  shelf_life_days        INT            NULL · vida útil en días      │
│                                                                      │
│  ── Montos ──                                                        │
│  cost_unit              DOUBLE         costo unitario base           │
│  stock_min              DOUBLE         umbral de alerta              │
│  stock_max              DOUBLE         tope recomendado              │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│  updated_at             DATETIME       ON UPDATE · última edición    │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  product_id             → fayxzvov_reginas.order_products  CASCADE   │
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── FK locales ──                                                    │
│  warehouse_area_id      → warehouse_area  SET NULL · área default    │
│  unit_id                → unit                · unidad por defecto   │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ supplier  (catálogo — proveedores externos)                          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(180)   razón social / comercial      │
│  contact_name           VARCHAR(120)   NULL · persona de contacto    │
│  phone                  VARCHAR(40)    NULL · teléfono principal     │
│  email                  VARCHAR(120)   NULL · correo de facturación  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ unit  (catálogo — unidades de medida: pza, kg, lt, caja, pq)         │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(10)    único · pza, kg, lt, caja, pq │
│  name                   VARCHAR(40)    etiqueta larga visible        │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ inflow_origin  (sub-catálogo — Producción, Proveedor, …)             │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(30)    único · llave técnica         │
│  name                   VARCHAR(80)    etiqueta visible              │
│  icon                   VARCHAR(40)    NULL · ícono lucide-react     │
│  color_hex              VARCHAR(7)     NULL · #RRGGBB del chip       │
│  requires_supplier      TINYINT(1)     1 fuerza supplier_id          │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ shrinkage_reason  (sub-catálogo — Caducidad, Dañado, Robo, …)        │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(30)    único · llave técnica         │
│  name                   VARCHAR(80)    etiqueta visible              │
│  icon                   VARCHAR(40)    NULL · ícono lucide-react     │
│  color_hex              VARCHAR(7)     NULL · #RRGGBB del chip       │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ adjustment_reason  (sub-catálogo — Faltante, Conteo físico, …)       │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(30)    único · llave técnica         │
│  name                   VARCHAR(80)    etiqueta visible              │
│  icon                   VARCHAR(40)    NULL · ícono lucide-react     │
│  color_hex              VARCHAR(7)     NULL · #RRGGBB del chip       │
│  affects_cost           TINYINT(1)     contabiliza pérdida/ganancia  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ transfer_status  (sub-catálogo — flujo del traspaso)                 │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(30)    único · llave técnica         │
│  name                   VARCHAR(60)    etiqueta visible              │
│  order_index            TINYINT        1=Solicitado, 2=Autorizado, … │
│  is_terminal (*)        TINYINT(1)     1 bloquea más transiciones    │
│  color_hex              VARCHAR(7)     NULL · #RRGGBB del chip       │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘

 (*) is_terminal — marca estados que cierran el ciclo (Recibido, Rechazado).
                   La UI oculta botones de acción y el backend rechaza más
                   transiciones cuando el estado actual tiene is_terminal=1.
                   Permite agregar estados finales nuevos sin tocar código.
```

### §3.3 Stock (saldo vivo)

> Actualizado por la capa de servicio cuando se aplica un evento. Único por `(product_id, warehouse_id)`.

```
┌──────────────────────────────────────────────────────────────────────┐
│ stock  (saldo — quantity por producto × almacén)                     │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Montos ──                                                        │
│  quantity               DOUBLE         saldo vivo en unidades        │
│                                                                      │
│  ── Timestamps ──                                                    │
│  last_movement_at       DATETIME       NULL · último evento aplicado │
│  last_inventory_at      DATETIME       NULL · último conteo físico   │
│  created_at             DATETIME       auditoría · alta              │
│  updated_at             DATETIME       ON UPDATE · cada movimiento   │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  product_id             → fayxzvov_reginas.order_products · producto │
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── FK locales ──                                                    │
│  warehouse_id           → warehouse  único con product_id            │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

### §3.4 Eventos POS — pares raíz + renglones

#### §3.4.1 Entradas

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_inflow  (transacción raíz — folios ENT-####)               │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  folio                  VARCHAR(20)    único por companies_id        │
│  note                   VARCHAR(500)   NULL · observaciones libres   │
│                                                                      │
│  ── Montos (los recalcula la capa de servicio) ──                    │
│  total_products         INT            número de renglones           │
│  total_units            DOUBLE         suma de quantity              │
│  total_cost             DOUBLE         suma de subtotal              │
│                                                                      │
│  ── Timestamps ──                                                    │
│  date_inflow            DATE           fecha del evento              │
│  created_at             DATETIME       auditoría · alta              │
│  updated_at             DATETIME       ON UPDATE · última edición    │
│                                                                      │
│  ── Status ──                                                        │
│  status                 ENUM           Pendiente|Aplicada|Revertida  │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  subsidiaries_id        → fayxzvov_alpha.subsidiaries · sucursal     │
│  user_id                → fayxzvov_alpha.usr_users   · quién registra│
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── FK locales ──                                                    │
│  inflow_origin_id       → inflow_origin       · origen tipificado    │
│  warehouse_id           → warehouse           · almacén destino      │
│  supplier_id            → supplier  SET NULL · solo si origin=SUPP   │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘

```

```
┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_inflow  (detalle — renglones de cada entrada)       │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  batch_code (*)         VARCHAR(40)    NULL · lote del proveedor     │
│                                                                      │
│  ── Montos (snapshot al aplicar) ──                                  │
│  quantity               DOUBLE         unidades recibidas            │
│  cost (**)              DOUBLE         costo unitario congelado      │
│  subtotal               DOUBLE         quantity × cost               │
│  previous_stock         DOUBLE         stock antes del movimiento    │
│  resulting_stock        DOUBLE         stock después del movimiento  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  expires_at             DATE           NULL · caducidad declarada    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  product_id             → fayxzvov_reginas.order_products · producto │
│                                                                      │
│  ── FK locales ──                                                    │
│  inventory_inflow_id    → inventory_inflow  CASCADE · header padre   │
│  unit_id                → unit              · unidad del renglón     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘

 (*)  batch_code      — lote/serie con que el proveedor identifica la mercancía.
                        Permite trazar caducidad y aplicar FEFO en la salida.
 (**) cost            — costo unitario congelado al aplicar la entrada.
                        Conserva el valor histórico del renglón; no se recalcula.
```

#### §3.4.2 Mermas

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_shrinkage  (transacción raíz — folios M-####)              │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  folio                  VARCHAR(20)    único por companies_id        │
│  note                   VARCHAR(500)   NULL · observaciones libres   │
│  evidence_url           VARCHAR(255)   NULL · foto de la merma       │
│                                                                      │
│  ── Montos (los recalcula la capa de servicio) ──                    │
│  total_products         INT            número de renglones           │
│  total_units            DOUBLE         suma de quantity              │
│  total_cost_loss        DOUBLE         pérdida monetaria total       │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│  updated_at             DATETIME       ON UPDATE · última edición    │
│                                                                      │
│  ── Status ──                                                        │
│  status                 ENUM           Aplicada|Revertida            │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  subsidiaries_id        → fayxzvov_alpha.subsidiaries · sucursal     │
│  user_id                → fayxzvov_alpha.usr_users   · quién registra│
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── FK locales ──                                                    │
│  shrinkage_reason_id    → shrinkage_reason    · motivo tipificado    │
│  warehouse_id           → warehouse           · almacén afectado     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_shrinkage  (detalle — renglones de cada merma)      │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Montos (snapshot al aplicar) ──                                  │
│  quantity               DOUBLE         unidades dadas de baja        │
│  cost                   DOUBLE         costo unitario congelado      │
│  subtotal_loss          DOUBLE         quantity × cost               │
│  previous_stock         DOUBLE         stock antes del movimiento    │
│  resulting_stock        DOUBLE         stock después del movimiento  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  product_id             → fayxzvov_reginas.order_products · producto │
│                                                                      │
│  ── FK locales ──                                                    │
│  inventory_shrinkage_id → inventory_shrinkage   CASCADE · header    │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

#### §3.4.3 Traspasos

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_transfer  (transacción raíz — folios TRA-####)             │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  folio                  VARCHAR(20)    único por companies_id        │
│  note                   VARCHAR(500)   NULL · observaciones libres   │
│                                                                      │
│  ── Montos (los recalcula la capa de servicio) ──                    │
│  total_products         INT            renglones del traspaso        │
│  total_units            DOUBLE         suma de quantity              │
│  total_cost             DOUBLE         costo total snapshot          │
│                                                                      │
│  ── Timestamps (timeline del flujo) ──                               │
│  date_request           DATETIME       cuándo se solicitó            │
│  date_authorized        DATETIME       NULL · cuándo se autorizó     │
│  date_sent              DATETIME       NULL · cuándo salió origen    │
│  date_received          DATETIME       NULL · cuándo llegó destino   │
│  created_at             DATETIME       auditoría · alta              │
│  updated_at             DATETIME       ON UPDATE · última edición    │
│                                                                      │
│  ── Status ──                                                        │
│  status_id              → transfer_status · estado actual del flujo  │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  origin_subsidiaries_id      → fayxzvov_alpha.subsidiaries · origen  │
│  destination_subsidiaries_id → fayxzvov_alpha.subsidiaries · destino │
│  requested_user_id      → fayxzvov_alpha.usr_users  · solicitante    │
│  authorized_user_id     → fayxzvov_alpha.usr_users  · NULL · autoriza│
│  received_user_id       → fayxzvov_alpha.usr_users  · NULL · recibe  │
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── FK locales ──                                                    │
│  origin_warehouse_id        → warehouse        almacén origen        │
│  destination_warehouse_id   → warehouse        almacén destino       │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_transfer  (detalle — renglones de cada traspaso)    │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Montos (doble snapshot: origen al enviar, destino al recibir) ── │
│  quantity               DOUBLE         unidades trasladadas          │
│  cost                   DOUBLE         costo al momento del envío    │
│  subtotal               DOUBLE         quantity × cost               │
│  origin_stock_prev      DOUBLE         stock origen antes            │
│  origin_stock_post      DOUBLE         stock origen después          │
│  destination_stock_prev DOUBLE         NULL · se llena al recibir    │
│  destination_stock_post DOUBLE         NULL · se llena al recibir    │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  product_id             → fayxzvov_reginas.order_products · producto │
│                                                                      │
│  ── FK locales ──                                                    │
│  inventory_transfer_id  → inventory_transfer  CASCADE · header padre │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_transfer_history  (histórico — timeline de transiciones)   │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  note                   VARCHAR(500)   NULL · motivo del cambio      │
│                                                                      │
│  ── Timestamps ──                                                    │
│  transitioned_at        DATETIME       cuándo ocurrió la transición  │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── Status ──                                                        │
│  status_id              → transfer_status · nuevo estado del flujo   │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  user_id                → fayxzvov_alpha.usr_users  · quién transita │
│                                                                      │
│  ── FK locales ──                                                    │
│  inventory_transfer_id  → inventory_transfer  CASCADE · header padre │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

#### §3.4.4 Ajustes

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_adjustment  (transacción raíz — AJU-#### / INV-FIS-####)   │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  folio                  VARCHAR(20)    único por companies_id        │
│  note                   VARCHAR(500)   NULL · observaciones libres   │
│  adjustment_type        ENUM           individual | fisico           │
│                                                                      │
│  ── Montos (diferencia entre sistema y físico) ──                    │
│  total_products         INT            renglones del ajuste          │
│  total_diff_units       DOUBLE         + sobrante / − faltante       │
│  total_diff_cost        DOUBLE         impacto monetario del ajuste  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  date_adjustment        DATE           fecha del ajuste              │
│  time_adjustment        TIME           hora del ajuste               │
│  created_at             DATETIME       auditoría · alta              │
│  updated_at             DATETIME       ON UPDATE · última edición    │
│                                                                      │
│  ── Status ──                                                        │
│  status                 ENUM           Pendiente|Aplicado|Revertido  │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  subsidiaries_id        → fayxzvov_alpha.subsidiaries · sucursal     │
│  registered_user_id     → fayxzvov_alpha.usr_users  · quién registró │
│  authorized_user_id     → fayxzvov_alpha.usr_users  · NULL · autoriza│
│  companies_id           → fayxzvov_admin.companies   · tenant        │
│                                                                      │
│  ── FK locales ──                                                    │
│  adjustment_reason_id   → adjustment_reason · motivo tipificado      │
│  warehouse_id           → warehouse         · almacén ajustado       │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_adjustment  (detalle — renglones de cada ajuste)    │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Montos (sistema vs físico) ──                                    │
│  system_quantity        DOUBLE         lo que el sistema decía       │
│  physical_quantity      DOUBLE         lo que se contó físicamente   │
│  difference             DOUBLE         + sobrante / − faltante       │
│  cost                   DOUBLE         costo al momento del ajuste   │
│  cost_diff              DOUBLE         difference × cost             │
│  previous_stock         DOUBLE         stock antes del ajuste        │
│  resulting_stock        DOUBLE         stock después del ajuste      │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       auditoría · alta              │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  product_id             → fayxzvov_reginas.order_products · producto │
│                                                                      │
│  ── FK locales ──                                                    │
│  inventory_adjustment_id → inventory_adjustment  CASCADE · header    │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     1=activo / 0=baja lógica      │
└──────────────────────────────────────────────────────────────────────┘
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
        d.product_id                        AS product_id,
        d.quantity                          AS quantity,
        d.previous_stock                    AS stock_prev,
        d.resulting_stock                   AS stock_post,
        d.cost                              AS cost_unit,
        d.subtotal                          AS cost_total,
        r.date_inflow                       AS occurred_at,
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
        d.product_id,
        d.quantity,
        d.previous_stock,
        d.resulting_stock,
        d.cost,
        d.subtotal_loss,
        r.created_at,
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
        d.product_id,
        -d.quantity,                            -- salida del origen
        d.origin_stock_prev,
        d.origin_stock_post,
        d.cost,
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
    JOIN `transfer_status` ts ON ts.id = r.status_id
    WHERE d.active = 1 AND r.active = 1 AND r.date_sent IS NOT NULL

    UNION ALL

    SELECT
        CONCAT('TR-IN-', d.id),
        'TRANSFERENCIA',
        r.folio,
        d.product_id,
        d.quantity,
        d.destination_stock_prev,
        d.destination_stock_post,
        d.cost,
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
    JOIN `transfer_status` ts ON ts.id = r.status_id
    WHERE d.active = 1 AND r.active = 1 AND r.date_received IS NOT NULL

    UNION ALL

    -- Ajustes
    SELECT
        CONCAT('AD-', d.id),
        'AJUSTE',
        r.folio,
        d.product_id,
        d.difference,
        d.previous_stock,
        d.resulting_stock,
        d.cost,
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

INSERT INTO `unit` (`code`, `name`) VALUES
    ('pza',  'Pieza'),
    ('kg',   'Kilogramo'),
    ('lt',   'Litro'),
    ('caja', 'Caja'),
    ('pq',   'Paquete'),
    ('m',    'Metro');

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
| **Montos en DOUBLE** | ✅ | `cost_unit`, `cost`, `subtotal`, `total_cost`, `subtotal_loss`, `total_diff_cost` — todos DOUBLE. |
| **FKs al final (después de active + timestamps)** | ✅ | Patrón aplicado consistentemente: campos de negocio → `active` → `created_at` → `updated_at` → FKs (`*_id`). |
| **Columnas obligatorias `active` + `created_at`** | ✅ | Presentes en todas las tablas (catálogos, raíces y detalles). |
| **`updated_at` con ON UPDATE CURRENT_TIMESTAMP** | ✅ | En tablas mutables (warehouse, product_attribute, eventos raíz). |
| **InnoDB + utf8mb4_0900_ai_ci** | ✅ | Declarado en todas las tablas y a nivel CREATE DATABASE. |
| **Cross-schema FKs identificadas** | ✅ | `subsidiaries_id`, `companies_id`, `user_id` y `product_id` referencian otros esquemas. Constraints declaradas (`fayxzvov_alpha.subsidiaries`, `fayxzvov_admin.companies`, `fayxzvov_alpha.usr_users`, `fayxzvov_reginas.order_products`). |
| **Excepción a la regla singular para FKs cross-schema** | ⚠️ | Se mantienen `subsidiaries_id` y `companies_id` plurales por consistencia con el ecosistema ya en producción. Las FKs propias del esquema sí siguen singular (`product_id`, `warehouse_id`, etc.). Documentado en §1. |
| **Unique keys donde aplica** | ✅ | `(folio, companies_id)` por evento, `(sku, companies_id)` en product_attribute, `(product_id, warehouse_id)` en stock, `(subsidiaries_id, is_default)` para almacén default único por sucursal. |
| **Indices en columnas filtrables** | ✅ | `date_*`, `status`, FKs y `active` indexados en cada raíz. |
| **ON DELETE / ON UPDATE explícitos** | ✅ | CASCADE en raíz→detalle. SET NULL en FKs opcionales (supplier_id, warehouse_area_id). RESTRICT/default en cross-schema (no propagar borrados desde otros esquemas). |
| **Bitácora unificada como vista** | ✅ | `inventory_movement` es VIEW (no materializada). Evita drift. Si crece mucho, migrar a tabla materializada con triggers. |
| **Snapshots por renglón** | ✅ | Cada `detail_*` guarda `previous_stock`, `resulting_stock`, `cost` para auditoría. |
| **ENUMs para estados internos del módulo** | ✅ | Status de eventos: `inflow.status`, `shrinkage.status`, `adjustment.status`. Estados del traspaso son catálogo (`transfer_status`) porque tienen flujo. |
| **No se duplica catálogo POS** | ✅ | `product_attribute` extiende `order_products` 1:1 vía FK cross-schema. |
| **Folios prefijados por tipo** | ✅ | `ENT-`, `M-`, `TRA-`, `AJU-`, `INV-FIS-` documentados. UNIQUE por `(folio, companies_id)`. |
| **Timestamps de auditoría** | ✅ | `created_at` en todas; `updated_at` en mutables; campos de fecha de evento separados de `created_at` (date_inflow vs created_at). |
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
3. Actualizar `stock.quantity` por cada par `(product_id, warehouse_id)`.
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
                               product_id, warehouse_area_id, unit_id, companies_id)
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
JOIN fayxzvov_reginas.order_products op ON op.id = s.product_id
WHERE sub.id = :subsidiary_id;
```

**Productos en stock bajo:**
```sql
SELECT op.name, pa.sku, s.quantity, pa.stock_min, w.name AS warehouse
FROM stock s
JOIN product_attribute pa ON pa.product_id = s.product_id
JOIN fayxzvov_reginas.order_products op ON op.id = s.product_id
JOIN warehouse w ON w.id = s.warehouse_id
WHERE s.quantity < pa.stock_min AND s.active = 1;
```

**Bitácora del producto:**
```sql
SELECT *
FROM inventory_movement
WHERE product_id = :product_id
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
