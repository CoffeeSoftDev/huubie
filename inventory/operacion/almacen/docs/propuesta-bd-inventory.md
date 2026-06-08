# Propuesta de Base de Datos — Módulo Inventory / Almacén

> ⚠️ **Actualización jun-2026 (migración `subsidiaries` → `branches`):** en el esquema
> vivo y en el código, la columna de sucursal del módulo es **`branch_id`** y referencia
> **`fayxzvov_erp.branches`** (no `subsidiaries`). Donde este documento diga `subsidiaries_id`
> o la tabla `subsidiaries`, léase `branch_id` / `branches`. Ver `ddl-inventory.sql`.

> Documento generado por **Coffee Intelligence 🧠☕** siguiendo `db-rules.md` (CoffeeSoft/Huubie).
> Fecha: 2026-06-04 · Proyecto: `c:\wamp64\www\huubie\inventory`
> **Revisión 4** — esquema espejo (Entrada/Salida) con **tenant propio `companies → subsidiaries` en `fayxzvov_erp`** (módulo vendible).

---

## 0. Decisión de diseño (acordada)

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

> Resultado: el tenant `companies_id`/`subsidiaries_id` queda **idéntico en concepto a reginas**, pero administrado por el propio ERP — listo para vender el módulo a clientes nuevos (1 cliente = 1 `companies` + sus `subsidiaries` + usuarios).

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

Rasgos del modelo viejo: tenant `udn_id` (plano); stock denormalizado en `product.quantity`; usuario vía `users.id`; movimiento genérico Entrada/Salida con catálogo `movement_type`.

Estado del ERP (`fayxzvov_erp`, 8 tablas): `usuarios`, `perfiles`, `permisos`, `modulos`, `submodulos`, `directorios`, `udn`, `ch_colaboradores`. **No existe** jerarquía empresa→sucursal: `udn` es plano y `usuarios.usr_udn` liga a una sola UDN.

---

## 2. El plan reginas (referencia de estructura)

Inventario **multi-empresa / multi-sucursal / multi-almacén** confirmado en `app/inventarios/mdl/mdl-inventarios.php`:

- Tenant `companies_id` + `subsidiaries_id` (en `fayxzvov_admin` / `fayxzvov_alpha`).
- Producto partido en **maestro comercial** + **tabla de atributos de inventario**.
- Existencias en **`stock`** con única `(item_id, warehouse_id)`.
- Movimientos **por tipo**: entradas, mermas, traspasos, ajustes, cada uno con su `detail_*`, más un **kardex unificado**.
- Montos en `DOUBLE`; borrado lógico `active`; `created_at`/`updated_at`.

> El espejo **toma esta estructura** pero **con tenant propio en `fayxzvov_erp`** (`companies`/`subsidiaries`/`users`) en vez del de reginas (`companies`/`subsidiaries`/`usr_users`). Las tablas del maestro de producto se nombran `item` y `item_attribute`.

---

## 3. Modelo de tenant propio en `fayxzvov_erp` (núcleo del módulo vendible)

Se crean **tres tablas nuevas** en el ERP: `companies`, `subsidiaries` y `users`. El módulo `fayxzvov_almacen` solo las referencia por FK.

```
┌──────────────────────────────────────────────────────────────────────┐
│ companies  (cuenta cliente — quien compra el módulo)                 │
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
│  ── FK puente ──                                                     │
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
│  ── FK jerarquía ──                                                  │
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
│  ── FK negocio ──                                                    │
│  role_id                → perfiles.idPerfil   (rol / perfil)         │
│                                                                      │
│  ── FK tenant ──                                                     │
│  companies_id           → companies.id    (obligatorio)              │
│  subsidiaries_id        → subsidiaries.id (NULL = todas)             │
│                                                                      │
│  ── FK puente ──                                                     │
│  legacy_user_id         → usuarios.idUser (NULL · migración)         │
└──────────────────────────────────────────────────────────────────────┘
```

Reglas:
- **`companies`** es el tenant raíz (cuenta del cliente). Su `udn_id` (NULL) mantiene compatibilidad con el ERP; los clientes nuevos lo dejan vacío.
- **`subsidiaries`** cuelga de `companies` (1:N). Una empresa tiene N sucursales; `is_main` marca la matriz.
- **`users.companies_id`** obligatorio; **`users.subsidiaries_id` NULL** ⇒ el usuario ve **todas** las sucursales de su empresa (admin). Con valor ⇒ acotado a esa sucursal (operador).
- **Siembra inicial:** por cada `udn` existente se crea una `companies` (`udn_id` = el idUDN), una `subsidiaries` `is_main = 1`, y se rellena `companies_id` de los usuarios según su `usr_udn`.

---

## 4. Mapeo viejo → nuevo (espejo + tenant `companies`/`subsidiaries`)

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

