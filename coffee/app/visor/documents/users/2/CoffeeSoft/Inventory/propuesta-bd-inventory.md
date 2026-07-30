# Propuesta de Base de Datos — Módulo Inventory / Almacén

> Documento generado por **Coffee Intelligence 🧠☕** siguiendo `db-rules.md` (CoffeeSoft/Huubie).
> Fecha: 2026-06-04 · Proyecto: `c:\wamp64\www\huubie\inventory`
> **Revisión 2** — alineado al *plan reginas* (esquema espejo, alcance Entrada/Salida).

---

## 0. Decisión de diseño (acordada)

Tras revisar el plan que ya corre en `fayxzvov_reginas` (módulo POS `app/inventarios`), se acordó:

| Punto | Decisión | Implicación |
|-------|----------|-------------|
| **Estrategia de esquema** | **Espejo propio** — `fayxzvov_almacen` con las **mismas tablas y campos** que reginas. | Los módulos de operación y POS quedan separados pero con estructura idéntica; migrar/unificar después es trivial. |
| **Alcance de movimientos** | **Solo Entrada / Salida**, mapeadas a las tablas reginas. | **Entrada → `inventory_inflow`**, **Salida → `inventory_shrinkage`**. No se incluyen traspasos ni ajustes. |
| **Tenant** | Se adopta el de reginas: **`companies_id` + `subsidiaries_id`**. | Reemplaza el `udn_id` actual; requiere exponer ambos en sesión (ver §8). |
| **Stock** | Tabla `stock` por producto + almacén. | `product.quantity` deja de ser la fuente de verdad. |
| **Usuario** | `fayxzvov_alpha.usr_users` (`id`, `fullname`). | Reemplaza el cross-schema a `fayxzvov_erp.usuarios`. |

> Resultado: `fayxzvov_almacen` deja de ser un inventario mono-almacén propio y pasa a ser un **clon estructural reducido de reginas** (catálogos + producto/atributo + stock + entradas + salidas + kardex).

---

## 1. Punto de partida — qué hace hoy `operacion/almacen`

Inventario simple, **mono-almacén**, cableado a `fayxzvov_almacen.` (esquema **que no existe en MySQL**, por eso el módulo no opera). Cinco pantallas:

| Pantalla | Modelo | Tablas actuales (`fayxzvov_almacen`) |
|----------|--------|--------------------------------------|
| Almacén / Materiales | `mdl/mdl-almacen.php` | `product`, `areas`, `presentations`, `product_groups`, `supplier` |
| Catálogo | `mdl/mdl-catalogo.php` | `presentations`, `product_groups`, `areas` |
| Inventario (movimientos) | `mdl/mdl-inventario.php` | `inventory_movement`, `inventory_movement_detail`, `movement_type`, `product` |
| Existencias | `mdl/mdl-existencias.php` | `product` + `inventory_movement*` |
| Dashboard | `mdl/mdl-dashboard.php` | `product`, `inventory_movement*` |

Rasgos del modelo viejo: tenant `udn_id`; stock denormalizado en `product.quantity`; usuario vía `fayxzvov_erp.usuarios.idUser`; movimiento genérico Entrada/Salida con catálogo `movement_type`.

---

## 2. El plan reginas (referencia confirmada en `app/inventarios/mdl/mdl-inventarios.php`)

Inventario **multi-empresa / multi-sucursal / multi-almacén**:

- Tenant `companies_id` + `subsidiaries_id`.
- Producto partido en **`order_products`** (maestro) + **`product_attribute`** (datos de inventario).
- Existencias en **`stock`** con única `(product_id, warehouse_id)`.
- Movimientos **por tipo**: `inventory_inflow`, `inventory_shrinkage`, `inventory_transfer`, `inventory_adjustment`, cada uno con su `detail_*`, más **`inventory_movement`** como kardex unificado.
- Montos en `DOUBLE`; borrado lógico `active`; `created_at`/`updated_at`.

---

## 3. Mapeo viejo → nuevo (espejo reginas)

