# ER de POS, Pedidos e Inventarios — Huubie — selección, 26 de 51 tablas

> Acta rev **C** · fase 3.
> Fuente de verdad de las convenciones: `db-rules.md`.
> Este documento lo genera la app desde el acta: si algo aquí no cuadra,
> se corrige el acta y se vuelve a emitir, nunca el documento a mano.
>
> Solo la selección del diagrama. La auto-revisión y las preguntas abiertas
> son del acta entera y no van aquí.
> Se relaciona fuera de la selección con `stock`, `product_attribute`, `detail_inflow_format`, `detail_inventory_inflow`, `detail_inventory_shrinkage`, `detail_inventory_adjustment`, `detail_inventory_transfer`, `subsidiaries`, `usr_users`, `companies`, `card_movement`.

---

## 0. Contexto del dominio

| | |
|---|---|
| Dominio | POS, Pedidos e Inventarios — Huubie |
| Esquema | `fayxzvov_reginas` |
| Evento raíz | `card`, `sale`, `turn`, `daily_closure` |
| Tablas del dominio | 26 · 7 nuevas · 19 de reuso |
| Columnas modeladas | 276 |
| Relaciones | 35 FKs |

---

## 1. Clasificación de tablas (db-rules §1.4)

| Clase | Tablas |
|---|---|
| **Catálogo** | `order_kind` · `card_type` · `subcategory` · `discount_reason` · `product` · `customer` · `custom_modifier` · `modifier_group` · `order_type` · `payment_method` |
| **Sub-catálogo** | `category` · `modifier` |
| **Transacción raíz** | `card` · `sale` · `turn` · `daily_closure` |
| **Detalle / movimiento** | `receivable` · `sale_item` · `payment` · `history_log` · `sale_images` · `turn_method` · `turn_order_type` · `daily_closure_method` · `daily_closure_order_type` |
| **Pivote N:M** | `product_recipe` |

Las de reuso —`sale`, `sale_item`, `product`, `category`, `customer`, `custom_modifier`, `modifier_group`, `modifier`, `payment`, `history_log`, `sale_images`, `turn`, `daily_closure`, `turn_method`, `turn_order_type`, `daily_closure_method`, `daily_closure_order_type`, `order_type`, `payment_method`— se documentan tal como están y no entran al DDL.

---

## 2. Diagrama de relaciones

Caja **doble** = tablas de `fayxzvov_reginas` · caja **simple** = cross-schema.

```
  CATÁLOGOS  ·  las listas que alimentan al evento
  ╔═ product ═╗  ╔═ category ═╗  ╔═ customer ═╗  ╔═ custom_modifier ═╗
  ╔═ modifier_group ═╗  ╔═ modifier ═╗  ╔═ order_type ═╗  ╔═ payment_method ═╗
  ╔═ order_kind ═╗  ╔═ card_type ═╗  ╔═ subcategory ═╗  ╔═ discount_reason ═╗
              │
              ▼
  RAÍZ  ·  el evento que registra el módulo
  ╔═ sale ═╗  ╔═ turn ═╗  ╔═ daily_closure ═╗  ╔═ card ═╗
              │
              ▼
  DETALLES  ·  lo que cuelga del evento
  ╔═ sale_item ═╗  ╔═ payment ═╗  ╔═ history_log ═╗  ╔═ sale_images ═╗
  ╔═ turn_method ═╗  ╔═ turn_order_type ═╗  ╔═ daily_closure_method ═╗
  ╔═ daily_closure_order_type ═╗  ╔═ receivable ═╗
              │
              ▼
  PIVOTES  ·  los cruces entre dos tablas
  ╔═ product_recipe ═╗
```

**Cardinalidades en una línea**

