# Propuesta de base de datos — Módulo Inventory / Almacén (insumos)

> ⚠️ **Actualización jun-2026 (migración `subsidiaries` → `branches`):** en el esquema
> vivo y en el código, la columna de sucursal del módulo es **`branch_id`** y referencia
> **`fayxzvov_erp.branches`** (no `subsidiaries`). Donde este documento diga `subsidiaries_id`
> o la tabla `subsidiaries`, léase `branch_id` / `branches`. Ver `ddl-inventory.sql`.

> Documento generado por **Coffee Intelligence 🧠☕** siguiendo `db-rules.md` (CoffeeSoft/Huubie).
> Fecha: 2026-06-04 · Proyecto: `c:\wamp64\www\huubie\inventory`
> **Revisión 5** — reestructurada al **formato canónico Coffee Intelligence** (Inspección → Modelo lógico → Estructura → Checklist → Notas). Esquema espejo (Entrada/Salida) con **tenant propio `companies → subsidiaries` en `fayxzvov_erp`** (módulo vendible).
> 📐 Ficha **exhaustiva** por tabla (todas las columnas y las 45 FKs) → ver [diagramas-er-inventory.md](diagramas-er-inventory.md).

---

## 🔍 Inspección del template

El "template" son las **5 pantallas** del módulo `operacion/almacen` (inventario simple, mono-almacén,
hoy cableado a `fayxzvov_almacen.` — esquema que no existe en MySQL, por eso el módulo no opera):

| Pantalla | Modelo | Tablas actuales (`fayxzvov_almacen`) |
|----------|--------|--------------------------------------|
| Almacén / Materiales | `mdl/mdl-almacen.php` | `product`, `areas`, `presentations`, `product_groups`, `supplier` |
| Catálogo | `mdl/mdl-catalogo.php` | `presentations`, `product_groups`, `areas` |
| Inventario (movimientos) | `mdl/mdl-inventario.php` | `inventory_movement`, `inventory_movement_detail`, `movement_type`, `product` |
| Existencias | `mdl/mdl-existencias.php` | `product` + `inventory_movement*` |
| Dashboard | `mdl/mdl-dashboard.php` | `product`, `inventory_movement*` |

Leído como dominio de negocio:

- **Eventos raíz (2):** una **Entrada** de almacén (`inventory_inflow`) y una **Salida / merma** (`inventory_shrinkage`). Sin traspasos ni ajustes — alcance acotado a Entrada/Salida.
- **Catálogos (tenant):** clasificación de insumo (`item_category`), unidad de medida (`unit`), área física (`warehouse_area`).
- **Sub-catálogos (globales):** origen de entrada (`inflow_origin`), motivo de salida (`shrinkage_reason`) — los exigen las cabeceras como FK.
- **Detalles:** renglones de cada evento → `detail_inventory_inflow`, `detail_inventory_shrinkage`.
- **Maestros:** insumo partido en comercial (`item`) + inventario (`item_attribute`); proveedor (`supplier`); almacén físico (`warehouse`); existencia por insumo+almacén (`stock`).
- **Pivotes N:M:** ninguno.
- **Maestros corporativos (cross-schema, `fayxzvov_erp`):** tenant `companies` → `subsidiaries`, identidad `users`. Aquí se **crean nuevos** (módulo vendible) y se referencian por FK desde el módulo.
- **Estados / flujo:** `status` (Pendiente / Aplicada / Cancelada). Hoy `VARCHAR` (deuda heredada de reginas; lo correcto sería catálogo + FK).
- **Montos:** `DOUBLE` — `price`, `cost_unit`, `subtotal`, `total_cost`, `quantity`, stocks.
- **Fechas:** operación = `DATE` (`date_inflow`, `date_shrinkage`); auditoría = `DATETIME` (`created_at` / `updated_at`).

> Rasgos del modelo viejo a sustituir: tenant `udn_id` (plano), stock denormalizado en `product.quantity`,
> movimiento genérico con catálogo `movement_type`. El ERP (`fayxzvov_erp`) **no** tiene jerarquía
> empresa→sucursal: `udn` es plano y `usuarios.usr_udn` liga a una sola UDN.

---

## 🗂 Modelo lógico

### Tablas propuestas