---

## 5. Clasificación de tablas del módulo `fayxzvov_almacen`

| Tipo | Tabla | Tenant | Rol |
|------|-------|--------|-----|
| Catálogo | `item_category` | `companies_id` | Clasificación de producto |
| Catálogo | `unit` | `companies_id` | Unidades de medida / presentación |
| Catálogo | `warehouse_area` | `companies_id` | Áreas físicas del almacén |
| Sub-catálogo | `inflow_origin` | global | Origen de entrada |
| Sub-catálogo | `shrinkage_reason` | global | Motivo de salida / merma |
| Maestro local | `warehouse` | `companies_id` + `subsidiaries_id` | Almacenes físicos (por sucursal) |
| Maestro local | `supplier` | `companies_id` | Proveedores (compartidos en la empresa) |
| Maestro local | `item` | `companies_id` (+ `subsidiaries_id` NULL) | Producto (datos comerciales) |
| Maestro local | `item_attribute` | `companies_id` | Producto (datos de inventario) |
| Existencias | `stock` | `companies_id` | Stock por producto + almacén |
| Evento raíz | `inventory_inflow` | `companies_id` + `subsidiaries_id` | Encabezado de entrada |
| Detalle | `detail_inventory_inflow` | — | Renglones de entrada (kardex) |
| Evento raíz | `inventory_shrinkage` | `companies_id` + `subsidiaries_id` | Encabezado de salida / merma |
| Detalle | `detail_inventory_shrinkage` | — | Renglones de salida (kardex) |
| Kardex | `inventory_movement` | `companies_id` + `subsidiaries_id` | Movimientos unificados (lectura) |

Cross-schema (mundo `fayxzvov_erp`): `companies` y `subsidiaries` (tenant), `users` (responsable). `udn` queda como legacy referenciado solo por `companies.udn_id`.

---

## 6. Diagrama de relaciones (cardinalidades)

> **Convención**: caja **doble borde** `╔══╗` = tabla del **esquema actual** `fayxzvov_almacen` (se crea con el módulo). Caja **borde simple** `┌──┐` = tabla **del ERP** `fayxzvov_erp` (tenant/usuario). En cada flecha la cardinalidad va pegada y el lado **`N` porta la FK** y apunta al lado `1`.

### 6.1 Mapa por capas

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

### 6.2 Tabla de relaciones (fuente de verdad)

| Tabla (lado **N**) | FK | → Tabla (lado **1**) | Schema destino | Card. | Nota |
|--------------------|----|----------------------|----------------|-------|------|
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

### 6.3 Vista por apartado (todas las relaciones)

> Cada **▦ tabla** está bajo su apartado funcional. `datos` = columnas propias; `FK →` = toda clave foránea (lo que en un ER visual va en verde) con la tabla a la que apunta. Aquí están **todas** las FKs del modelo (45 en total).