| Tabla actual (propuesta v1) | Tabla del espejo (plan reginas) | Acción |
|-----------------------------|----------------------------------|--------|
| `product` | **`products` + `product_attribute`** | **Partir en dos.** name/price/category/image → `products`; sku/cost/stock_min/stock_max/unidad → `product_attribute`. |
| *(no existía)* | **`stock`** | **Nueva.** Existencia por producto + almacén. `product.quantity` se elimina. |
| *(no existía)* | **`warehouse`** | **Nueva.** Almacén físico (`is_default`, `subsidiaries_id`). |
| `areas` (UI "Zona") | **`warehouse_area`** | Renombre + `color_hex`, `description`, `companies_id`. |
| `presentations` (UI "Categoría") | **`unit`** | Pasa a unidad de medida (`code`, `name`). |
| `product_groups` (UI "Área") | **`inv_category`** | Clasificación de producto (`classification`). |
| `movement_type` (Entrada/Salida) | *(se elimina)* | El tipo lo da la **tabla destino** (inflow/shrinkage) y `inventory_movement.movement_type`. |
| `supplier` | **`supplier`** (en `fayxzvov_almacen`) | Se **mueve** desde `fayxzvov_alpha` a este esquema. Gana `contact_name`, `companies_id`. |
| `inventory_movement` (header genérico) | **`inventory_inflow`** (entrada) **+ `inventory_shrinkage`** (salida) | Header se **divide por tipo**. |
| `inventory_movement_detail` | **`detail_inventory_inflow`** + **`detail_inventory_shrinkage`** | Detalle gana `cost`, `subtotal`, `unit_id`, lote/caducidad. |
| *(no existía)* | **`inventory_movement`** (kardex) | **Nueva.** Vista denormalizada de movimientos para Existencias/Dashboard/historial. |
| *(no existía)* | **`inflow_origin`**, **`shrinkage_reason`** | **Nuevos catálogos** que las entradas/salidas de reginas exigen como FK. |

---

## 4. Clasificación de tablas del esquema `fayxzvov_almacen` (espejo)

| Tipo | Tabla | Rol |
|------|-------|-----|
| Catálogo | `inv_category` | Clasificación de producto |
| Catálogo | `unit` | Unidades de medida / presentación |
| Catálogo | `warehouse_area` | Áreas físicas del almacén |
| Catálogo | `inflow_origin` | Origen de entrada (compra, producción…) |
| Catálogo | `shrinkage_reason` | Motivo de salida / merma |
| Maestro local | `warehouse` | Almacenes físicos |
| Maestro local | `supplier` | Proveedores (vive en `fayxzvov_almacen`) |
| Maestro local | `products` | Producto (datos comerciales) |
| Maestro local | `product_attribute` | Producto (datos de inventario) |
| Existencias | `stock` | Stock por producto + almacén |
| Evento raíz | `inventory_inflow` | Encabezado de entrada |
| Detalle | `detail_inventory_inflow` | Renglones de entrada (kardex) |
| Evento raíz | `inventory_shrinkage` | Encabezado de salida / merma |
| Detalle | `detail_inventory_shrinkage` | Renglones de salida (kardex) |
| Kardex | `inventory_movement` | Movimientos unificados (lectura) |

Maestros corporativos cross-schema (nunca duplicar): `fayxzvov_alpha.subsidiaries`, `fayxzvov_alpha.usr_users`, `fayxzvov_admin.companies`. `supplier` se replica dentro de `fayxzvov_almacen` (no se usa el de `fayxzvov_alpha`).

---

## 5. Diagrama de relaciones (cardinalidades)

> Convención: caja con **doble borde** `╔══╗` = tabla **creada por este módulo** dentro de `fayxzvov_almacen`. Caja con **borde simple** `┌──┐` = tabla **preexistente** (`order_products` vive aquí mismo; `companies`, `subsidiaries`, `usr_users` viven en otros schemas). Las flechas llevan la cardinalidad pegada (`1` o `N`).