| Tabla | Clase | Tenant | Estado |
|-------|-------|--------|--------|
| `companies` | Tenant (cross-schema `fayxzvov_erp`) | raíz | **[NUEVO]** |
| `subsidiaries` | Tenant (cross-schema `fayxzvov_erp`) | `companies_id` | **[NUEVO]** |
| `users` | Identidad (cross-schema `fayxzvov_erp`) | `companies_id` + `subsidiaries_id` | **[NUEVO]** (reemplaza `usuarios`) |
| `item_category` | Catálogo | `companies_id` | **[NUEVO]** |
| `unit` | Catálogo | `companies_id` | **[NUEVO]** |
| `warehouse_area` | Catálogo | `companies_id` | **[NUEVO]** |
| `inflow_origin` | Sub-catálogo | global | **[NUEVO]** |
| `shrinkage_reason` | Sub-catálogo | global | **[NUEVO]** |
| `supplier` | Maestro | `companies_id` | **[NUEVO]** |
| `item` | Maestro (datos comerciales) | `companies_id` (+ `subsidiaries_id` NULL) | **[NUEVO]** |
| `item_attribute` | Maestro (datos de inventario) | `companies_id` | **[NUEVO]** |
| `warehouse` | Maestro | `companies_id` + `subsidiaries_id` | **[NUEVO]** |
| `stock` | Existencias | `companies_id` | **[NUEVO]** |
| `inventory_inflow` | Transacción raíz (Entrada) | `companies_id` + `subsidiaries_id` | **[NUEVO]** |
| `detail_inventory_inflow` | Detalle | — | **[NUEVO]** |
| `inventory_shrinkage` | Transacción raíz (Salida) | `companies_id` + `subsidiaries_id` | **[NUEVO]** |
| `detail_inventory_shrinkage` | Detalle | — | **[NUEVO]** |
| `inventory_movement` | Kardex (lectura) | `companies_id` + `subsidiaries_id` | **[NUEVO]** |

> Cross-schema (`fayxzvov_erp`): `companies` y `subsidiaries` (tenant), `users` (responsable).
> `udn` queda como legacy referenciado solo por `companies.udn_id`.

### 🗺️ Diagrama de relaciones

> **Convención**: caja **doble borde** `╔══╗` = tabla del módulo `fayxzvov_almacen` (se crea con el módulo).
> Caja **borde simple** `┌──┐` = tabla **del ERP** `fayxzvov_erp` (tenant/usuario). En cada flecha la
> cardinalidad va pegada y el lado **`N` porta la FK** y apunta al lado `1`.

```text
LEYENDA   ╔═╗ tabla de fayxzvov_almacen (se crea)      ┌─┐ tabla de fayxzvov_erp (identidad)
          A ──N:1──▶ B   =  A porta la FK; hay muchos A por cada B

─── TENANT (identidad · fayxzvov_erp) ─────────────────────────────────
   ┌──────────────┐ udn_id NULL        ┌───────────┐
   │  companies   │───────────────────▶│    udn    │   (legacy · puente)
   └──────┬───────┘                    └───────────┘
          │ 1
          │ N
   ┌──────▼───────┐        ┌────────────────────────────┐
   │ subsidiaries │◀───────│            users           │
   └──────────────┘  N:1   │ companies_id    (oblig)    │
        ▲ N:1   ┌──────────│ subsidiaries_id (NULL)     │
        └───────┘          └────────────────────────────┘
          companies_id / subsidiaries_id en las tablas raíz de ↓

─── INSUMO ────────────────────────────────────────────────────────────
   ╔════════════════════╗
   ║        item        ║ ──N:1──▶ item_category
   ╚═════════▲══════════╝ ──N:1──▶ companies · subsidiaries (NULL)
             │ 1   (1 atributo activo por insumo)
             │ N
   ╔═════════╧══════════╗ ──N:1──▶ unit
   ║   item_attribute   ║ ──N:1──▶ warehouse_area
   ╚════════════════════╝ ──N:1──▶ companies

─── ALMACÉN + EXISTENCIAS ─────────────────────────────────────────────
   ╔════════════════════╗ ──N:1──▶ warehouse_area
   ║      warehouse     ║ ──N:1──▶ subsidiaries · companies
   ╚═════════▲══════════╝
             │ 1
             │ N
   ╔═════════╧══════════╗ ──N:1──▶ item
   ║        stock       ║ ──N:1──▶ companies
   ╚════════════════════╝   UNIQUE (item_id, warehouse_id) → 1 fila por insumo+almacén

─── ENTRADA  (movimiento «Entrada») ───────────────────────────────────
   ╔════════════════════╗ ──N:1──▶ inflow_origin · warehouse
   ║  inventory_inflow  ║ ──N:1──▶ supplier (opcional)
   ╚═════════▲══════════╝ ──N:1──▶ users user_id / confirmed_user_id · companies · subsidiaries
             │ 1
             │ N
   ╔═════════╧════════════════╗ ──N:1──▶ item · unit
   ║ detail_inventory_inflow  ║   FK inventory_inflow_id → ON DELETE CASCADE
   ╚══════════════════════════╝

─── SALIDA  (movimiento «Salida») ─────────────────────────────────────
   ╔════════════════════╗ ──N:1──▶ shrinkage_reason · warehouse
   ║ inventory_shrinkage ║ ──N:1──▶ users · companies · subsidiaries
   ╚═════════▲══════════╝
             │ 1
             │ N
   ╔═════════╧══════════════════╗ ──N:1──▶ item
   ║ detail_inventory_shrinkage ║   FK inventory_shrinkage_id → ON DELETE CASCADE
   ╚════════════════════════════╝

─── KARDEX  (solo lectura: Existencias · Dashboard · historial) ───────
   ╔════════════════════╗ ──N:1──▶ item · warehouse
   ║ inventory_movement ║ ──N:1──▶ users · companies · subsidiaries
   ╚════════════════════╝   movement_type = 'ENTRADA' | 'MERMA'
```

