# Diagramas ER por sección — Módulo Inventory / Almacén

> ⚠️ **Actualización jun-2026:** la sucursal del módulo es **`branch_id` → `fayxzvov_erp.branches`**
> (antes `subsidiaries_id` → `subsidiaries`). Léase `branch_id`/`branches` donde aparezca lo viejo.

> Vista de revisión generada desde [propuesta-bd-inventory.md](propuesta-bd-inventory.md) (rev5).
> Una **ficha por tabla**, agrupada por sección, para revisar de un vistazo.

> **Leyenda:**  `●` PK   `·` campo   `──▶` FK de negocio   `┄▷` FK tenant/puente.

> Este inventario es de **insumos** (`item`), no de productos de venta como reginas.

---

## Sección 1 · Tenant / Identidad
*esquema: fayxzvov_erp*

**Conexiones de la sección**
```text
companies ──1:N──▶ subsidiaries ──1:N──▶ users
companies ──1:N──▶ users
companies ┄legacy┄▶ udn        users ┄legacy┄▶ usuarios
```

**Tablas**
```text
▦ companies  —  cuenta cliente (quien compra el módulo)
  ●   id                    INT PK
  ·   name                  VARCHAR(160)
  ·   rfc                   VARCHAR(20)
  ·   email                 VARCHAR(120)
  ·   phone                 VARCHAR(20)
  ·   logo                  VARCHAR(255)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ┄▷  udn_id                udn   (puente legacy)

▦ subsidiaries  —  sucursal de la empresa
  ●   id                    INT PK
  ·   name                  VARCHAR(160)
  ·   address               VARCHAR(255)
  ·   phone                 VARCHAR(20)
  ·   is_main               TINYINT(1)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ┄▷  companies_id          companies   (tenant)

▦ users  —  identidad del módulo (reemplaza usuarios)
  ●   id                    INT PK
  ·   fullname              VARCHAR(160)
  ·   username              VARCHAR(60)
  ·   email                 VARCHAR(120)
  ·   password              VARCHAR(255)
  ·   phone                 VARCHAR(20)
  ·   photo                 VARCHAR(255)
  ·   login_attempts        INT
  ·   last_login_at         DATETIME
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ role_id               perfiles
  ┄▷  companies_id          companies   (tenant)
  ┄▷  subsidiaries_id       subsidiaries   (tenant)
  ┄▷  legacy_user_id        usuarios   (puente legacy)
```

---

## Sección 2 · Catálogos
*esquema: fayxzvov_almacen*

**Conexiones de la sección**
```text
item_category · unit · warehouse_area  ──N:1──▶ companies
inflow_origin · shrinkage_reason       (globales · sin FK)
```

**Tablas**
```text
▦ item_category  —  clasificación de insumos
  ●   id                    INT PK
  ·   name                  VARCHAR(120)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ┄▷  companies_id          companies   (tenant)

▦ unit  —  unidades de medida (pza, kg, lt)
  ●   id                    INT PK
  ·   code                  VARCHAR(20)
  ·   name                  VARCHAR(80)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ┄▷  companies_id          companies   (tenant)

▦ warehouse_area  —  áreas físicas del almacén
  ●   id                    INT PK
  ·   name                  VARCHAR(120)
  ·   description           VARCHAR(255)
  ·   color_hex             VARCHAR(9)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ┄▷  companies_id          companies   (tenant)

▦ inflow_origin  —  origen de entradas (global)
  ●   id                    INT PK
  ·   code                  VARCHAR(30)
  ·   name                  VARCHAR(120)
  ·   icon                  VARCHAR(60)
  ·   color_hex             VARCHAR(9)
  ·   requires_supplier     TINYINT(1)
  ·   active                TINYINT(1)

▦ shrinkage_reason  —  motivos de salida (global)
  ●   id                    INT PK
  ·   code                  VARCHAR(30)
  ·   name                  VARCHAR(120)
  ·   icon                  VARCHAR(60)
  ·   color_hex             VARCHAR(9)
  ·   active                TINYINT(1)
```

---

## Sección 3 · Insumo
*esquema: fayxzvov_almacen*

**Conexiones de la sección**
```text
item ──1:N──▶ item_attribute   (1 atributo activo)
item ──N:1──▶ item_category · subsidiaries · companies
```

**Tablas**
```text
▦ item  —  insumo (datos generales)
  ●   id                    INT PK
  ·   name                  VARCHAR(160)
  ·   image                 VARCHAR(255)
  ·   price                 DOUBLE
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ category_id           item_category
  ┄▷  subsidiaries_id       subsidiaries   (tenant)
  ┄▷  companies_id          companies   (tenant)

▦ item_attribute  —  datos de inventario del insumo
  ●   id                    INT PK
  ·   sku                   VARCHAR(40)
  ·   description           VARCHAR(255)
  ·   shelf_life_days       INT
  ·   cost_unit             DOUBLE
  ·   stock_min             DOUBLE
  ·   stock_max             DOUBLE
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ warehouse_area_id     warehouse_area
  ──▶ unit_id               unit
  ──▶ item_id               item
  ┄▷  companies_id          companies   (tenant)
```

---

## Sección 4 · Almacén + Existencias
*esquema: fayxzvov_almacen*

**Conexiones de la sección**
```text
warehouse ──1:N──▶ stock        item ──1:N──▶ stock
stock = UNIQUE (item_id, warehouse_id)
```