```
discount_reason  1 ──── N  sale · sale_item
order_type       1 ──── N  sale · turn_order_type · daily_closure_order_type
order_kind       1 ──── N  sale
customer         1 ──── N  sale · receivable
daily_closure    1 ──── N  sale · turn · daily_closure_method · daily_closure_order_type
turn             1 ──── N  sale · turn_method · turn_order_type · receivable
card             1 ──── N  sale
product          1 ──── N  sale_item · custom_modifier · product_recipe
sale             1 ──── N  sale_item · payment · history_log · receivable
category         1 ──── N  product
subcategory      1 ──── N  product
modifier         1 ──── N  custom_modifier
modifier_group   1 ──── N  modifier
payment_method   1 ──── N  payment · turn_method · daily_closure_method · receivable
sale_item        1 ──── N  sale_images
card_type        1 ──── N  card
```

---

## 3. Estructura de tablas

### 3.1 Catálogos

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_kind                                                        CATÁLOGO │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(50)             pedido,pos,mostrador,ecom… │
│ created_at              DATETIME                                           │
│ updated_at              DATETIME                                           │
│ active                  TINYINT                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Catálogo de tipos de orden.                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ card_type                                                         CATÁLOGO │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(80)                                        │
│ brand_id                INT                                                │
│ discount_percent        DOUBLE                                             │
│ points_percent          DOUBLE                                             │
│ updated_at              DATETIME                                           │
│ created_at              DATETIME                                           │
│ active                  TINYINT                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ subcategory                                                       CATÁLOGO │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(80)                                        │
│ description             VARCHAR(80)                                        │
│ brand_id                INT                                                │
│ created_at              DATETIME                                           │
│ active                  TINYINT                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ discount_reason                                                   CATÁLOGO │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(80)                                        │
│ requires_authorization  TINYINT(1)              1 = solo gerente lo        │
│                                                 autoriza                   │
│ max_percent             DECIMAL(12,2)                                      │
│ active                  TINYINT                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ product                                                   CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)                                       │
│ is_custom               INT                                                │
│ description             TEXT                                               │
│ image                   TEXT                                               │
│ kind_id                 INT                     producto,servicio,compues… │
│ sell_pos                INT                     es vendible en el pos      │
│ in_catalog              INT                     pertenece al catalogo del  │
│                                                 ecommerce                  │
├─ INVENTARIOS ──────────────────────────────────────────────────────────────┤
│ unit_id                 INT                     la unidad de presentacion  │
│                                                 pieza, rebanda, etc        │
│ sku                     VARCHAR(80)             codigo unico para          │
│                                                 inventarios                │
│ barcode                 VARCHAR(80)             codigo de barra para el    │
│                                                 pos                        │
│ shelf_life_days         INT                                                │
│ is_inventoriable        INT                                                │
│ price                   DOUBLE                                             │
│ cost                    DOUBLE                                             │
│ created_at              DATETIME                                           │
│ category_id             INT             FK                                 │
│ subcategory_id          INT             FK                                 │
│ brand_id                INT             FK                                 │
│ company_id              INT             FK                                 │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  category_id             →  category.id                                 │
│                               ON DELETE CASCADE                            │
│ FK  subcategory_id          →  subcategory.id                              │
│                               ON DELETE RESTRICT                           │
│ FK  brand_id                →  subsidiaries.id                             │
│                               ON DELETE CASCADE                            │
│ FK  company_id              →  companies.id                                │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 185 productos · catálogo compartido por POS, pedidos E inventarios (el     │
│ puente entre módulos)                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ customer                                                  CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)                                       │
│ phone                   VARCHAR                 ← teléfono numérico ·      │
│                                                 pierde ceros y +52         │
│ email                   VARCHAR(255)                                       │
│ credit_enabled          TINYINT                                            │
│ price_list_id           INT                                                │
│ wallet                  DOUBLE                                             │
│ credit_limit            DOUBLE                                             │
│ updated_at              DATETIME                                           │
│ created_at              DATETIME                                           │
│ branch_id               INT             FK                                 │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  branch_id               →  subsidiaries.id                             │
├────────────────────────────────────────────────────────────────────────────┤
│ 1169 clientes por sucursal                                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ custom_modifier                                           CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)                                       │
│ portion_qty             INT                                                │
│ details                 VARCHAR(255)                                       │
│ suggested_price         DOUBLE                                             │
│ final_price             DOUBLE                                             │
│ created_at              DATETIME                                           │
│ custom_id               INT             FK                                 │
│ modifier_id             INT             FK                                 │
│ active                  TINYINT                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  custom_id               →  product.id                                  │
│                               ON DELETE RESTRICT                           │
│ FK  modifier_id             →  modifier.id                                 │
│                               ON DELETE RESTRICT                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 1104 productos personalizados (pasteles con dedicatoria, etc.)             │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ modifier_group                                            CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    TEXT                    nombre del modificador ej. │
│                                                 betun,decoracion,relleno   │
│ isExtra                 SMALLINT                                           │
│ created_at              DATETIME                                           │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ 12 modificadores (extras, aderezos, etc.)                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_type                                                CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ status                  VARCHAR(50)                                        │
│ active                  TINYINT                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 4 estados: Cotización, Pendiente, Pagado, Cancelado                        │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ payment_method                                            CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(20)                                        │
│ code                    TEXT                                               │
│ kind                    ENUM                    efectivo|tarjeta|vales|pu… │
│ is_cash                 INT                                                │
│ is_visible              INT                                                │
│ earns_points            TINYINT                                            │
│ sort                    INT                                                │
│ commission              DOUBLE                                             │
│ created_at              DATETIME                                           │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ 3 métodos: Efectivo, Tarjeta, Transferencia                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Sub-catálogos

