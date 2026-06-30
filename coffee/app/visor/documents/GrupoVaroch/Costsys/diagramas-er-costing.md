# Diagramas ER por sección — costing

> Vista de revisión del módulo **`fayxzvov_costing`** (recetario + costeo del ERP-POS).
> Generada desde [erp-pos-modelo-referencia.md](erp-pos-modelo-referencia.md) · DDL: [ddl/fayxzvov_costing.sql](ddl/fayxzvov_costing.sql).
> Leyenda: `●` PK  `·` campo  `──▶` FK negocio  `┄▷` FK tenant/maestro corporativo.
> Tenant = `subsidiaries_id`, `companies_id` (→ `fayxzvov_erp`). Cross-schema externos: `fayxzvov_reginas` (POS), `fayxzvov_inventory`.

---

## Sección 1 · Recetario (catálogos)
*esquema: fayxzvov_costing*

**Conexiones de la sección**
```text
recipe ──1:N──▶ recipe_item          recipe ──1:N──▶ recipe_sub_recipe
recipe ──1:1──▶ order_products (POS)  recipe ──N:1──▶ unit (inventory)
sub_recipe ──1:N──▶ sub_recipe_item   sub_recipe ──1:N──▶ sub_recipe_sub_recipe
```

**Tablas**
```text
▦ recipe  —  receta de un producto vendible (catálogo, 1 por producto)
  ●   id                    INT PK
  ·   name                  VARCHAR(255)
  ·   procedure_text        TEXT
  ·   image                 VARCHAR(255)
  ·   yield_quantity        DOUBLE        rendimiento
  ·   sale_price            DOUBLE
  ·   tax                   DOUBLE        IVA %
  ·   ieps                  DOUBLE
  ·   status                TINYINT       0 desc · 1 por validar · 2 validado
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ product_id            order_products   (reginas)   SET NULL · UNIQUE
  ──▶ unit_id               unit             (inventory) SET NULL
  ┄▷  subsidiaries_id       subsidiaries     (erp)       SET NULL
  ┄▷  companies_id          companies        (erp)       SET NULL
  ·   active                TINYINT

▦ sub_recipe  —  preparación intermedia reutilizable (catálogo)
  ●   id                    INT PK
  ·   name                  VARCHAR(255)
  ·   procedure_text        TEXT
  ·   image                 VARCHAR(255)
  ·   yield_quantity        DOUBLE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ·   status                TINYINT
  ──▶ unit_id               unit             (inventory) SET NULL
  ┄▷  subsidiaries_id       subsidiaries     (erp)       SET NULL
  ┄▷  companies_id          companies        (erp)       SET NULL
  ·   active                TINYINT
```

---

## Sección 2 · Composición (pivotes con atributos)
*esquema: fayxzvov_costing*

**Conexiones de la sección**
```text
recipe_item ──N:1──▶ recipe          recipe_item ──N:1──▶ item (inventory)
recipe_sub_recipe ──N:1──▶ recipe    recipe_sub_recipe ──N:1──▶ sub_recipe
sub_recipe_item ──N:1──▶ sub_recipe  sub_recipe_item ──N:1──▶ item (inventory)
sub_recipe_sub_recipe ──N:1──▶ sub_recipe (parent y child)
```

**Tablas**
```text
▦ recipe_item  —  insumos que componen una receta
  ●   id                    INT PK
  ·   technique             VARCHAR(255)
  ·   quantity              DOUBLE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ recipe_id             recipe           CASCADE · UNIQUE(recipe_id,item_id)
  ──▶ item_id               item             (inventory) SET NULL
  ──▶ unit_id               unit             (inventory) SET NULL
  ·   active                TINYINT

▦ recipe_sub_recipe  —  subrecetas que componen una receta
  ●   id                    INT PK
  ·   technique             VARCHAR(255)
  ·   quantity              DOUBLE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ recipe_id             recipe           CASCADE · UNIQUE(recipe_id,sub_recipe_id)
  ──▶ sub_recipe_id         sub_recipe       CASCADE
  ·   active                TINYINT

▦ sub_recipe_item  —  insumos que componen una subreceta
  ●   id                    INT PK
  ·   technique             VARCHAR(255)
  ·   quantity              DOUBLE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ sub_recipe_id         sub_recipe       CASCADE · UNIQUE(sub_recipe_id,item_id)
  ──▶ item_id               item             (inventory) SET NULL
  ──▶ unit_id               unit             (inventory) SET NULL
  ·   active                TINYINT

▦ sub_recipe_sub_recipe  —  anidación: subreceta dentro de subreceta
  ●   id                    INT PK
  ·   quantity              DOUBLE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ parent_sub_recipe_id  sub_recipe       CASCADE · UNIQUE(parent,child)
  ──▶ child_sub_recipe_id   sub_recipe       CASCADE
  ·   active                TINYINT
```

---

## Sección 3 · Costeo (transacción raíz + catálogo)
*esquema: fayxzvov_costing*