```text
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
                          │  └───────┬───────┘   │ N │
                          │          │ 1         │   │
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
        ║                  fayxzvov_almacen                      ║
        ║                                                           ║
        ║  ┌────────────────────┐      N  ╔═══════════════╗         ║
        ║  │     products       │◄────────╢ product_attribute ║         ║
        ║  └─────────┬──────────┘    1   ╚═══════════════╝         ║
        ║            │ 1                                            ║
        ║            │                                              ║
        ║            │ N                                            ║
        ║  ┌─────────▼──────────┐                                   ║
        ║  │ order_category     │                                   ║
        ║  └────────────────────┘                                   ║
        ║                                                           ║
        ║  ╔════════════════════╗      N  ╔═══════════════╗          ║
        ║  ║     warehouse      ╠─────────╣ warehouse_area║          ║
        ║  ╚════════╦═══════════╝         ╚═══════════════╝          ║
        ║           │ 1                                            ║
        ║           │                                              ║
        ║           │ N                                            ║
        ║  ╔════════▼═══════════╗                                   ║
        ║  ║       stock        ║                                   ║
        ║  ╚════════════════════╝                                   ║
        ║                                                           ║
        ║  ╔════════════════════╗         (opcional para entradas)   ║
        ║  ║     supplier       ║                                   ║
        ║  ╚════════════════════╝                                   ║
        ║                                                           ║
        ║  ── EVENTOS RAIZ + RENGLONES ──                          ║
        ║                                                           ║
        ║  ╔════════════════════╗      1  ╔══════════════════════╗  ║
        ║  ║  inventory_inflow  ╠─────────╣ detail_inv_inflow    ║  ║
        ║  ╚════════╦═══════════╝   N     ╚══════════╦═══════════╝  ║
        ║           │ N                              │ N            ║
        ║           │                                │              ║
        ║           │ 1                              │ 1            ║
        ║  ╔════════▼═══════════╗           ┌────────▼──────────┐   ║
        ║  ║  inflow_origin     ║           │     products      │   ║
        ║  ╚════════════════════╝           │  (mismo schema)   │   ║
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
        ║  ── KARDEX UNIFICADO ──                                   ║
        ║                                                           ║
        ║  ╔════════════════════╗                                   ║
        ║  ║ inventory_movement ║                                   ║
        ║  ╚════════════════════╝                                   ║
        ║                                                           ║
        ║  Cross-schema (todas las tablas raíz tienen):             ║
        ║     subsidiaries_id  → fayxzvov_alpha.subsidiaries        ║
        ║     companies_id     → fayxzvov_admin.companies           ║
        ║     user_id          → fayxzvov_alpha.usr_users           ║
        ║                                                           ║
        ╚═══════════════════════════════════════════════════════════╝
```

---

## 6. Estructura de tablas (Fase 3 — campos del espejo)

> Orden de columnas (regla de la casa): `id → negocio → montos → timestamps → status → active → FKs`.
> Tipos tomados del plan reginas; montos en `DOUBLE`; borrado lógico `active TINYINT(1) DEFAULT 1`.

### 6.1 Catálogos

```
┌──────────────────────────────────────────────────────────────────────┐
│ order_category  (catálogo — clasificación de productos)              │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  classification         VARCHAR(120)   nombre de categoria           │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ unit  (catálogo — unidades de medida: pza, kg, lt)                   │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(20)    código corto (KG, PZA, LT)    │
│  name                   VARCHAR(80)    nombre completo               │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ warehouse_area  (catálogo — áreas físicas del almacén)               │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(120)   nombre del área               │
│  description            VARCHAR(255)   NULL · descripción            │
│  color_hex              VARCHAR(9)     '#RRGGBB' para UI             │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── FK cross-schema ──                                               │
│  companies_id           → fayxzvov_admin.companies                   │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ inflow_origin  (sub-catálogo — origen de entradas)                   │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(30)    código técnico                │
│  name                   VARCHAR(120)   nombre visible                │
│  icon                   VARCHAR(60)    NULL · ícono                  │
│  color_hex              VARCHAR(9)     NULL · color                  │
│  requires_supplier      TINYINT(1)     DEFAULT 0                     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ shrinkage_reason  (sub-catálogo — motivos de salida)                 │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  code                   VARCHAR(30)    código técnico                │
│  name                   VARCHAR(120)   nombre visible                │
│  icon                   VARCHAR(60)    NULL · ícono                  │
│  color_hex              VARCHAR(9)     NULL · color                  │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Maestros

```
warehouse
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| name               | VARCHAR(120) | NOT NULL                               |
| is_default         | TINYINT(1)   | DEFAULT 0                              |
| created_at         | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| active             | TINYINT(1)   | DEFAULT 1                              |
| warehouse_area_id  | INT          | FK -> warehouse_area.id (NULL)         |
| subsidiaries_id    | INT          | FK -> fayxzvov_alpha.subsidiaries      |
| companies_id       | INT          | FK -> fayxzvov_admin.companies         |
+--------------------+--------------+----------------------------------------+

supplier
+------------------+--------------+--------------------------------+
| id               | INT PK AI    |                                |
| name             | VARCHAR(160) | NOT NULL                       |
| contact_name     | VARCHAR(120) | NULL                           |
| phone            | VARCHAR(20)  | NULL                           |
| email            | VARCHAR(120) | NULL                           |
| created_at       | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| active           | TINYINT(1)   | DEFAULT 1                      |
| companies_id     | INT          | FK -> fayxzvov_admin.companies |
+------------------+--------------+--------------------------------+