```
┌────────────────────────────────────────────────────────────────────────────┐
│ category                                              SUB-CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)                                       │
│ description             TEXT                                               │
│ created_at              DATETIME                                           │
│ brand_id                INT             FK                                 │
│ active                  VARCHAR(255)            ← debería ser TINYINT      │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  brand_id                →  subsidiaries.id                             │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 11 categorías de producto                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ modifier                                              SUB-CATÁLOGO | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)            nombre de los              │
│                                                 modificadores ej. betun de │
│                                                 chocolate, fresas          │
│ description             VARCHAR(255)                                       │
│ price                   DOUBLE                                             │
│ cant                    DOUBLE                                             │
│ created_at              DATETIME                                           │
│ modifier_group_id       INT             FK                                 │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  modifier_group_id       →  modifier_group.id                           │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 228 opciones de modificador                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Transacciones raíz

```
┌────────────────────────────────────────────────────────────────────────────┐
│ card                                                      TRANSACCIÓN RAÍZ │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ number                  VARCHAR(80)                                        │
│ holder                  VARCHAR(80)                                        │
│ brand_id                INT                                                │
│ customer_id             INT                                                │
│ updated_at              DATETIME                                           │
│ created_at              DATETIME                                           │
│ card_type_id            INT             FK                                 │
│ active                  TINYINT                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  card_type_id            →  card_type.id                                │
│                               ON DELETE RESTRICT                           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ sale                                              TRANSACCIÓN RAÍZ | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ folio                   VARCHAR(20)                                        │
│ note                    TEXT                                               │
│ location                VARCHAR(255)                                       │
│ time_order              TIME                                               │
├─ REFERENCIAS ──────────────────────────────────────────────────────────────┤
│ channel                 TINYINT                 Es pos, es ecommerce, es   │
│                                                 pedidos                    │
│ delivery_method         INT                     Tipo de entrega 0 =        │
│                                                 recogida en tienda, 1 =    │
│                                                 envio a domicilio          │
│ is_delivered            INT                     no entregado,              │
│                                                 entregado,para producir    │
├─ OPERACION ────────────────────────────────────────────────────────────────┤
│ cancel_reason           VARCHAR(255)                                       │
│ info_discount           TEXT                                               │
│ user_id                 INT                     usuario que creo el        │
│                                                 registro                   │
│ cancel_user_id          INT                     usuario que cancelo        │
│ edit_user_id            INT                                                │
│ produced_user_id        INT                     solo en producción · no    │
│                                                 está en el dump            │
│ subtotal                DOUBLE                                             │
│ discount_amount         DOUBLE                                             │
│ discount_percentage     DOUBLE                                             │
│ total                   DOUBLE                                             │
│ tip_amount              DOUBLE                                             │
│ created_at              DATETIME                                           │
│ date_birthday           DATETIME                                           │
│ date_order              DATE                                               │
│ cancelled_at            DATETIME                                           │
│ produced_at             DATETIME                solo en producción · no    │
│                                                 está en el dump            │
│ discount_reason_id      INT             FK                                 │
│ order_type_id           INT             FK      status = Estado general,   │
│                                                 cotizacion,pendiente,paga… │
│                                                 y cancelado                │
│ order_kind_id           INT             FK      tipo de orden ( pedido,    │
│                                                 mostrador,rapido,domicili… │
│ client_id               INT             FK                                 │
│ brand_id                INT             FK                                 │
│ daily_closure_id        INT             FK                                 │
│ turn_id                 INT             FK                                 │
│ card_id                 INT             FK                                 │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  discount_reason_id      →  discount_reason.id                          │
│                               ON DELETE RESTRICT                           │
│ FK  order_type_id           →  order_type.id                               │
│                               ON DELETE RESTRICT                           │
│ FK  order_kind_id           →  order_kind.id                               │
│ FK  client_id               →  customer.id                                 │
│                               ON DELETE RESTRICT                           │
│ FK  brand_id                →  subsidiaries.id                             │
│                               ON DELETE CASCADE                            │
│ FK  daily_closure_id        →  daily_closure.id                            │
│                               ON DELETE CASCADE                            │
│ FK  turn_id                 →  turn.id                                     │
│                               ON DELETE RESTRICT                           │
│ FK  card_id                 →  card.id                                     │
│                               ON DELETE RESTRICT                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 1531 órdenes · compartida POS + pedidos · el corazón del sistema           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ turn                                              TRANSACCIÓN RAÍZ | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ folio                   VARCHAR(255)                                       │
│ status                  ENUM('open','closed')                              │
│ orders_count            INT                                                │
│ sales_count             INT                                                │
│ reopen_reason           VARCHAR(20)             razon por la que se        │
│                                                 reaperturno el turno       │
│ reopened_user_id        INT                                                │
│ opening_cash            DOUBLE                                             │
│ counted_cash            DOUBLE                  dinero entrante            │
│ expected_cash           DOUBLE                  dinero que el sistema      │
│                                                 espera                     │
│ total_sales             DOUBLE                  la suma de todos los       │
│                                                 montos                     │
│ opened_at               DATETIME                                           │
│ closed_at               DATETIME                                           │
│ reopened_at             DATETIME                                           │
│ created_at              DATETIME                                           │
│ close_user_id           INT             FK                                 │
│ brand_id                INT             FK      ← singular (resto usa      │
│                                                 subsidiaries_id)           │
│ user_id                 INT             FK                                 │
│ daily_closure_id        INT             FK                                 │
│ active                  TINYINT                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  close_user_id           →  fayxzvov_alpha.usr_users.id                 │
│                               ON DELETE RESTRICT                           │
│ FK  brand_id                →  subsidiaries.id                             │
│                               ON DELETE CASCADE                            │
│ FK  user_id                 →  usr_users.id                                │
│                               ON DELETE CASCADE                            │
│ FK  daily_closure_id        →  daily_closure.id                            │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 910 turnos · compartido POS + pedidos · el corte suma ventas de ambos      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ daily_closure                                     TRANSACCIÓN RAÍZ | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ folio                   VARCHAR(20)                                        │
│ note                    VARCHAR(160)                                       │
│ sales_count             INT                                                │
│ cancelled_count         INT                                                │
│ first_folio             INT                                                │
│ last_folio              INT                                                │
│ turns_count             INT                                                │
│ orders_count            INT                                                │
│ reopen_reason           TEXT                                               │
│ subtotal                DOUBLE                                             │
│ discount                DOUBLE                                             │
│ total                   DOUBLE                                             │
│ tip                     DOUBLE                                             │
│ tax                     DOUBLE                                             │
│ total_shifts            DOUBLE                                             │
│ total_cash              DOUBLE                                             │
├─ POS ──────────────────────────────────────────────────────────────────────┤
│ cash_in                 DOUBLE                                             │
│ cash_out                DOUBLE                                             │
│ closure_date            DATETIME                                           │
│ created_at              DATETIME                                           │
│ reopened_at             DATETIME                                           │
│ user_id                 INT             FK                                 │
│ brand_id                INT             FK      ← singular                 │
│ reopened_user_id        INT             FK                                 │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  user_id                 →  usr_users.id                                │
│                               ON DELETE SET NULL                           │
│ FK  brand_id                →  subsidiaries.id                             │
│                               ON DELETE SET NULL                           │
│ FK  reopened_user_id        →  usr_users.id                                │
│                               ON DELETE SET NULL                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 416 cierres diarios · agrupa turnos por sucursal y fecha                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Detalles

```
┌────────────────────────────────────────────────────────────────────────────┐
│ receivable                                                         DETALLE │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ type                    VARCHAR(20)                                        │
│ description             VARCHAR(20)                                        │
│ brand_id                INT                                                │
│ deleted_by              INT                                                │
│ user_id                 INT                                                │
│ amount                  DOUBLE                                             │
│ delete_at               DATETIME                                           │
│ paid_at                 DATETIME                                           │
│ created_at              DATETIME                                           │
│ customer_id             INT             FK                                 │
│ sale_id                 INT             FK                                 │
│ turn_id                 INT             FK                                 │
│ payment_method_id       INT             FK                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  customer_id             →  customer.id                                 │
│                               ON DELETE RESTRICT                           │
│ FK  sale_id                 →  sale.id                                     │
│                               ON DELETE RESTRICT                           │
│ FK  turn_id                 →  turn.id                                     │
│                               ON DELETE RESTRICT                           │
│ FK  payment_method_id       →  payment_method.id                           │
│                               ON DELETE RESTRICT                           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ sale_item                                                  DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(80)                                        │
│ status                  INT                                                │
│ order_details           VARCHAR(255)                                       │
│ dedication              VARCHAR(255)                                       │
│ promotion_id            INT                                                │
│ price                   DOUBLE                                             │
│ quantity                DOUBLE                                             │
│ discount                DOUBLE                  el descuento total ej. 300 │
│                                                 pesos de descuento         │
│ discount_pct            DOUBLE                  % de descuento             │
│ line_discount           DOUBLE                  cuanto fue el descuento    │
│ amount                  DOUBLE                  cuanto se pago en total ej │
│                                                 pago con $ 500.00          │
│ refunded                DOUBLE                  cuanto se regreso de       │
│                                                 cambio ej. se devolvio     │
│                                                 $40.00                     │
│ created_at              DATETIME                                           │
│ discount_reason_id      INT             FK                                 │
│ product_id              INT             FK      producto/paquete           │
│ sale_id                 INT             FK      venta de                   │
│                                                 pedidos/pos/ecommerce      │
│ active                  INT                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  discount_reason_id      →  discount_reason.id                          │
│                               ON DELETE RESTRICT                           │
│ FK  product_id              →  product.id                                  │
│                               ON DELETE CASCADE                            │
│ FK  sale_id                 →  sale.id                                     │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 1583 líneas de pedido · conecta order con productos y customizados         │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ payment                                                    DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ type                    INT                                                │
│ description             TEXT                                               │
│ user_id                 INT                                                │
│ deleted_by              INT                                                │
│ delete_by               INT                                                │
├─ CAJA ─────────────────────────────────────────────────────────────────────┤
│ cashier_id              INT                                                │
│ cash_audit_id           INT                                                │
│ amount                  DOUBLE                                             │
│ paid_at                 DATETIME                                           │
│ delete_at               DATETIME                                           │
│ created_at              DATETIME                                           │
│ brand_id                INT             FK                                 │
│ payment_method_id       INT             FK                                 │
│ sale_id                 INT             FK                                 │
│ active                  TINYINT                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  brand_id                →  fayxzvov_alpha.subsidiaries.id              │
│                               ON DELETE RESTRICT                           │
│ FK  payment_method_id       →  payment_method.id                           │
│                               ON DELETE CASCADE                            │
│ FK  sale_id                 →  sale.id                                     │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 1963 abonos · sirve a pedidos y POS por igual                              │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ history_log                                                DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ title                   VARCHAR(50)                                        │
│ action                  TEXT                    created,updated,cancelled… │
│ detail                  TEXT                                               │
│ type                    VARCHAR(255)            sale | payment | turn |    │
│                                                 daily_closure              │
│ user_id                 INT                     apunta a usr_users.id ·    │
│                                                 SIN FK declarada           │
│ date_action             DATETIME                                           │
│ sale_id                 INT             FK                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  sale_id                 →  sale.id                                     │
│                               ON DELETE SET NULL                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 2020 historiales de orden                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ sale_images                                                DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ path                    TEXT                                               │
│ name                    TEXT                                               │
│ original_name           TEXT                                               │
│ created_at              DATETIME                                           │
│ sale_item_id            INT             FK                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  sale_item_id            →  sale_item.id                                │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 650 imágenes de orden (fotos del pedido)                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ turn_method                                                DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE                                             │
│ turn_id                 INT             FK                                 │
│ payment_method_id       INT             FK                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  turn_id                 →  turn.id                                     │
│                               ON DELETE CASCADE                            │
│ FK  payment_method_id       →  payment_method.id                           │
│                               ON DELETE SET NULL                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 2670 pagos de turno                                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ turn_order_type                                            DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE                                             │
│ turn_id                 INT             FK                                 │
│ status_process_id       INT             FK                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  turn_id                 →  turn.id                                     │
│                               ON DELETE CASCADE                            │
│ FK  status_process_id       →  order_type.id                               │
│                               ON DELETE CASCADE                            │
├────────────────────────────────────────────────────────────────────────────┤
│ 2673 desgloses de estatus por turno                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ daily_closure_method                                       DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ payments_count          INT                                                │
│ source                  VARCHAR(80)             venta / abono              │
│ amount                  DOUBLE                  monto declarado del        │
│                                                 sistema                    │
│ tip                     DOUBLE                  propinas cobradas          │
│ daily_closure_id        INT             FK                                 │
│ payment_method_id       INT             FK      forma de pago registrada   │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  daily_closure_id        →  daily_closure.id                            │
│                               ON DELETE SET NULL                           │
│ FK  payment_method_id       →  payment_method.id                           │
│                               ON DELETE SET NULL                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 1248 pagos de cierre                                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ daily_closure_order_type                                   DETALLE | reuso │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE                                             │
│ status_id               INT             FK                                 │
│ daily_closure_id        INT             FK                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  status_id               →  order_type.id                               │
│                               ON DELETE SET NULL                           │
│ FK  daily_closure_id        →  daily_closure.id                            │
│                               ON DELETE SET NULL                           │
├────────────────────────────────────────────────────────────────────────────┤
│ 559 desgloses de estatus por cierre · ← typo en nombre (proccess)          │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Pivotes

```
┌────────────────────────────────────────────────────────────────────────────┐
│ product_recipe                                                      PIVOTE │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ quantity                DOUBLE                                             │
│ cost                    DOUBLE                                             │
│ created_at              DATETIME                                           │
│ product_id              INT             FK      paquete base: Paquete      │
│                                                 Cumpleaños                 │
│ component_id            INT             FK      producto base para armar   │
│                                                 el paquete: Pastel, Velas  │
│ active                  TINYINT(1)                                         │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  product_id              →  product.id                                  │
│                               ON DELETE RESTRICT                           │
│ FK  component_id            →  product.id                                  │
│                               ON DELETE RESTRICT                           │
└────────────────────────────────────────────────────────────────────────────┘
```

---