### Cardinalidades

> Lado **N** = el que porta la FK y apunta al lado **1**. `erp` = `fayxzvov_erp`, `almacen` = `fayxzvov_almacen`.

| Tabla (lado **N**) | FK | → Tabla (lado **1**) | Schema | Card. | Nota |
|--------------------|----|----------------------|--------|-------|------|
| `subsidiaries` | `companies_id` | `companies` | erp | N:1 | jerarquía empresa→sucursal |
| `companies` | `udn_id` | `udn` | erp | N:1 | puente legacy |
| `users` | `companies_id` | `companies` | erp | N:1 | empresa del usuario |
| `users` | `subsidiaries_id` | `subsidiaries` | erp | N:1 | NULL = todas las sucursales |
| `item_category` | `companies_id` | `companies` | erp | N:1 | tenant |
| `unit` | `companies_id` | `companies` | erp | N:1 | tenant |
| `warehouse_area` | `companies_id` | `companies` | erp | N:1 | tenant |
| `item` | `category_id` | `item_category` | almacen | N:1 | clasificación |
| `item` | `companies_id` | `companies` | erp | N:1 | tenant |
| `item` | `subsidiaries_id` | `subsidiaries` | erp | N:1 | NULL = compartido en la empresa |
| `item_attribute` | `item_id` | `item` | almacen | N:1 | 1 atributo activo por producto |
| `item_attribute` | `unit_id` | `unit` | almacen | N:1 | unidad de medida |
| `item_attribute` | `warehouse_area_id` | `warehouse_area` | almacen | N:1 | ubicación sugerida (NULL) |
| `item_attribute` | `companies_id` | `companies` | erp | N:1 | tenant |
| `stock` | `item_id` | `item` | almacen | N:1 | parte de única |
| `stock` | `warehouse_id` | `warehouse` | almacen | N:1 | parte de única |
| `stock` | `companies_id` | `companies` | erp | N:1 | tenant |
| `warehouse` | `warehouse_area_id` | `warehouse_area` | almacen | N:1 | área física (NULL) |
| `warehouse` | `subsidiaries_id` | `subsidiaries` | erp | N:1 | sucursal del almacén |
| `warehouse` | `companies_id` | `companies` | erp | N:1 | tenant |
| `supplier` | `companies_id` | `companies` | erp | N:1 | tenant |
| `inventory_inflow` | `inflow_origin_id` | `inflow_origin` | almacen | N:1 | origen |
| `inventory_inflow` | `warehouse_id` | `warehouse` | almacen | N:1 | almacén destino |
| `inventory_inflow` | `supplier_id` | `supplier` | almacen | N:1 | opcional |
| `inventory_inflow` | `user_id` / `confirmed_user_id` | `users` | erp | N:1 | captura / confirma |
| `inventory_inflow` | `companies_id` · `subsidiaries_id` | `companies` · `subsidiaries` | erp | N:1 | tenant |
| `detail_inventory_inflow` | `inventory_inflow_id` | `inventory_inflow` | almacen | N:1 | **ON DELETE CASCADE** |
| `detail_inventory_inflow` | `item_id` | `item` | almacen | N:1 | renglón |
| `detail_inventory_inflow` | `unit_id` | `unit` | almacen | N:1 | unidad del renglón |
| `inventory_shrinkage` | `shrinkage_reason_id` | `shrinkage_reason` | almacen | N:1 | motivo |
| `inventory_shrinkage` | `warehouse_id` | `warehouse` | almacen | N:1 | almacén origen |
| `inventory_shrinkage` | `user_id` | `users` | erp | N:1 | captura |
| `inventory_shrinkage` | `companies_id` · `subsidiaries_id` | `companies` · `subsidiaries` | erp | N:1 | tenant |
| `detail_inventory_shrinkage` | `inventory_shrinkage_id` | `inventory_shrinkage` | almacen | N:1 | **ON DELETE CASCADE** |
| `detail_inventory_shrinkage` | `item_id` | `item` | almacen | N:1 | renglón |
| `inventory_movement` | `item_id` | `item` | almacen | N:1 | kardex |
| `inventory_movement` | `warehouse_id` | `warehouse` | almacen | N:1 | kardex |
| `inventory_movement` | `user_id` | `users` | erp | N:1 | responsable |
| `inventory_movement` | `companies_id` · `subsidiaries_id` | `companies` · `subsidiaries` | erp | N:1 | tenant |