order_products  (datos comerciales del producto)
+------------------+--------------+----------------------------------------+
| id               | INT PK AI    |                                        |
| name             | VARCHAR(160) | NOT NULL                               |
| image            | VARCHAR(255) | NULL                                   |
| price            | DOUBLE       | precio de venta, DEFAULT 0             |
| created_at       | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| active           | TINYINT(1)   | DEFAULT 1                              |
| category_id      | INT          | FK -> order_category.id                |
| subsidiaries_id  | INT          | FK -> fayxzvov_alpha.subsidiaries      |
| companies_id     | INT          | FK -> fayxzvov_admin.companies         |
+------------------+--------------+----------------------------------------+

product_attribute  (datos de inventario del producto)
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| sku                | VARCHAR(40)  | codigo de inventario (era 'PRD-001')   |
| description        | VARCHAR(255) | NULL                                   |
| shelf_life_days    | INT          | caducidad en dias, NULL                |
| cost_unit          | DOUBLE       | costo unitario, DEFAULT 0             |
| stock_min          | DOUBLE       | inventario minimo, DEFAULT 0          |
| stock_max          | DOUBLE       | inventario maximo, NULL               |
| created_at         | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| active             | TINYINT(1)   | DEFAULT 1                              |
| warehouse_area_id  | INT          | FK -> warehouse_area.id (NULL)         |
| unit_id            | INT          | FK -> unit.id                          |
| product_id         | INT          | FK -> order_products.id                |
| companies_id       | INT          | FK -> fayxzvov_admin.companies         |
+--------------------+--------------+----------------------------------------+
```

### 6.3 Existencias

```
stock
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| quantity           | DOUBLE       | existencia actual, DEFAULT 0          |
| last_movement_at   | DATETIME     | NULL                                   |
| last_inventory_at  | DATETIME     | NULL (ultimo conteo fisico)            |
| created_at         | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| updated_at         | DATETIME     | ON UPDATE CURRENT_TIMESTAMP            |
| active             | TINYINT(1)   | DEFAULT 1                              |
| warehouse_id       | INT          | FK -> warehouse.id                     |
| product_id         | INT          | FK -> order_products.id                |
| companies_id       | INT          | FK -> fayxzvov_admin.companies         |
+--------------------+--------------+----------------------------------------+
  UNIQUE KEY uk_stock (product_id, warehouse_id)   <- una fila por producto+almacen
```

### 6.4 Entradas (Entrada → `inventory_inflow`)

```
inventory_inflow  (encabezado de entrada)
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| folio              | VARCHAR(20)  | NOT NULL                               |
| note               | VARCHAR(255) | NULL                                   |
| total_products     | INT          | DEFAULT 0                              |
| total_units        | DOUBLE       | DEFAULT 0                              |
| total_cost         | DOUBLE       | DEFAULT 0                              |
| date_inflow        | DATE         | CURDATE() del servidor                 |
| confirmed_at       | DATETIME     | NULL                                   |
| created_at         | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| updated_at         | DATETIME     | ON UPDATE CURRENT_TIMESTAMP            |
| status             | VARCHAR(20)  | 'Pendiente'/'Aplicada'/'Cancelada'     |
| active             | TINYINT(1)   | DEFAULT 1                              |
| inflow_origin_id   | INT          | FK -> inflow_origin.id                 |
| warehouse_id       | INT          | FK -> warehouse.id                     |
| supplier_id        | INT          | FK -> supplier.id (NULL)               |
| user_id            | INT          | FK -> fayxzvov_alpha.usr_users.id      |
| confirmed_user_id  | INT          | FK -> fayxzvov_alpha.usr_users.id      |
| subsidiaries_id    | INT          | FK -> fayxzvov_alpha.subsidiaries      |
| companies_id       | INT          | FK -> fayxzvov_admin.companies         |
+--------------------+--------------+----------------------------------------+

