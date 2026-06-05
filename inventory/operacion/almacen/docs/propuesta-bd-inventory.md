# Propuesta de Base de Datos — Módulo Inventory / Almacén

> Documento generado por **Coffee Intelligence 🧠☕** siguiendo `db-rules.md` (CoffeeSoft/Huubie).
> Fecha: 2026-06-04 · Proyecto: `c:\wamp64\www\huubie\inventory`

---

## 1. Resumen del dominio

El proyecto **inventory** contiene **dos módulos de inventario que conviven** y hoy apuntan a esquemas distintos:

| Módulo | Ruta | Esquema que usa el código | Estado en MySQL |
|--------|------|---------------------------|-----------------|
| **POS Inventarios** | `app/inventarios` (`pos-stock`, `pos-entradas`, `pos-mermas`, `pos-traspasos`) | `fayxzvov_reginas` | ✅ **Existe** (esquema moderno, multi-almacén) |
| **Almacén (operación)** | `operacion/almacen` (`almacen.js`, `catalogo.js`, `inventario.js`, `existencias.js`) | `fayxzvov_almacen.` | ❌ **NO existe** — hay que crearlo |

**Hallazgo crítico:** todos los modelos de `operacion/almacen/mdl/*.php` hacen `$this->bd = "fayxzvov_almacen."`, pero **ese esquema no está creado** en el servidor MySQL local. El módulo de almacén no puede funcionar hasta crear su base de datos y tablas. Esta propuesta resuelve principalmente ese vacío.

---

## 2. Módulos analizados (Fase 1 — Inspección)

### 2.1 Almacén (`operacion/almacen`) → esquema `fayxzvov_almacen`

Leyendo el JS y los modelos PHP, el dominio de negocio es:

- **Productos / Materiales** (`product`): nombre, código `PRD-001`, cantidad (stock), costo, precio, stock mínimo, descripción. Relacionados a Departamento, Presentación y Grupo. Filtran por `udn_id` (unidad de negocio en sesión).
- **Catálogos:**
  - **Departamento** (UI) → tabla `areas` (el JS lo llama "zona/Departamento").
  - **Presentación** (UI) → tabla `presentations` (el JS lo llama "categoría").
  - **Grupo** (UI) → tabla `product_groups` (el JS lo llama "área").
  - *(La nomenclatura UI↔tabla está cruzada en el código actual; el doc respeta los nombres reales de tabla que usan los modelos.)*
- **Proveedores** (`supplier`).
- **Movimientos de inventario** (`inventory_movement`): folio, fecha, tipo de movimiento, total de productos, total de unidades, status (`Activa`/`Cancelada`), usuario responsable. Genera un encabezado + captura de detalle.
- **Detalle de movimiento** (`inventory_movement_detail`): producto, cantidad, stock anterior, stock resultante.
- **Tipo de movimiento** (`movement_type`): Entrada / Salida.
- **Existencias**: vista/reporte derivado de `product.quantity` con semáforo (disponible / bajo / agotado) y valor de inventario.

**Maestros corporativos referenciados cross-schema:** `fayxzvov_erp.usuarios` (responsable del movimiento, vía `idUser`).

### 2.2 POS Inventarios (`app/inventarios`) → esquema `fayxzvov_reginas` (YA EXISTE)

Esquema moderno y más completo, multi-almacén y multi-empresa. Tablas confirmadas vía MCP MySQL:

```
inventory_inflow          + detail_inventory_inflow        (entradas)
inventory_shrinkage       + detail_inventory_shrinkage     (mermas)
inventory_transfer        + detail_inventory_transfer      (traspasos)  + inventory_transfer_history
inventory_adjustment      + detail_inventory_adjustment    (ajustes / inventario físico)
inventory_movement                                         (kardex unificado)
stock                                                      (existencias por producto+almacén)
supplier · warehouse · warehouse_area · unit · inflow_origin
order_products            (maestro de productos del POS)
```

Características del esquema reginas (patrón de referencia a imitar):
- Montos en `double` (`total_cost`, `cost`, `subtotal`, `quantity`).
- Borrado lógico `active tinyint(1) DEFAULT 1`.
- `created_at` / `updated_at` con `CURRENT_TIMESTAMP`.
- FKs **cross-schema** a maestros corporativos: `fayxzvov_alpha.subsidiaries`, `fayxzvov_alpha.usr_users`, `fayxzvov_admin.companies`.
- `stock` con clave única `(product_id, warehouse_id)` — una fila de existencia por producto y almacén.
- Detalles con `previous_stock` / `resulting_stock` (kardex con trazabilidad).