---

## ✅ Estructura de tablas

> Orden de columnas (regla de la casa): `id → negocio → montos → timestamps → status → active → FKs`.
> Montos en `DOUBLE`; borrado lógico `active TINYINT(1) DEFAULT 1`.
> **Tenant:** `companies_id` (NOT NULL) → `fayxzvov_erp.companies`; `subsidiaries_id` → `fayxzvov_erp.subsidiaries` donde aplica.

### 1. Identidad / Tenant (cross-schema · `fayxzvov_erp`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ companies  (tenant raíz — cuenta cliente que compra el módulo)       │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(160)   NOT NULL                      │
│  rfc                    VARCHAR(20)    NULL                          │
│  email                  VARCHAR(120)   NULL                          │
│  phone                  VARCHAR(20)    NULL                          │
│  logo                   VARCHAR(255)   NULL · URL                    │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK puente ──                                                    │
│  udn_id                 → fayxzvov_erp.udn  (NULL · legacy)          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ subsidiaries  (sucursal de la empresa)                               │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(160)   NOT NULL                      │
│  address                VARCHAR(255)   NULL                          │
│  phone                  VARCHAR(20)    NULL                          │
│  is_main                TINYINT(1)     DEFAULT 0 (matriz)            │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK jerarquía ──                                                 │
│  companies_id           → companies.id                               │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ users  (identidad del módulo · reemplaza a usuarios legacy)          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  fullname               VARCHAR(160)   nombre completo               │
│  username               VARCHAR(60)    usuario de acceso · único     │
│  email                  VARCHAR(120)   NULL                          │
│  password               VARCHAR(255)   hash bcrypt/argon2            │
│  phone                  VARCHAR(20)    NULL                          │
│  photo                  VARCHAR(255)   NULL · avatar                 │
│                                                                      │
│  ── Status ──                                                        │
│  login_attempts         INT            DEFAULT 0                     │
│  last_login_at          DATETIME       NULL                          │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│  updated_at             DATETIME       ON UPDATE CURRENT_TIMESTAMP   │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  role_id                → perfiles.idPerfil   (rol / perfil)         │
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → companies.id    (obligatorio)              │
│  subsidiaries_id        → subsidiaries.id (NULL = todas)             │
│                                                                      │
│  ── FK puente ──                                                    │
│  legacy_user_id         → usuarios.idUser (NULL · migración)         │
└──────────────────────────────────────────────────────────────────────┘
```

Reglas del tenant:
- **`companies`** es el tenant raíz (cuenta del cliente). Su `udn_id` (NULL) mantiene compatibilidad con el ERP; los clientes nuevos lo dejan vacío.
- **`subsidiaries`** cuelga de `companies` (1:N). Una empresa tiene N sucursales; `is_main` marca la matriz.
- **`users.companies_id`** obligatorio; **`users.subsidiaries_id` NULL** ⇒ el usuario ve **todas** las sucursales de su empresa (admin). Con valor ⇒ acotado a esa sucursal (operador).
- **Siembra inicial:** por cada `udn` existente se crea una `companies` (`udn_id` = el idUDN), una `subsidiaries` `is_main = 1`, y se rellena `companies_id` de los usuarios según su `usr_udn`.

### 2. Catálogos (`fayxzvov_almacen`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ item_category  (catálogo — clasificación de insumos)                 │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(120)   nombre de categoria           │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → fayxzvov_erp.companies                     │
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
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → fayxzvov_erp.companies                     │
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
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 3. Sub-catálogos (globales · sin tenant)

```
┌──────────────────────────────────────────────────────────────────────┐
│ inflow_origin  (sub-catálogo — origen de entradas · global)          │
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
│ shrinkage_reason  (sub-catálogo — motivos de salida · global)        │
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