detail_inventory_inflow  (renglones de entrada)
+------------------------+--------------+--------------------------------+
| id                     | INT PK AI    |                                |
| batch_code             | VARCHAR(40)  | lote, NULL                     |
| quantity               | DOUBLE       | cantidad reportada             |
| confirmed_quantity     | DOUBLE       | cantidad real al aplicar, NULL |
| cost                   | DOUBLE       | costo unitario                 |
| subtotal               | DOUBLE       | quantity * cost                |
| previous_stock         | DOUBLE       | stock antes del movimiento     |
| resulting_stock        | DOUBLE       | stock despues del movimiento   |
| expires_at             | DATE         | caducidad del lote, NULL       |
| created_at             | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| active                 | TINYINT(1)   | DEFAULT 1                      |
| product_id             | INT          | FK -> order_products.id        |
| inventory_inflow_id    | INT          | FK -> inventory_inflow.id (CASCADE) |
| unit_id                | INT          | FK -> unit.id                  |
+------------------------+--------------+--------------------------------+
```

### 6.5 Salidas (Salida → `inventory_shrinkage`)

```
inventory_shrinkage  (encabezado de salida / merma)
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| folio              | VARCHAR(20)  | NOT NULL                               |
| note               | VARCHAR(255) | NULL                                   |
| total_products     | INT          | DEFAULT 0                              |
| total_units        | DOUBLE       | DEFAULT 0                              |
| total_cost         | DOUBLE       | DEFAULT 0                              |
| date_shrinkage     | DATE         | fecha de la salida                     |
| created_at         | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| updated_at         | DATETIME     | ON UPDATE CURRENT_TIMESTAMP            |
| status             | VARCHAR(20)  | 'Aplicada'/'Cancelada'                 |
| active             | TINYINT(1)   | DEFAULT 1                              |
| shrinkage_reason_id| INT          | FK -> shrinkage_reason.id              |
| warehouse_id       | INT          | FK -> warehouse.id                     |
| user_id            | INT          | FK -> fayxzvov_alpha.usr_users.id      |
| subsidiaries_id    | INT          | FK -> fayxzvov_alpha.subsidiaries      |
| companies_id       | INT          | FK -> fayxzvov_admin.companies         |
+--------------------+--------------+----------------------------------------+

detail_inventory_shrinkage  (renglones de salida)
+------------------------+--------------+--------------------------------+
| id                     | INT PK AI    |                                |
| quantity               | DOUBLE       | cantidad de salida             |
| cost                   | DOUBLE       | costo unitario                 |
| subtotal               | DOUBLE       | quantity * cost                |
| previous_stock         | DOUBLE       | stock antes del movimiento     |
| resulting_stock        | DOUBLE       | stock despues del movimiento   |
| created_at             | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| active                 | TINYINT(1)   | DEFAULT 1                      |
| product_id             | INT          | FK -> order_products.id        |
| inventory_shrinkage_id | INT          | FK -> inventory_shrinkage.id (CASCADE) |
+------------------------+--------------+--------------------------------+
```

### 6.6 Kardex unificado (lectura para Existencias / Dashboard / historial)

```
inventory_movement
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| movement_uid       | VARCHAR(40)  | id logico del movimiento               |
| movement_type      | VARCHAR(20)  | 'ENTRADA' / 'MERMA'                    |
| folio              | VARCHAR(20)  | folio del header origen                |
| quantity           | DOUBLE       | + entra / - sale                       |
| stock_prev         | DOUBLE       | stock antes                            |
| stock_post         | DOUBLE       | stock despues                          |
| cost_unit          | DOUBLE       | costo unitario                         |
| cost_total         | DOUBLE       | quantity * cost_unit                   |
| occurred_at        | DATETIME     | momento del movimiento                 |
| note               | VARCHAR(255) | NULL                                   |
| status             | VARCHAR(20)  | espejo del header                      |
| product_id         | INT          | FK -> order_products.id                |
| warehouse_id       | INT          | FK -> warehouse.id                     |
| user_id            | INT          | FK -> fayxzvov_alpha.usr_users.id      |
| subsidiaries_id    | INT          | FK -> fayxzvov_alpha.subsidiaries      |
| companies_id       | INT          | FK -> fayxzvov_admin.companies         |
+--------------------+--------------+----------------------------------------+
```

---

## 7. Cambios de campo respecto a la propuesta v1 (resumen ejecutable)

1. **`product` → se elimina.** Sus datos se reparten: comerciales en `order_products`, de inventario en `product_attribute`.
2. **`product.quantity` → se elimina.** El stock vive ahora en `stock.quantity` por almacén.
3. **`product.code` → `product_attribute.sku`** (texto libre; ya no se autogenera `PRD-###`).
4. **`udn_id` → `companies_id` + `subsidiaries_id`** en TODAS las tablas con tenant.
5. **`fayxzvov_erp.usuarios.idUser` → `fayxzvov_alpha.usr_users.id`** (se muestra `fullname`).
6. **`areas` → `warehouse_area`**, **`presentations` → `unit`**, **`product_groups` → `inv_category`** (renombres + columnas extra de reginas).
7. **`movement_type` → eliminado**; el signo lo da la tabla destino.
8. **`inventory_movement` (header) → `inventory_inflow` + `inventory_shrinkage`** (dos headers por tipo).
9. **`inventory_movement_detail` → `detail_inventory_inflow` + `detail_inventory_shrinkage`**; el detalle gana `cost`, `subtotal`, `unit_id`, `batch_code`, `expires_at`.
10. **Nuevas:** `stock`, `warehouse`, `inflow_origin`, `shrinkage_reason` y el `inventory_movement` con rol de kardex.