**Tablas**
```text
▦ warehouse  —  almacén físico
  ●   id                    INT PK
  ·   name                  VARCHAR(120)
  ·   is_default            TINYINT(1)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ warehouse_area_id     warehouse_area
  ┄▷  subsidiaries_id       subsidiaries   (tenant)
  ┄▷  companies_id          companies   (tenant)

▦ stock  —  existencia por insumo + almacén
  ●   id                    INT PK
  ·   quantity              DOUBLE
  ·   last_movement_at      DATETIME
  ·   last_inventory_at     DATETIME
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ warehouse_id          warehouse
  ──▶ item_id               item
  ┄▷  companies_id          companies   (tenant)
```

---

## Sección 5 · Entradas de almacén
*(Producción · Proveedor · Transferencia · Devolución)*

**Conexiones de la sección**
```text
inventory_inflow ──1:N──▶ detail_inventory_inflow
inventory_inflow ──N:1──▶ inflow_origin · warehouse · supplier · users
detail_inventory_inflow ──N:1──▶ item · unit
```

**Tablas**
```text
▦ inventory_inflow  —  encabezado de entrada
  ●   id                    INT PK
  ·   folio                 VARCHAR(20)
  ·   note                  VARCHAR(255)
  ·   total_products        INT
  ·   total_units           DOUBLE
  ·   total_cost            DOUBLE
  ·   date_inflow           DATE
  ·   confirmed_at          DATETIME
  ·   status                VARCHAR(20)
  ·   active                TINYINT(1)
  ──▶ inflow_origin_id      inflow_origin
  ──▶ warehouse_id          warehouse
  ──▶ supplier_id           supplier
  ──▶ user_id               users
  ──▶ confirmed_user_id     users
  ┄▷  subsidiaries_id       subsidiaries   (tenant)
  ┄▷  companies_id          companies   (tenant)

▦ detail_inventory_inflow  —  renglones de entrada
  ●   id                    INT PK
  ·   batch_code            VARCHAR(40)
  ·   quantity              DOUBLE
  ·   confirmed_quantity    DOUBLE
  ·   cost                  DOUBLE
  ·   subtotal              DOUBLE
  ·   previous_stock        DOUBLE
  ·   resulting_stock       DOUBLE
  ·   expires_at            DATE
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ item_id               item
  ──▶ inventory_inflow_id   inventory_inflow (CASCADE)
  ──▶ unit_id               unit

▦ supplier  —  proveedores (maestro)
  ●   id                    INT PK
  ·   name                  VARCHAR(160)
  ·   contact_name          VARCHAR(120)
  ·   phone                 VARCHAR(20)
  ·   email                 VARCHAR(120)
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ┄▷  companies_id          companies   (tenant)
```

---

## Sección 6 · Salidas de almacén
*(Merma · Salida · Consumo)*

**Conexiones de la sección**
```text
inventory_shrinkage ──1:N──▶ detail_inventory_shrinkage
inventory_shrinkage ──N:1──▶ shrinkage_reason · warehouse · users
detail_inventory_shrinkage ──N:1──▶ item
```

**Tablas**
```text
▦ inventory_shrinkage  —  encabezado de salida / merma
  ●   id                    INT PK
  ·   folio                 VARCHAR(20)
  ·   note                  VARCHAR(255)
  ·   total_products        INT
  ·   total_units           DOUBLE
  ·   total_cost            DOUBLE
  ·   date_shrinkage        DATE
  ·   status                VARCHAR(20)
  ·   active                TINYINT(1)
  ──▶ shrinkage_reason_id   shrinkage_reason
  ──▶ warehouse_id          warehouse
  ──▶ user_id               users
  ┄▷  subsidiaries_id       subsidiaries   (tenant)
  ┄▷  companies_id          companies   (tenant)

▦ detail_inventory_shrinkage  —  renglones de salida
  ●   id                    INT PK
  ·   quantity              DOUBLE
  ·   cost                  DOUBLE
  ·   subtotal              DOUBLE
  ·   previous_stock        DOUBLE
  ·   resulting_stock       DOUBLE
  ·   created_at            DATETIME
  ·   active                TINYINT(1)
  ──▶ item_id               item
  ──▶ inventory_shrinkage_idinventory_shrinkage (CASCADE)
```

---

## Sección 7 · Kardex unificado
*lectura: Existencias · Dashboard · historial*

**Conexiones de la sección**
```text
inventory_movement ──N:1──▶ item · warehouse · users · subsidiaries · companies
```

**Tablas**
```text
▦ inventory_movement  —  movimientos unificados
  ●   id                    INT PK
  ·   movement_uid          VARCHAR(40)
  ·   movement_type         VARCHAR(20)
  ·   folio                 VARCHAR(20)
  ·   note                  VARCHAR(255)
  ·   quantity              DOUBLE
  ·   stock_prev            DOUBLE
  ·   stock_post            DOUBLE
  ·   cost_unit             DOUBLE
  ·   cost_total            DOUBLE
  ·   occurred_at           DATETIME
  ·   status                VARCHAR(20)
  ──▶ item_id               item
  ──▶ warehouse_id          warehouse
  ──▶ user_id               users
  ┄▷  subsidiaries_id       subsidiaries   (tenant)
  ┄▷  companies_id          companies   (tenant)
```

---