### 4. Maestros (`fayxzvov_almacen`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ supplier  (proveedores)                                              │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(160)   NOT NULL                      │
│  contact_name           VARCHAR(120)   NULL                          │
│  phone                  VARCHAR(20)    NULL                          │
│  email                  VARCHAR(120)   NULL                          │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ item  (insumo · datos generales / comerciales)                       │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(160)   NOT NULL                      │
│  image                  VARCHAR(255)   NULL                          │
│                                                                      │
│  ── Montos ──                                                        │
│  price                  DOUBLE         precio referencia, DEFAULT 0  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  category_id            → item_category.id                           │
│                                                                      │
│  ── FK tenant ──                                                    │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries (NULL)           │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ item_attribute  (datos de inventario del insumo)                     │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  sku                    VARCHAR(40)    codigo de inventario          │
│  description            VARCHAR(255)   NULL                          │
│  shelf_life_days        INT            caducidad en dias, NULL       │
│                                                                      │
│  ── Montos ──                                                        │
│  cost_unit              DOUBLE         costo unitario, DEFAULT 0     │
│  stock_min              DOUBLE         inventario minimo, DEFAULT 0  │
│  stock_max              DOUBLE         inventario maximo, NULL       │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  warehouse_area_id      → warehouse_area.id  (NULL)                  │
│  unit_id                → unit.id                                    │
│  item_id                → item.id                                    │
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ warehouse  (almacén físico)                                          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  name                   VARCHAR(120)   NOT NULL                      │
│  is_default             TINYINT(1)     DEFAULT 0                     │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  warehouse_area_id      → warehouse_area.id  (NULL)                  │
│                                                                      │
│  ── FK tenant ──                                                    │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ stock  (existencia por insumo + almacén)                             │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Montos ──                                                        │
│  quantity               DOUBLE         existencia actual, DEFAULT 0  │
│                                                                      │
│  ── Timestamps ──                                                    │
│  last_movement_at       DATETIME       NULL                          │
│  last_inventory_at      DATETIME       NULL (ultimo conteo)          │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│  updated_at             DATETIME       ON UPDATE CURRENT_TIMESTAMP   │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  warehouse_id           → warehouse.id                               │
│  item_id                → item.id                                    │
│                                                                      │
│  ── FK tenant ──                                                    │
│  companies_id           → fayxzvov_erp.companies                     │
│                                                                      │
│  ── Único ──                                                        │
│  uk_stock               (item_id, warehouse_id)                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 5. Transacciones raíz

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_inflow  (transacción raíz — encabezado de entrada)         │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  folio                  VARCHAR(20)    NOT NULL                      │
│  note                   VARCHAR(255)   NULL                          │
│  total_products         INT            DEFAULT 0                     │
│                                                                      │
│  ── Montos ──                                                        │
│  total_units            DOUBLE         DEFAULT 0                     │
│  total_cost             DOUBLE         DEFAULT 0                     │
│                                                                      │
│  ── Timestamps ──                                                    │
│  date_inflow            DATE           CURDATE() del servidor        │
│  confirmed_at           DATETIME       NULL                          │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│  updated_at             DATETIME       ON UPDATE CURRENT_TIMESTAMP   │
│                                                                      │
│  ── Status ──                                                        │
│  status                 VARCHAR(20)    Pendiente/Aplicada/Cancelada  │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  inflow_origin_id       → inflow_origin.id                           │
│  warehouse_id           → warehouse.id                               │
│  supplier_id            → supplier.id   (NULL)                       │
│                                                                      │
│  ── FK usuario ──                                                   │
│  user_id                → users.id                                   │
│  confirmed_user_id      → users.id                                   │
│                                                                      │
│  ── FK tenant ──                                                    │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ inventory_shrinkage  (transacción raíz — encabezado de salida/merma) │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  folio                  VARCHAR(20)    NOT NULL                      │
│  note                   VARCHAR(255)   NULL                          │
│  total_products         INT            DEFAULT 0                     │
│                                                                      │
│  ── Montos ──                                                        │
│  total_units            DOUBLE         DEFAULT 0                     │
│  total_cost             DOUBLE         DEFAULT 0                     │
│                                                                      │
│  ── Timestamps ──                                                    │
│  date_shrinkage         DATE           fecha de la salida            │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│  updated_at             DATETIME       ON UPDATE CURRENT_TIMESTAMP   │
│                                                                      │
│  ── Status ──                                                        │
│  status                 VARCHAR(20)    Aplicada/Cancelada            │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK negocio ──                                                   │
│  shrinkage_reason_id    → shrinkage_reason.id                        │
│  warehouse_id           → warehouse.id                               │
│                                                                      │
│  ── FK usuario ──                                                   │
│  user_id                → users.id                                   │
│                                                                      │
│  ── FK tenant ──                                                    │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 6. Detalles