> ⚠️ El esquema reginas usa `enum(...)` para `status`. Esto **contradice** la regla de la casa (estados extensibles = catálogo + FK, nunca ENUM). Se documenta como deuda técnica; la propuesta nueva NO repite ese patrón.

---

## 3. Recomendación de modelo de base de datos (Fase 0)

**Modelo recomendado: Relacional (RDBMS) sobre MySQL/InnoDB — sin cambios de paradigma.**

Justificación:

1. **Coincide con el ecosistema existente.** Todo Huubie/CoffeeSoft ya es MySQL relacional (`fayxzvov_*`, `rfwsmqex_*`). Introducir NoSQL/documental rompería el patrón de FKs cross-schema y el CRUD genérico (`_CRUD.php`).
2. **Datos altamente estructurados y transaccionales.** Inventario = entidades con relaciones claras (producto↔movimiento↔detalle) y necesidad de **integridad transaccional** (descontar stock + registrar detalle de forma atómica). InnoDB da transacciones ACID y FKs.
3. **Reportes y agregaciones** (valor de inventario, existencias por departamento, kardex) se resuelven nativamente con SQL `JOIN`/`SUM`.
4. **Multi-tenant por columna** (`udn_id` / `companies_id` / `subsidiaries_id`) ya es el patrón de la casa.

**Parámetros técnicos obligatorios:**
- Motor: **InnoDB** (transacciones + FKs).
- Charset/Collation: **`utf8mb4` / `utf8mb4_0900_ai_ci`** (MySQL 8). *Nota: el WAMP local es MySQL 5.7 → usar `utf8mb4_unicode_ci` como en reginas para compatibilidad.*
- Montos: **`DOUBLE`** (nunca `DECIMAL`/`FLOAT`).
- Estados: **catálogo + FK** (nunca `ENUM`).
- Borrado lógico: **`active TINYINT(1) DEFAULT 1`**.

**Estrategia de esquema:**
- Mantener `fayxzvov_almacen` como esquema propio del módulo de operación (ya está cableado en el código).
- **No duplicar maestros corporativos** (usuarios, UDN, empresas): referenciarlos cross-schema a `fayxzvov_erp` / `fayxzvov_alpha` / `fayxzvov_admin`.
- A mediano plazo, evaluar **unificar** el módulo de operación con el esquema POS (`fayxzvov_reginas`) para no mantener dos inventarios paralelos. (Decisión de negocio, fuera de alcance de este doc.)

---

## 4. Modelado (Fase 2 — Tablas y relaciones)

### 4.1 Clasificación de tablas (esquema `fayxzvov_almacen`)

| Tipo | Tabla | Rol |
|------|-------|-----|
| Catálogo | `areas` | Departamentos |
| Catálogo | `presentations` | Presentaciones (unidad de venta/empaque) |
| Catálogo | `product_groups` | Grupos de producto |
| Catálogo | `movement_type` | Tipos de movimiento (Entrada/Salida) |
| Maestro local | `supplier` | Proveedores |
| Maestro local | `product` | Productos / materiales (incluye stock denormalizado) |
| Evento raíz | `inventory_movement` | Encabezado de movimiento (entrada/salida) |
| Detalle | `inventory_movement_detail` | Líneas del movimiento (kardex) |

### 4.2 Diagrama de relaciones (cardinalidades)

```
fayxzvov_erp.usuarios (corporativo, cross-schema)
        │ 1
        │
        │ N
 inventory_movement ──────1───────N── inventory_movement_detail ──N───1── product
        │ N                                                                │ N
        │ 1                                                    ┌───────────┼───────────┐
  movement_type                                              │ 1         │ 1         │ 1
                                                          areas   presentations  product_groups
                                                                            
 product ──N──1── supplier (opcional)
```

- `product` **N:1** `areas` (`area_id`), `presentations` (`presentations_id`), `product_groups` (`group_id`).
- `inventory_movement` **1:N** `inventory_movement_detail`.
- `inventory_movement_detail` **N:1** `product`.
- `inventory_movement` **N:1** `movement_type` y **N:1** `fayxzvov_erp.usuarios` (cross-schema).
- `product` **N:1** `supplier` (opcional / propuesto).

---

## 5. Estructura de tablas (Fase 3 — Campos)

> Orden de columnas según regla de la casa: `id → negocio → montos → fechas → status → FKs → active`.