```text
LEYENDA   ▦ tabla        datos = columnas propias        FK → = foránea (verde) y su destino
          A ──1:N──▶ B   un A tiene muchos B            (PK) llave primaria · (NULL) opcional

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 1 ▸ TENANT / IDENTIDAD              esquema: fayxzvov_erp
═══════════════════════════════════════════════════════════════════════════════

   ▦ companies                                  (cuenta cliente)
       datos · id(PK) · name · rfc · email · phone · logo · created_at · active
       FK →  · udn_id → udn            (NULL · puente legacy)
         │
         │ 1:N
         ▼
   ▦ subsidiaries                               (sucursal)
       datos · id(PK) · name · address · phone · is_main · created_at · active
       FK →  · companies_id → companies
         │
         │ 1:N                          companies 1:N users  ·  subsidiaries 1:N users
         ▼
   ▦ users                                      (identidad · reemplaza usuarios)
       datos · id(PK) · fullname · username · email · password · phone · photo
              · login_attempts · last_login_at · created_at · updated_at · active
       FK →  · role_id → perfiles
              · companies_id → companies            (obligatorio)
              · subsidiaries_id → subsidiaries      (NULL = todas)
              · legacy_user_id → usuarios           (NULL · migración)

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 2 ▸ CATÁLOGOS                         esquema: fayxzvov_almacen
═══════════════════════════════════════════════════════════════════════════════

   ▦ item_category        datos · id(PK) · name · created_at · active
                         FK →  · companies_id → companies
   ▦ unit                datos · id(PK) · code · name · created_at · active
                         FK →  · companies_id → companies
   ▦ warehouse_area      datos · id(PK) · name · description · color_hex · created_at · active
                         FK →  · companies_id → companies
   ▦ inflow_origin       datos · id(PK) · code · name · icon · color_hex · requires_supplier · active
                         FK →  · (sin FK · catálogo global)
   ▦ shrinkage_reason    datos · id(PK) · code · name · icon · color_hex · active
                         FK →  · (sin FK · catálogo global)

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 3 ▸ PRODUCTO                          esquema: fayxzvov_almacen
═══════════════════════════════════════════════════════════════════════════════

   ▦ item                                   (datos comerciales)
       datos · id(PK) · name · image · price · created_at · active
       FK →  · category_id → item_category
              · subsidiaries_id → subsidiaries   (NULL = compartido)
              · companies_id → companies
         │
         │ 1:N  (1 atributo activo)
         ▼
   ▦ item_attribute                          (datos de inventario)
       datos · id(PK) · sku · description · shelf_life_days
              · cost_unit · stock_min · stock_max · created_at · active
       FK →  · warehouse_area_id → warehouse_area  (NULL)
              · unit_id → unit
              · item_id → item
              · companies_id → companies

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 4 ▸ ALMACÉN + EXISTENCIAS             esquema: fayxzvov_almacen
═══════════════════════════════════════════════════════════════════════════════

   ▦ warehouse                                  (almacén físico)
       datos · id(PK) · name · is_default · created_at · active
       FK →  · warehouse_area_id → warehouse_area  (NULL)
              · subsidiaries_id → subsidiaries
              · companies_id → companies
         │
         │ 1:N                          item 1:N stock
         ▼
   ▦ stock                                      (existencia · UNIQUE item_id+warehouse_id)
       datos · id(PK) · quantity · last_movement_at · last_inventory_at
              · created_at · updated_at · active
       FK →  · warehouse_id → warehouse
              · item_id → item
              · companies_id → companies

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 5 ▸ ENTRADAS DE ALMACÉN               (Producción · Proveedor · Transf · Devolución)
═══════════════════════════════════════════════════════════════════════════════

   ▦ inventory_inflow                           (encabezado)
       datos · id(PK) · folio · note · total_products · total_units · total_cost
              · date_inflow · confirmed_at · status · active
       FK →  · inflow_origin_id → inflow_origin   · warehouse_id → warehouse
              · supplier_id → supplier  (NULL)     · user_id → users
              · confirmed_user_id → users          · subsidiaries_id → subsidiaries
              · companies_id → companies
         │
         │ 1:N
         ▼
   ▦ detail_inventory_inflow                    (renglones)
       datos · id(PK) · batch_code · quantity · confirmed_quantity · cost · subtotal
              · previous_stock · resulting_stock · expires_at · active
       FK →  · item_id → item
              · inventory_inflow_id → inventory_inflow   (ON DELETE CASCADE)
              · unit_id → unit

   ▦ supplier                                   (proveedores · maestro)
       datos · id(PK) · name · contact_name · phone · email · created_at · active
       FK →  · companies_id → companies          ◀── lo usa inventory_inflow.supplier_id

   ▦ inflow_origin   ◀── lo usa inventory_inflow   (catálogo del apartado, ver Apartado 2)

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 6 ▸ SALIDAS DE ALMACÉN                (Merma · Salida · Consumo)
═══════════════════════════════════════════════════════════════════════════════

   ▦ inventory_shrinkage                        (encabezado)
       datos · id(PK) · folio · note · total_products · total_units · total_cost
              · date_shrinkage · status · active
       FK →  · shrinkage_reason_id → shrinkage_reason   · warehouse_id → warehouse
              · user_id → users                          · subsidiaries_id → subsidiaries
              · companies_id → companies
         │
         │ 1:N
         ▼
   ▦ detail_inventory_shrinkage                 (renglones)
       datos · id(PK) · quantity · cost · subtotal · previous_stock · resulting_stock · active
       FK →  · item_id → item
              · inventory_shrinkage_id → inventory_shrinkage   (ON DELETE CASCADE)

   ▦ shrinkage_reason   ◀── lo usa inventory_shrinkage   (catálogo del apartado, ver Apartado 2)

═══════════════════════════════════════════════════════════════════════════════
 APARTADO 7 ▸ KARDEX (lectura: Existencias · Dashboard · historial)
═══════════════════════════════════════════════════════════════════════════════

   ▦ inventory_movement                         (movimientos unificados)
       datos · id(PK) · movement_uid · movement_type('ENTRADA'|'MERMA') · folio · note
              · quantity · stock_prev · stock_post · cost_unit · cost_total
              · occurred_at · status
       FK →  · item_id → item      · warehouse_id → warehouse
              · user_id → users            · subsidiaries_id → subsidiaries
              · companies_id → companies
```

---

## 7. Estructura de tablas del módulo (Fase 3 — campos)

> Orden de columnas (regla de la casa): `id → negocio → montos → timestamps → status → active → FKs`.
> Montos en `DOUBLE`; borrado lógico `active TINYINT(1) DEFAULT 1`.
> **Tenant:** `companies_id` (NOT NULL) → `fayxzvov_erp.companies`; `subsidiaries_id` → `fayxzvov_erp.subsidiaries` donde aplica.