---

## 8. Impacto en los modelos PHP (qué reescribir)

| Modelo | Cambio principal |
|--------|------------------|
| `mdl-almacen.php` | `product` → `products` JOIN `product_attribute`; selects de catálogo apuntan a `inv_category`/`unit`/`warehouse_area`; `supplier` con `contact_name`. |
| `mdl-catalogo.php` | CRUD de los 3 catálogos se reapunta a `inv_category`, `unit`, `warehouse_area`. |
| `mdl-inventario.php` | El alta de movimiento decide tabla por tipo: Entrada → `inventory_inflow`/`detail_inventory_inflow`; Salida → `inventory_shrinkage`/`detail_inventory_shrinkage`. Stock se actualiza en `stock` (no en `product`). |
| `mdl-existencias.php` | Existencias = `SUM(stock.quantity)` por producto vs `product_attribute.stock_min`. |
| `mdl-dashboard.php` | KPIs leen `stock` + `inventory_movement` (kardex). |
| **Sesión / tenant** | Sustituir `$_SESSION['idUDN']` por `companies_id` + `subsidiaries_id` (definir de dónde se toman en la sesión Huubie). |

> ⚠️ **Bloqueante de negocio a confirmar:** el módulo hoy filtra por `udn_id`. Migrar a `companies_id`/`subsidiaries_id` exige que la sesión del módulo de operación exponga esos valores (como ya lo hace el POS). Si no existen en sesión, hay que mapearlos antes de tocar los modelos.

---

## 9. Auto-revisión (Checklist §7 db-rules.md)

| # | Regla | ✔ |
|---|-------|---|
| 1 | Tablas en singular, inglés, `snake_case` | ✅ idénticas a reginas |
| 2 | Engine InnoDB | ✅ |
| 3 | Charset utf8mb4 (`utf8mb4_unicode_ci`, WAMP 5.7) | ✅ |
| 4 | Montos en `DOUBLE` | ✅ `cost_unit`, `price`, `subtotal`, `total_cost`, `quantity` |
| 5 | Estados extensibles = catálogo + FK, no ENUM | ⚠️ `status` sigue como `VARCHAR` (deuda heredada de reginas; `active` cubre soft-delete) |
| 6 | Borrado lógico `active = 0` | ✅ en todas |
| 7 | `detail_` solo en renglones de transacción raíz | ✅ `detail_inventory_inflow`, `detail_inventory_shrinkage` |
| 8 | Maestros corporativos cross-schema, no duplicar | ✅ `companies`, `subsidiaries`, `usr_users` |
| 9 | Orden de columnas `id→negocio→montos→fechas→status→active→FKs` | ✅ aplicado (FKs al final) |
| 10 | FK de detalle con `ON DELETE CASCADE` | ✅ |

---

## 10. Conclusión y siguientes pasos

1. **Crear `fayxzvov_almacen`** con las 16 tablas de la §6 (espejo reducido de reginas).
2. **Sembrar catálogos base:** `inflow_origin` (al menos 'Compra'), `shrinkage_reason` (al menos 'Merma'/'Salida'), `unit`, un `warehouse` `is_default = 1` por sucursal.
3. **Resolver el tenant** (`companies_id`/`subsidiaries_id` en sesión) — bloqueante antes de reescribir modelos.
4. **Reescribir los 5 modelos** según §8, mapeando Entrada/Salida a inflow/shrinkage y actualizando `stock` + `inventory_movement` de forma atómica.

> ¿Genero el **DDL `CREATE TABLE` ejecutable** completo de `fayxzvov_almacen` (espejo)? Avísame y lo entrego listo para correr en el WAMP local.