### 5.1 `areas` (Departamentos)
```
+-------------+--------------+--------------------------------+
| Columna     | Tipo         | Notas                          |
+-------------+--------------+--------------------------------+
| id          | INT PK AI    |                                |
| name        | VARCHAR(120) | NOT NULL                       |
| created_at  | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| udn_id      | INT          | FK -> fayxzvov_erp (UDN)       |
| active      | TINYINT(1)   | DEFAULT 1                      |
+-------------+--------------+--------------------------------+
```

### 5.2 `presentations` (Presentaciones)
```
+-------------+--------------+--------------------------------+
| id          | INT PK AI    |                                |
| name        | VARCHAR(120) | NOT NULL                       |
| created_at  | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| udn_id      | INT          | FK -> UDN                      |
| active      | TINYINT(1)   | DEFAULT 1                      |
+-------------+--------------+--------------------------------+
```

### 5.3 `product_groups` (Grupos)
```
+-------------+--------------+--------------------------------+
| id          | INT PK AI    |                                |
| name        | VARCHAR(120) | NOT NULL                       |
| created_at  | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| udn_id      | INT          | FK -> UDN                      |
| active      | TINYINT(1)   | DEFAULT 1                      |
+-------------+--------------+--------------------------------+
```

### 5.4 `movement_type` (Tipo de movimiento)
```
+-------------+--------------+--------------------------------+
| id          | INT PK AI    |                                |
| name        | VARCHAR(60)  | NOT NULL ('Entrada'/'Salida')  |
| sign        | TINYINT      | +1 suma stock / -1 resta       |
| active      | TINYINT(1)   | DEFAULT 1                      |
+-------------+--------------+--------------------------------+
```
> `sign` evita hardcodear la lógica Entrada/Salida en PHP (catálogo extensible, no ENUM).

### 5.5 `supplier` (Proveedores)
```
+-------------+--------------+--------------------------------+
| id          | INT PK AI    |                                |
| name        | VARCHAR(160) | NOT NULL                       |
| rfc         | VARCHAR(20)  | NULL                           |
| phone       | VARCHAR(20)  | NULL                           |
| email       | VARCHAR(120) | NULL                           |
| created_at  | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| udn_id      | INT          | FK -> UDN                      |
| active      | TINYINT(1)   | DEFAULT 1                      |
+-------------+--------------+--------------------------------+
```

### 5.6 `product` (Productos / Materiales)
```
+-------------------+--------------+----------------------------------------+
| Columna           | Tipo         | Notas                                  |
+-------------------+--------------+----------------------------------------+
| id                | INT PK AI    |                                        |
| code              | VARCHAR(20)  | 'PRD-001' (generado)                   |
| name              | VARCHAR(160) | NOT NULL                               |
| description       | TEXT         | NULL                                   |
| quantity          | DOUBLE       | stock actual, DEFAULT 0                |
| min_stock         | DOUBLE       | inventario mínimo, DEFAULT 0           |
| cost              | DOUBLE       | costo unitario, DEFAULT 0              |
| price             | DOUBLE       | precio de venta, DEFAULT 0             |
| created_at        | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| updated_at        | DATETIME     | ON UPDATE CURRENT_TIMESTAMP            |
| area_id           | INT          | FK -> areas.id                         |
| presentations_id  | INT          | FK -> presentations.id                 |
| group_id          | INT          | FK -> product_groups.id                |
| supplier_id       | INT          | FK -> supplier.id (NULL)               |
| udn_id            | INT          | FK -> UDN                              |
| active            | TINYINT(1)   | DEFAULT 1                              |
+-------------------+--------------+----------------------------------------+
```
> `quantity` se mantiene denormalizado en `product` (el código ya lo lee así). El kardex en `inventory_movement_detail` es la fuente de verdad para auditoría.

### 5.7 `inventory_movement` (Encabezado de movimiento)
```
+--------------------+--------------+----------------------------------------+
| id                 | INT PK AI    |                                        |
| folio              | VARCHAR(20)  | NOT NULL                               |
| date               | DATE         | fecha del movimiento                   |
| total_products     | INT          | DEFAULT 0                              |
| total_units        | DOUBLE       | DEFAULT 0                              |
| created_at         | DATETIME     | DEFAULT CURRENT_TIMESTAMP              |
| updated_at         | DATETIME     | ON UPDATE CURRENT_TIMESTAMP            |
| status             | VARCHAR(20)  | 'Activa'/'Cancelada' (ver nota)        |
| movement_type_id   | INT          | FK -> movement_type.id                 |
| user_id            | INT          | FK -> fayxzvov_erp.usuarios (cross)    |
| udn_id             | INT          | FK -> UDN                              |
| active             | TINYINT(1)   | DEFAULT 1                              |
+--------------------+--------------+----------------------------------------+
```
> El código actual guarda `status` como string ('Activa'/'Cancelada'). Recomendado: migrar a `movement_status_id` + catálogo `movement_status` para cumplir la regla anti-ENUM. Mientras tanto, `VARCHAR` + `active` cubre el borrado lógico.