**Conexiones de la sección**
```text
product_cost ──N:1──▶ recipe          product_cost ──N:1──▶ order_products (POS)
product_cost ──N:1──▶ order_category (POS)   product_cost ──1:N──▶ cost_comparison
cost_threshold ──N:1──▶ order_category (POS)
```

**Tablas**
```text
▦ product_cost  —  snapshot mensual de costo/rentabilidad por producto (transacción raíz)
  ●   id                    INT PK
  ·   sale_price            DOUBLE
  ·   proposed_price        DOUBLE
  ·   tax                   DOUBLE
  ·   ieps                  DOUBLE
  ·   cost_unit             DOUBLE
  ·   cost_pct              DOUBLE        % de costo
  ·   contribution_margin   DOUBLE
  ·   units_sold            INT           desplazamiento (de order_package)
  ·   est_sales             DOUBLE
  ·   est_cost              DOUBLE
  ·   est_margin            DOUBLE
  ·   est_sales_proposed    DOUBLE
  ·   est_cost_proposed     DOUBLE
  ·   est_margin_proposed   DOUBLE
  ·   cost_pct_proposed     DOUBLE
  ·   period_month          DATE          primer día del mes
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ·   status                TINYINT
  ──▶ product_id            order_products   (reginas)   SET NULL · UNIQUE(product,period,subsidiary)
  ──▶ recipe_id             recipe           SET NULL
  ──▶ category_id           order_category   (reginas)   SET NULL
  ┄▷  subsidiaries_id       subsidiaries     (erp)       SET NULL
  ┄▷  companies_id          companies        (erp)       SET NULL
  ·   active                TINYINT

▦ cost_threshold  —  umbrales de semáforo (% costo / margen) por categoría y mes (catálogo)
  ●   id                    INT PK
  ·   cost_pct_high         DOUBLE
  ·   cost_pct_low          DOUBLE
  ·   margin_high           DOUBLE
  ·   margin_low            DOUBLE
  ·   period_month          DATE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ category_id           order_category   (reginas)   SET NULL · UNIQUE(category,period,subsidiary)
  ┄▷  subsidiaries_id       subsidiaries     (erp)       SET NULL
  ┄▷  companies_id          companies        (erp)       SET NULL
  ·   active                TINYINT

▦ recipe_price_history  —  bitácora de cambios de precio de venta (registro de evento)
  ●   id                    INT PK
  ·   previous_price        DOUBLE
  ·   new_price             DOUBLE
  ·   tax                   DOUBLE
  ·   change_date           DATE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ──▶ recipe_id             recipe           SET NULL
  ──▶ product_id            order_products   (reginas)   SET NULL
  ┄▷  user_id               (erp · quién cambió el precio)
  ┄▷  subsidiaries_id       subsidiaries     (erp)       SET NULL
  ┄▷  companies_id          companies        (erp)       SET NULL
  ·   active                TINYINT

▦ cost_comparison  —  cuadro comparativo: costo potencial estimado vs. real (transacción raíz)
  ●   id                    INT PK
  ·   estimated_amount      DOUBLE        del costo potencial
  ·   real_amount           DOUBLE        del estado de resultados real
  ·   variance_amount       DOUBLE        diferencia en pesos
  ·   variance_pct          DOUBLE        diferencia en %
  ·   period_month          DATE
  ·   created_at            DATETIME
  ·   updated_at            DATETIME
  ·   status                TINYINT
  ──▶ product_cost_id       product_cost     SET NULL
  ──▶ category_id           order_category   (reginas)   SET NULL
  ┄▷  subsidiaries_id       subsidiaries     (erp)       SET NULL
  ┄▷  companies_id          companies        (erp)       SET NULL
  ·   active                TINYINT
```

---

## Cardinalidades (todas las relaciones del módulo)

| Origen | → | Destino | Cardinalidad | Esquema destino |
|---|---|---|---|---|
| recipe | → | order_products | 1 : 1 | reginas (POS) |
| recipe | → | unit | N : 1 | inventory |
| recipe | → | subsidiaries / companies | N : 1 | erp (tenant) |
| recipe_item | → | recipe | N : 1 | costing |
| recipe_item | → | item | N : 1 | inventory |
| recipe_sub_recipe | → | recipe | N : 1 | costing |
| recipe_sub_recipe | → | sub_recipe | N : 1 | costing |
| sub_recipe_item | → | sub_recipe | N : 1 | costing |
| sub_recipe_item | → | item | N : 1 | inventory |
| sub_recipe_sub_recipe | → | sub_recipe (parent/child) | N : 1 | costing |
| product_cost | → | recipe | N : 1 | costing |
| product_cost | → | order_products | N : 1 | reginas (POS) |
| product_cost | → | order_category | N : 1 | reginas (POS) |
| cost_threshold | → | order_category | N : 1 | reginas (POS) |
| recipe_price_history | → | recipe | N : 1 | costing |
| cost_comparison | → | product_cost | N : 1 | costing |
| cost_comparison | → | order_category | N : 1 | reginas (POS) |

---

*Generado por **Coffee Intelligence 🧠☕**. Se regenera cada vez que cambie el modelo del módulo `costing`.*