```
┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_inflow  (detalle — renglones de entrada)            │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  batch_code             VARCHAR(40)    lote, NULL                    │
│                                                                      │
│  ── Montos ──                                                        │
│  quantity               DOUBLE         cantidad reportada            │
│  confirmed_quantity     DOUBLE         cantidad real al aplicar      │
│  cost                   DOUBLE         costo unitario                │
│  subtotal               DOUBLE         quantity * cost               │
│  previous_stock         DOUBLE         stock antes                   │
│  resulting_stock        DOUBLE         stock despues                 │
│                                                                      │
│  ── Timestamps ──                                                    │
│  expires_at             DATE           caducidad del lote, NULL      │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK ──                                                           │
│  item_id                → item.id                                    │
│  inventory_inflow_id    → inventory_inflow.id (ON DELETE CASCADE)    │
│  unit_id                → unit.id                                    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_shrinkage  (detalle — renglones de salida)          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Montos ──                                                        │
│  quantity               DOUBLE         cantidad de salida            │
│  cost                   DOUBLE         costo unitario                │
│  subtotal               DOUBLE         quantity * cost               │
│  previous_stock         DOUBLE         stock antes                   │
│  resulting_stock        DOUBLE         stock despues                 │
│                                                                      │
│  ── Timestamps ──                                                    │
│  created_at             DATETIME       DEFAULT CURRENT_TIMESTAMP     │
│                                                                      │
│  ── Soft-delete ──                                                   │
│  active                 TINYINT(1)     DEFAULT 1                     │
│                                                                      │
│  ── FK ──                                                           │
│  item_id                → item.id                                    │
│  inventory_shrinkage_id → inventory_shrinkage.id (ON DELETE CASCADE) │
└──────────────────────────────────────────────────────────────────────┘
```