### 5.8 `inventory_movement_detail` (Detalle / Kardex)
```
+------------------------+--------------+--------------------------------+
| id                     | INT PK AI    |                                |
| quantity               | DOUBLE       | cantidad del movimiento        |
| previous_stock         | DOUBLE       | stock antes del movimiento     |
| resulting_stock        | DOUBLE       | stock después del movimiento   |
| created_at             | DATETIME     | DEFAULT CURRENT_TIMESTAMP      |
| product_id             | INT          | FK -> product.id               |
| inventory_movement_id  | INT          | FK -> inventory_movement.id    |
| active                 | TINYINT(1)   | DEFAULT 1                      |
+------------------------+--------------+--------------------------------+
```
> FK `inventory_movement_id` con `ON DELETE CASCADE` (el detalle muere con su encabezado, igual que en reginas).

---

## 6. Tablas existentes en MySQL (referencia, NO recrear)

En `fayxzvov_reginas` (módulo POS, ya productivo) — **no tocar, solo referenciar si se unifica:**

```
inventory_inflow / detail_inventory_inflow
inventory_shrinkage / detail_inventory_shrinkage
inventory_transfer / detail_inventory_transfer / inventory_transfer_history
inventory_adjustment / detail_inventory_adjustment
inventory_movement · stock · supplier · warehouse · warehouse_area · unit · inflow_origin · order_products
```

Maestros corporativos (cross-schema, nunca duplicar):
```
fayxzvov_erp.usuarios          (responsable de movimiento — usado por almacén)
fayxzvov_alpha.subsidiaries    (sucursal — usado por POS)
fayxzvov_alpha.usr_users       (usuario — usado por POS)
fayxzvov_admin.companies       (empresa — usado por POS)
```

---

## 7. Auto-revisión (Fase 4 — Checklist §7 db-rules.md)

| # | Regla | ✔ |
|---|-------|---|
| 1 | Tablas en singular, inglés, `snake_case` | ✅ `product`, `inventory_movement`, `movement_type` |
| 2 | Engine InnoDB | ✅ Especificado |
| 3 | Charset utf8mb4 (collation según versión MySQL) | ✅ `utf8mb4_unicode_ci` (WAMP 5.7) |
| 4 | Montos en `DOUBLE` | ✅ `cost`, `price`, `quantity`, `total_units` |
| 5 | Estados extensibles = catálogo + FK, no ENUM | ⚠️ `movement_type` cumple; `status` queda como deuda (migrar a catálogo) |
| 6 | Borrado lógico `active = 0` | ✅ En todas las tablas |
| 7 | Maestros corporativos cross-schema, no duplicar | ✅ `usuarios`, `subsidiaries`, `companies` referenciados |
| 8 | Columnas obligatorias `id`, `created_at`, `active` | ✅ Presentes |
| 9 | Orden de columnas `id→negocio→montos→fechas→status→FKs→active` | ✅ Aplicado |
| 10 | FK de detalle con `ON DELETE CASCADE` | ✅ `inventory_movement_detail` |

---

## 8. Conclusión y siguientes pasos

1. **Crear el esquema `fayxzvov_almacen`** con las 8 tablas de la §5 (es el bloqueante real: el código ya lo invoca pero no existe).
2. Poblar `movement_type` (Entrada=+1, Salida=-1).
3. Decidir a nivel negocio si el módulo de **operación/almacén** se mantiene separado o se **unifica** con el inventario POS de `fayxzvov_reginas` (recomendado a mediano plazo para evitar dos kardex paralelos).
4. Migrar `inventory_movement.status` (string) y los `enum` de reginas a **catálogos + FK** para cumplir la regla anti-ENUM de la casa.

> Solo se generan `CREATE TABLE` ejecutables si lo pides explícitamente. Avísame y entrego el DDL completo de `fayxzvov_almacen`.