### 7.1 Catálogos

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
│  ── FK tenant ──                                                     │
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
│  ── FK tenant ──                                                     │
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
│  ── FK tenant ──                                                     │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

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

### 7.2 Maestros

```
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
│  ── FK negocio ──                                                    │
│  warehouse_area_id      → warehouse_area.id  (NULL)                  │
│                                                                      │
│  ── FK tenant ──                                                     │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

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
│  ── FK tenant ──                                                     │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ item  (insumo · datos generales)                                     │
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
│  ── FK negocio ──                                                    │
│  category_id            → item_category.id                           │
│                                                                      │
│  ── FK tenant ──                                                     │
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
│  ── FK negocio ──                                                    │
│  warehouse_area_id      → warehouse_area.id  (NULL)                  │
│  unit_id                → unit.id                                    │
│  item_id                → item.id                                    │
│                                                                      │
│  ── FK tenant ──                                                     │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.3 Existencias

```
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
│  ── FK negocio ──                                                    │
│  warehouse_id           → warehouse.id                               │
│  item_id                → item.id                                    │
│                                                                      │
│  ── FK tenant ──                                                     │
│  companies_id           → fayxzvov_erp.companies                     │
│                                                                      │
│  ── Único ──                                                         │
│  uk_stock               (item_id, warehouse_id)                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.4 Entradas (Entrada → `inventory_inflow`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_inflow  (encabezado de entrada)                            │
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
│  ── FK negocio ──                                                    │
│  inflow_origin_id       → inflow_origin.id                           │
│  warehouse_id           → warehouse.id                               │
│  supplier_id            → supplier.id   (NULL)                       │
│                                                                      │
│  ── FK usuario ──                                                    │
│  user_id                → users.id                                   │
│  confirmed_user_id      → users.id                                   │
│                                                                      │
│  ── FK tenant ──                                                     │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_inflow  (renglones de entrada)                      │
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
│  ── FK ──                                                            │
│  item_id                → item.id                                    │
│  inventory_inflow_id    → inventory_inflow.id (CASCADE)              │
│  unit_id                → unit.id                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.5 Salidas (Salida → `inventory_shrinkage`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_shrinkage  (encabezado de salida / merma)                  │
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
│  ── FK negocio ──                                                    │
│  shrinkage_reason_id    → shrinkage_reason.id                        │
│  warehouse_id           → warehouse.id                               │
│                                                                      │
│  ── FK usuario ──                                                    │
│  user_id                → users.id                                   │
│                                                                      │
│  ── FK tenant ──                                                     │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ detail_inventory_shrinkage  (renglones de salida)                    │
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
│  ── FK ──                                                            │
│  item_id                → item.id                                    │
│  inventory_shrinkage_id → inventory_shrinkage.id (CASCADE)           │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.6 Kardex unificado (lectura para Existencias / Dashboard / historial)

```
┌──────────────────────────────────────────────────────────────────────┐
│ inventory_movement  (kardex unificado · lectura)                     │
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
│  ── FK negocio ──                                                    │
│  item_id                → item.id                                    │
│  warehouse_id           → warehouse.id                               │
│                                                                      │
│  ── FK usuario ──                                                    │
│  user_id                → users.id                                   │
│                                                                      │
│  ── FK tenant ──                                                     │
│  subsidiaries_id        → fayxzvov_erp.subsidiaries                  │
│  companies_id           → fayxzvov_erp.companies                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Cambios de campo respecto a la propuesta v1 (resumen ejecutable)

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

---

## 9. Impacto en los modelos PHP y el login

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

---

## 10. Auto-revisión (Checklist §7 db-rules.md)

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

## 11. Conclusión y siguientes pasos

1. **ERP primero:** crear `companies` + `subsidiaries` + `users` en `fayxzvov_erp` y sembrar desde `udn` (1 companies + 1 subsidiaries `is_main` por UDN).
2. **Login:** exponer `companies_id` + `subsidiaries_id` en sesión (con selector de sucursal si `subsidiaries_id` es NULL).
3. **Crear `fayxzvov_almacen`** con las 16 tablas de la §7 (tenant `companies_id`/`subsidiaries_id`).
4. **Sembrar catálogos base:** `inflow_origin` ('Compra'), `shrinkage_reason` ('Merma'), `unit`, y un `warehouse` `is_default = 1` por sucursal.
5. **Reescribir los 5 modelos** según §9.

> ¿Genero el **DDL `CREATE TABLE` ejecutable** — primero el de identidad (`companies`/`subsidiaries`/`ALTER usuarios` en `fayxzvov_erp`) y luego el de `fayxzvov_almacen`? Avísame y lo entrego listo para el WAMP.