### 7. Kardex (lectura para Existencias / Dashboard / historial)

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_movement  (kardex unificado · solo lectura)                │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK         identificador único           │
│                                                                      │
│  ── Negocio ──                                                       │
│  movement_uid           VARCHAR(40)    id logico del movimiento      │
│  movement_type          VARCHAR(20)    ENTRADA / MERMA               │
│  folio                  VARCHAR(20)    folio del header origen       │
│  note                   VARCHAR(255)   NULL                          │
│                                                                      │
│  ── Montos ──                                                        │
│  quantity               DOUBLE         + entra / - sale              │
│  stock_prev             DOUBLE         stock antes                   │
│  stock_post             DOUBLE         stock despues                 │
│  cost_unit              DOUBLE         costo unitario                │
│  cost_total             DOUBLE         quantity * cost_unit          │
│                                                                      │
│  ── Timestamps ──                                                    │
│  occurred_at            DATETIME       momento del movimiento        │
│                                                                      │
│  ── Status ──                                                        │
│  status                 VARCHAR(20)    espejo del header             │
│                                                                      │
│  ── FK negocio ──                                                   │
│  item_id                → item.id                                    │
│  warehouse_id           → warehouse.id                               │
│                                                                      │
│  ── FK usuario ──                                                   │
│  user_id                → users.id                                   │
│                                                                      │
│  ── FK tenant ──                                                    │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘
```

> 📐 La **ficha exhaustiva por tabla** (todas las columnas, las 45 FKs y las conexiones por sección)
> vive en el archivo hermano [diagramas-er-inventory.md](diagramas-er-inventory.md). Se regenera cada
> vez que cambie esta propuesta.

---

## 🧪 Checklist de validación (§7 db-rules.md)

| # | Regla | ✔ |
|---|-------|---|
| 1 | Tablas en singular, inglés, `snake_case` | ✅ `item`, `companies`, `subsidiaries`, `inventory_inflow` |
| 2 | Engine InnoDB | ✅ |
| 3 | Charset utf8mb4 (`utf8mb4_unicode_ci`, WAMP 5.7) | ✅ |
| 4 | Montos en `DOUBLE` | ✅ `cost_unit`, `price`, `subtotal`, `total_cost`, `quantity` |
| 5 | Estados extensibles = catálogo + FK, no ENUM | ⚠️ `status` sigue como `VARCHAR` (deuda heredada de reginas) |
| 6 | Borrado lógico `active = 0` | ✅ en todas |
| 7 | `detail_` solo en renglones de transacción raíz | ✅ `detail_inventory_inflow`, `detail_inventory_shrinkage` |
| 8 | Maestros corporativos cross-schema, no duplicar | ✅ `companies`/`subsidiaries`/`users` viven en `fayxzvov_erp` |
| 9 | Orden de columnas `id→negocio→montos→fechas→status→active→FKs` | ✅ FKs y tenant al final |
| 10 | FK de detalle con `ON DELETE CASCADE` | ✅ |

---

## 💡 Notas

### Decisión de diseño (acordada)

El módulo se piensa como **producto vendible**, así que el tenant deja de ser el `udn` plano y pasa a una jerarquía multi-tenant real **dentro del ERP**.

| Punto | Decisión | Implicación |
|-------|----------|-------------|
| **Estrategia de esquema** | **Espejo propio** — `fayxzvov_almacen` con la **estructura** de reginas. | Operación y POS separados pero con estructura paralela; unificar después es directo. |
| **Alcance de movimientos** | **Solo Entrada / Salida**. | **Entrada → `inventory_inflow`**, **Salida → `inventory_shrinkage`**. Sin traspasos ni ajustes. |
| **Tenant** | **`companies_id` + `subsidiaries_id`**, tablas **nuevas en `fayxzvov_erp`**. | Multi-empresa / multi-sucursal real, con identidad propia (no depende de `fayxzvov_alpha`/`admin` de reginas). |
| **Compatibilidad `udn`** | `companies.udn_id` = **puente** al `udn` legacy. | El login y otros módulos que filtran por `usr_udn` siguen vivos mientras se migra. |
| **Usuario** | `fayxzvov_erp.users` + `companies_id` (oblig.) y `subsidiaries_id` (NULL = todas). | Admins a nivel empresa; operadores a nivel sucursal. |
| **Ubicación física** | `warehouse` cuelga de `subsidiaries`. | Stock multi-almacén por sucursal. |
| **Stock** | Tabla `stock` por producto + almacén. | `product.quantity` deja de ser la fuente de verdad. |

> Resultado: el tenant `companies_id`/`subsidiaries_id` queda **idéntico en concepto a reginas**, pero administrado por el propio ERP — listo para vender el módulo a clientes nuevos (1 cliente = 1 `companies` + sus `subsidiaries` + usuarios). Este inventario es de **insumos** (`item`), no de productos de venta como reginas.

### Referencia de estructura (plan reginas)

Inventario **multi-empresa / multi-sucursal / multi-almacén** confirmado en `app/inventarios/mdl/mdl-inventarios.php`: tenant `companies_id` + `subsidiaries_id`; producto partido en maestro comercial + atributos de inventario; existencias en `stock` con única `(item_id, warehouse_id)`; movimientos por tipo con su `detail_*` + kardex unificado; montos en `DOUBLE`, borrado lógico, timestamps. El espejo **toma esta estructura** pero **con tenant propio en `fayxzvov_erp`** (`companies`/`subsidiaries`/`users`). Las tablas del maestro de producto se nombran `item` y `item_attribute`.

### Mapeo viejo → nuevo (espejo + tenant `companies`/`subsidiaries`)

| Tabla actual (v1) | Tabla del espejo | Acción |
|-------------------|------------------|--------|
| `product` | **`item` + `item_attribute`** | **Partir en dos.** name/price/category/image → `item`; sku/cost/stock_min/stock_max/unidad → `item_attribute`. |
| *(no existía)* | **`stock`** | **Nueva.** Existencia por producto + almacén. `product.quantity` se elimina. |
| *(no existía)* | **`warehouse`** | **Nueva.** Almacén físico, FK a `subsidiaries`. |
| `areas` (UI "Zona") | **`warehouse_area`** | Renombre + `color_hex`, `description`; tenant `companies_id`. |
| `presentations` (UI "Categoría") | **`unit`** | Unidad de medida (`code`, `name`); tenant `companies_id`. |
| `product_groups` (UI "Área") | **`item_category`** | Clasificación de producto (`name`); tenant `companies_id`. |
| `movement_type` | *(se elimina)* | El tipo lo da la **tabla destino** y `inventory_movement.movement_type`. |
| `supplier` | **`supplier`** | Vive en `fayxzvov_almacen`. Gana `contact_name`; tenant `companies_id`. |
| `inventory_movement` (header) | **`inventory_inflow`** + **`inventory_shrinkage`** | Header se **divide por tipo**. |
| `inventory_movement_detail` | **`detail_inventory_inflow`** + **`detail_inventory_shrinkage`** | Detalle gana `cost`, `subtotal`, `unit_id`, lote/caducidad. |
| *(no existía)* | **`inventory_movement`** (kardex) | **Nueva.** Vista denormalizada para Existencias/Dashboard/historial. |
| *(no existía)* | **`inflow_origin`**, **`shrinkage_reason`** | **Sub-catálogos globales** que entradas/salidas exigen como FK. |
| `udn_id` (en todas) | **`companies_id` + `subsidiaries_id`** | Tenant jerárquico real (en `fayxzvov_erp`). |

### Cambios de campo respecto a la propuesta v1

1. **`product` → se elimina.** Datos comerciales en `item`, de inventario en `item_attribute`.
2. **`product.quantity` → se elimina.** El stock vive en `stock.quantity` por almacén.
3. **`product.code` → `item_attribute.sku`** (texto libre; ya no se autogenera `PRD-###`).
4. **`udn_id` → `companies_id` + `subsidiaries_id`** (tenant jerárquico nuevo en `fayxzvov_erp`). `udn` queda como puente vía `companies.udn_id`.
5. **Usuario:** `users.id`; el alcance lo definen `companies_id` / `subsidiaries_id`.
6. **`areas` → `warehouse_area`**, **`presentations` → `unit`**, **`product_groups` → `item_category`**.
7. **`movement_type` → eliminado**; el signo lo da la tabla destino.
8. **`inventory_movement` (header) → `inventory_inflow` + `inventory_shrinkage`**.
9. **`inventory_movement_detail` → `detail_inventory_inflow` + `detail_inventory_shrinkage`**; el detalle gana `cost`, `subtotal`, `unit_id`, `batch_code`, `expires_at`.
10. **Nuevas en ERP:** `companies`, `subsidiaries`, `users` (reemplaza `usuarios`). **Nuevas en módulo:** `stock`, `warehouse`, `inflow_origin`, `shrinkage_reason`, `inventory_movement` (kardex).

### Impacto en los modelos PHP y el login

| Pieza | Cambio principal |
|-------|------------------|
| **`fayxzvov_erp`** | Crear `companies`, `subsidiaries`, `users`; migrar `usuarios`→`users`. Sembrar 1 `companies` + 1 `subsidiaries` por udn existente. |
| **Login** (`acceso/`) | Resolver y poner en sesión `$_SESSION['companies_id']` y `$_SESSION['subsidiaries_id']` (de `companies_id`/`subsidiaries_id`). Si `subsidiaries_id` es NULL → selector de sucursal. |
| `mdl-almacen.php` | `product` → `item` JOIN `item_attribute`; catálogos → `item_category`/`unit`/`warehouse_area`; filtros por `companies_id`. |
| `mdl-catalogo.php` | CRUD de catálogos → `item_category`, `unit`, `warehouse_area` (filtro `companies_id`). |
| `mdl-inventario.php` | Alta por tipo: Entrada → `inventory_inflow`; Salida → `inventory_shrinkage`. Stock en `stock`. Inserta `companies_id` + `subsidiaries_id`. |
| `mdl-existencias.php` | Existencias = `SUM(stock.quantity)` vs `item_attribute.stock_min`, por `companies_id` (+ sucursal vía warehouse). |
| `mdl-dashboard.php` | KPIs leen `stock` + `inventory_movement`. |

> ⚠️ **Alcance ERP-wide:** crear `companies`/`subsidiaries` y tocar el login afecta a **todo el ERP**, no solo a almacén. Otros módulos que filtran por `usr_udn` siguen funcionando mientras `companies.udn_id` mantenga el puente. La migración del resto de módulos a `companies_id` es un proyecto aparte.

### Siguientes pasos

1. **ERP primero:** crear `companies` + `subsidiaries` + `users` en `fayxzvov_erp` y sembrar desde `udn` (1 companies + 1 subsidiaries `is_main` por UDN).
2. **Login:** exponer `companies_id` + `subsidiaries_id` en sesión (con selector de sucursal si `subsidiaries_id` es NULL).
3. **Crear `fayxzvov_almacen`** con las 15 tablas del módulo (las 18 cajas menos las 3 del tenant `fayxzvov_erp`), tenant `companies_id`/`subsidiaries_id`.
4. **Sembrar catálogos base:** `inflow_origin` ('Compra'), `shrinkage_reason` ('Merma'), `unit`, y un `warehouse` `is_default = 1` por sucursal.
5. **Reescribir los 5 modelos** según la tabla de impacto.

> ¿Genero el **DDL `CREATE TABLE` ejecutable** — primero el de identidad (`companies`/`subsidiaries`/`ALTER usuarios` en `fayxzvov_erp`) y luego el de `fayxzvov_almacen`? Avísame y lo entrego listo para el WAMP. (Ya existe `ddl-inventory.sql` como referencia del esquema vivo.)
