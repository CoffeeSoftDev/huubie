# ER de Pedidos — formato Coffee Intelligence

> Entregable de modelado sobre `fayxzvov_reginas`, esquema del módulo `alpha/pedidos`.
> Fuente de verdad de las convenciones: `~/.claude/steering/grimorios/db-rules.md`.
> **Esto documenta el esquema que YA existe**, no propone uno nuevo: las cajas son fieles
> a la BD viva y las flechas `←` marcan cada punto donde el esquema se separa de la regla.
> La auto-revisión de la sección 4 traduce esas marcas al checklist de `db-rules.md §7`.

---

## 0. Contexto del dominio

| | |
|---|---|
| Dominio | Punto de venta de pastelería multisucursal |
| Evento raíz | El **pedido** (`order`) |
| Eventos de control | **Turno de caja** (`cash_shift`) y **cierre del día** (`daily_closure`) |
| Esquema | `fayxzvov_reginas` · MySQL 5.7 · InnoDB · `latin1_swedish_ci` |
| Maestros corporativos | `fayxzvov_alpha` (sucursales, usuarios) · `fayxzvov_admin` (empresas) |
| Alcance | 20 tablas del módulo. Las `evt_*`, `pos_*` y `reservation*` del mismo esquema pertenecen a otros módulos y quedan fuera. |

---

## 1. Clasificación de tablas (db-rules §1.4)

| Clase | Tablas |
|---|---|
| **Catálogo** | `status_process` · `method_pay` · `order_category` · `order_products` · `order_modifier` · `order_clients` |
| **Sub-catálogo** | `order_modifier_products` |
| **Transacción raíz** | `order` · `cash_shift` · `daily_closure` |
| **Detalle / movimiento** | `order_package` · `order_payments` · `order_custom` · `order_custom_products` · `order_images` · `shift_payment` · `shift_status_process` · `closure_payment` · `closure_status_proccess` |
| **Bitácora** | `order_histories` |

Ningún pivote puro N:M. La relación producto↔pedido no es N:M: `order_package` tiene campos
propios (cantidad, precio, dedicatoria), así que es un detalle, no un pivote.

---

## 2. Diagrama de relaciones

Las tres transacciones raíz y lo que orbita alrededor de cada una:

```
   MAESTROS CORPORATIVOS                       CATÁLOGOS DEL DOMINIO
   (otros esquemas, no se duplican)
                                          status_process ─┐   method_pay ─┐
   fayxzvov_alpha.subsidiaries                            │               │
   fayxzvov_alpha.usr_users                  order_category               │
   fayxzvov_admin.companies                        │                      │
            │                                      │ 1                    │
            │                                      ▼ N                    │
            │                                order_products               │
            │                                      │                      │
            │                                      │                      │
            ▼                                      ▼                      ▼
  ╔═════════════════════╗              ╔════════════════════╗   ╔══════════════════╗
  ║   d a i l y _       ║   1      N   ║   c a s h _        ║   ║   o r d e r      ║
  ║   c l o s u r e     ╟──────────────╢   s h i f t        ╟───╢                  ║
  ║   RAÍZ · cierre Z   ║              ║   RAÍZ · turno     ║ 1 ║   RAÍZ · pedido  ║
  ╚══════╤═══════╤══════╝              ╚═════╤════════╤═════╝ N ╚══╤════╤═══════╤══╝
         │1      │1                          │1       │1           │1   │1      │1
         │N      │N                          │N       │N           │N   │N      │N
   ┌─────▼──┐ ┌──▼──────────┐        ┌───────▼──┐ ┌───▼─────────┐  │    │       │
   │closure_│ │closure_     │        │shift_    │ │shift_status_│  │    │       │
   │payment │ │status_      │        │payment   │ │process      │  │    │       │
   │        │ │proccess     │        │          │ │             │  │    │       │
   └────────┘ └─────────────┘        └──────────┘ └─────────────┘  │    │       │
                                                                   │    │       │
          El mismo patrón en los dos niveles:                      │    │       │
          cabecera + desglose por método + conteo por estado       │    │       │
                                                                   │    │       │
   ┌───────────────────────────────────────────────────────────────┘    │       │
   │                                                                    │       │
   ▼                                          ┌─────────────────────────┘       │
┌──────────────────┐                          ▼                                 ▼
│ order_package    │                  ┌────────────────┐              ┌──────────────────┐
│ RENGLÓN          │                  │ order_payments │              │ order_histories  │
│ polimórfico:     │                  │ cada abono     │              │ bitácora         │
│ product_id   ────┼──► order_products└────────────────┘              └──────────────────┘
│ custom_id    ────┼──► order_custom
│ modifier_id  ────┼──► order_modifier_products
└────────┬─────────┘
         │1                    order_custom  1 ──── N  order_custom_products
         │N                                                    │N
   ┌─────▼────────┐                                            │1
   │ order_images │                              order_modifier_products
   └──────────────┘                                            │N
                                                               │1
                                                        order_modifier
```

**Cardinalidades en una línea**

```
order_clients      1 ──── N  order
order              1 ──── N  order_package · order_payments · order_histories
order_package      1 ──── N  order_images
order_custom       1 ──── N  order_custom_products
order_modifier     1 ──── N  order_modifier_products
order_category     1 ──── N  order_products
cash_shift         1 ──── N  order · shift_payment · shift_status_process
daily_closure      1 ──── N  cash_shift · closure_payment · closure_status_proccess
status_process     1 ──── N  order · shift_status_process · closure_status_proccess
method_pay         1 ──── N  order_payments · shift_payment · closure_payment
```

---

## 3. Estructura de tablas

### 3.1 Catálogos

```
┌────────────────────────────────────────────────────────────────────────────┐
│ status_process                                          CATÁLOGO | 4 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ status                  VARCHAR(50)     NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Cotización · 2 Pendiente · 3 Pagado · 4 Cancelado                        │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ method_pay                                              CATÁLOGO | 3 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ method_pay              VARCHAR(20)     NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Efectivo · 2 Tarjeta · 3 Transferencia                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_category                                         CATÁLOGO | 11 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ classification          VARCHAR(255)    NULL   nombre de la categoría      │
│ description             TEXT            NULL                               │
│ date_creation           DATETIME        NULL                               │
│ subsidiaries_id         INT             NULL   FK                          │
│ active                  VARCHAR(255)    NULL   ← flag en VARCHAR           │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  subsidiaries_id        →  fayxzvov_alpha.subsidiaries(id)              │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_products                                        CATÁLOGO | 183 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)    NULL                               │
│ description             TEXT            NULL                               │
│ image                   TEXT            NULL   ruta del archivo            │
│ price                   DOUBLE          NULL                               │
│ date_creation           DATETIME        NULL                               │
│ category_id             INT             NULL   FK                          │
│ subsidiaries_id         INT             NULL   FK                          │
│ companies_id            INT             NULL   FK                          │
│ active                  INT             DEFAULT 1                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  category_id            →  order_category(id)                           │
│ FK  subsidiaries_id        →  fayxzvov_alpha.subsidiaries(id)              │
│ FK  companies_id           →  fayxzvov_admin.companies(id)                 │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_modifier                                         CATÁLOGO | 12 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    TEXT            NULL   ← nombre corto en TEXT      │
│ isExtra                 SMALLINT        DEFAULT 0   ← camelCase            │
│ date_creation           DATETIME        NULL                               │
│ active                  INT             DEFAULT 1                          │
├────────────────────────────────────────────────────────────────────────────┤
│ Las 12 categorías del pastel: forma, rellenos, cobertura,                  │
│ pisos, decoraciones, cake toppers, vitrina, envío…                         │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_modifier_products                           SUB-CATÁLOGO | 227 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)    NULL   la opción concreta          │
│ description             VARCHAR(255)    NULL                               │
│ price                   DOUBLE          NULL                               │
│ cant                    DOUBLE          DEFAULT 1   ← nombre en español    │
│ date_creation           DATETIME        NULL                               │
│ modifier_id             INT             NULL   FK                          │
│ active                  INT             DEFAULT 1                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  modifier_id            →  order_modifier(id)                           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_clients                                         CATÁLOGO | 821 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)    NULL                               │
│ phone                   DOUBLE          NULL   ← teléfono numérico         │
│ email                   VARCHAR(255)    DEFAULT ''                         │
│ date_create             DATETIME        NULL                               │
│ subsidiaries_id         INT             NULL   FK                          │
│ active                  INT             NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  subsidiaries_id        →  fayxzvov_alpha.subsidiaries(id)              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Transacciones raíz

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order                                       TRANSACCIÓN RAÍZ | 1,011 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ note                    TEXT            NULL                               │
│ location                VARCHAR(255)    DEFAULT ''  dirección de entrega   │
│ info_discount           TEXT            NULL   motivo del descuento        │
│ total_pay               DOUBLE          NULL   total del pedido            │
│ discount                DOUBLE          NULL                               │
│ tip_amount              DOUBLE          NULL   propina                     │
│ date_order              DATE            NULL   fecha de ENTREGA            │
│ time_order              TIME            NULL   hora de entrega             │
│ date_birthday           DATETIME        NULL                               │
│ date_creation           DATETIME        NULL   ← alta (no created_at)      │
│ cancelled_at            DATETIME        NULL                               │
│ status                  INT             NULL   FK  estado del pedido       │
│ type_id                 INT             NULL   ← duplica status            │
│ is_delivered            INT             DEFAULT 0   0 no · 1 sí · 2 producir│
│ delivery_type           INT             DEFAULT 0   0 local · 1 domicilio  │
│ delivery_tipe           INT             NULL   ← typo, columna muerta      │
│ is_delivery             INT             NULL   ← columna muerta            │
│ order_type              ENUM            'pedido','mostrador'               │
│ is_pos                  TINYINT         NULL                               │
│ is_legacy               INT             DEFAULT 0                          │
│ client_id               INT             NULL   FK                          │
│ subsidiaries_id         INT             NULL   FK                          │
│ cash_shift_id           INT             NULL   FK  turno que lo cobró      │
│ daily_closure_id        INT             NULL   FK  cierre que lo consolidó │
│ cancelled_by            INT             NULL   usuario, SIN FK             │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  client_id              →  order_clients(id)                            │
│ FK  status                 →  status_process(id)                           │
│ FK  subsidiaries_id        →  fayxzvov_alpha.subsidiaries(id)              │
│ FK  cash_shift_id          →  cash_shift(id)                               │
│ FK  daily_closure_id       →  daily_closure(id)                            │
├────────────────────────────────────────────────────────────────────────────┤
│ No tiene active: la baja se marca con status = 4 (Cancelado).              │
│ El folio NO se guarda, se calcula: 'P{id}-{sucursal 2 dígitos}'.           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ cash_shift                                    TRANSACCIÓN RAÍZ | 534 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ shift_name              VARCHAR(255)    NULL   nombre del turno            │
│ opening_amount          DOUBLE          NULL   fondo de caja               │
│ total_sales             DOUBLE          NULL   snapshot al cerrar          │
│ cash                    DOUBLE          NULL                               │
│ card                    DOUBLE          NULL                               │
│ transfer                DOUBLE          NULL                               │
│ total_orders            INT             NULL                               │
│ opened_at               DATETIME        NULL                               │
│ closed_at               DATETIME        NULL                               │
│ status                  ENUM            'open','closed'   ← ENUM           │
│ subsidiary_id           INT             NULL   FK  ← singular              │
│ employee_id             INT             NULL   FK                          │
│ daily_closure_id        INT             NULL   FK                          │
│ active                  INT             NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  subsidiary_id          →  fayxzvov_alpha.subsidiaries(id)              │
│ FK  employee_id            →  fayxzvov_alpha.usr_users(id)                 │
│ FK  daily_closure_id       →  daily_closure(id)                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Un solo turno abierto por sucursal a la vez (regla de negocio,             │
│ no hay UNIQUE que la respalde en la BD).                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ daily_closure                                 TRANSACCIÓN RAÍZ | 196 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ total                   DOUBLE          NULL                               │
│ subtotal                DOUBLE          NULL                               │
│ tax                     DOUBLE          NULL   siempre 0 hoy               │
│ total_cash              DOUBLE          NULL                               │
│ total_card              DOUBLE          NULL                               │
│ total_transfer          DOUBLE          NULL                               │
│ total_discount          DOUBLE          NULL                               │
│ total_shifts            DOUBLE          NULL   ← contador en DOUBLE        │
│ total_orders            INT             NULL                               │
│ closure_date            DATETIME        NULL   fecha de negocio            │
│ created_at              DATETIME        NULL   ← el único created_at       │
│ reopened_at             DATETIME        NULL                               │
│ reopen_reason           TEXT            NULL                               │
│ status                  DOUBLE          NULL   ← flag 0/1 en DOUBLE        │
│ is_legacy               INT             DEFAULT 0                          │
│ subsidiary_id           INT             NULL   FK                          │
│ employee_id             INT             NULL   FK  quien cerró             │
│ reopened_by             INT             NULL   FK  quien reabrió           │
│ active                  INT             NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  subsidiary_id          →  fayxzvov_alpha.subsidiaries(id)              │
│ FK  employee_id            →  fayxzvov_alpha.usr_users(id)                 │
│ FK  reopened_by            →  fayxzvov_alpha.usr_users(id)                 │
├────────────────────────────────────────────────────────────────────────────┤
│ status: 0 = cerrado · 1 = reabierto.                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Detalles y bitácora

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_package                               DETALLE de order | 1,072 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ order_details           VARCHAR(255)    DEFAULT ''  nota del renglón       │
│ dedication              VARCHAR(255)    DEFAULT ''  dedicatoria            │
│ quantity                INT             NULL                               │
│ price                   DOUBLE          NULL                               │
│ date_creation           DATETIME        NULL                               │
│ status                  INT             NULL                               │
│ pedidos_id              INT             NULL   FK  ← español + plural      │
│ product_id              INT             NULL   FK  catálogo                │
│ custom_id               INT             NULL   FK  pastel a la medida      │
│ modifier_id             INT             NULL   FK  opción suelta           │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  pedidos_id             →  order(id)                                    │
│ FK  product_id             →  order_products(id)                           │
│ FK  custom_id              →  order_custom(id)                             │
│ FK  modifier_id            →  order_modifier_products(id)                  │
├────────────────────────────────────────────────────────────────────────────┤
│ Renglón polimórfico: exactamente UNO de los tres origenes                  │
│ (product_id / custom_id / modifier_id) viene lleno.                        │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_payments                              DETALLE de order | 1,282 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ pay                     DOUBLE          NULL   importe del abono           │
│ description             TEXT            NULL                               │
│ date_pay                DATETIME        NULL                               │
│ type                    INT             NULL   ← siempre 2, sin uso        │
│ order_id                INT             NULL   FK                          │
│ method_pay_id           INT             NULL   FK                          │
│ subsidiaries_id         INT             NULL   cobro cruzado, SIN FK       │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  order_id               →  order(id)                                    │
│ FK  method_pay_id          →  method_pay(id)                               │
├────────────────────────────────────────────────────────────────────────────┤
│ subsidiaries_id = sucursal donde se COBRÓ, que puede ser                   │
│ distinta a la sucursal del pedido.                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_custom                          DETALLE de order_package | 757 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)    NULL                               │
│ description             VARCHAR(255)    NULL                               │
│ image                   VARCHAR(255)    NULL                               │
│ price                   DOUBLE          NULL   precio cobrado              │
│ price_real              DOUBLE          NULL   precio calculado            │
│ portion_qty             INT             NULL   porciones                   │
│ date_created            DATETIME        NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ Cabecera del pastel personalizado. No tiene FK de vuelta:                  │
│ es order_package.custom_id quien apunta hacia acá.                         │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_custom_products                DETALLE de order_custom | 3,867 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ details                 VARCHAR(255)    DEFAULT ''                         │
│ price                   DOUBLE          NULL                               │
│ quantity                DOUBLE          NULL                               │
│ date_created            DATETIME        NULL                               │
│ custom_id               INT             NULL   FK                          │
│ modifier_id             INT             NULL   FK  la opción elegida       │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  custom_id              →  order_custom(id)                             │
│ FK  modifier_id            →  order_modifier_products(id)                  │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_images                          DETALLE de order_package | 291 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ path                    TEXT            NULL   ← ruta en TEXT              │
│ name                    TEXT            NULL   ← nombre en TEXT            │
│ original_name           TEXT            NULL   ← nombre en TEXT            │
│ date_created            DATETIME        NULL                               │
│ package_id              INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  package_id             →  order_package(id)                            │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ order_histories                              BITÁCORA de order | 741 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ title                   VARCHAR(50)     NULL                               │
│ action                  TEXT            NULL   qué pasó                    │
│ comment                 TEXT            NULL                               │
│ type                    VARCHAR(255)    NULL   payment|discount|edition    │
│ date_action             DATETIME        NULL                               │
│ order_id                INT             NULL   FK                          │
│ usr_users_id            INT             NULL   FK  ← no es user_id         │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  order_id               →  order(id)                                    │
│ FK  usr_users_id           →  fayxzvov_alpha.usr_users(id)                 │
├────────────────────────────────────────────────────────────────────────────┤
│ Patrón CoffeeSoft *_histories. Sólo cubre pagos, descuentos y              │
│ ediciones; el alta del pedido no deja rastro propio.                       │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ shift_payment                          DETALLE de cash_shift | 1,557 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE          NULL                               │
│ cash_shift_id           INT             NULL   FK                          │
│ payment_method_id       INT             NULL   FK  ← no es method_pay_id   │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  cash_shift_id          →  cash_shift(id)                               │
│ FK  payment_method_id      →  method_pay(id)                               │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ shift_status_process                   DETALLE de cash_shift | 1,560 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE          NULL   ← es un CONTEO, no monto    │
│ cash_shift_id           INT             NULL   FK                          │
│ status_process_id       INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  cash_shift_id          →  cash_shift(id)                               │
│ FK  status_process_id      →  status_process(id)                           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ closure_payment                       DETALLE de daily_closure | 588 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE          NULL                               │
│ daily_closure_id        INT             NULL   FK                          │
│ payment_method_id       INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  daily_closure_id       →  daily_closure(id)                            │
│ FK  payment_method_id      →  method_pay(id)                               │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ closure_status_proccess               DETALLE de daily_closure | 259 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ amount                  DOUBLE          NULL   ← es un CONTEO, no monto    │
│ daily_closure_id        INT             NULL   FK                          │
│ status_process_id       INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  daily_closure_id       →  daily_closure(id)                            │
│ FK  status_process_id      →  status_process(id)                           │
├────────────────────────────────────────────────────────────────────────────┤
│ Nombre con typo real en la BD: 'proccess' con doble c.                     │
│ Su gemela del turno sí se llama shift_status_process.                      │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Auto-revisión contra el checklist de `db-rules.md §7`

Leyenda: **✓** cumple · **✗** no cumple · **~** cumple parcialmente.

### 4.1 Clasificación (§7.1)

```
✓  Cada tabla tiene una clase clara (catálogo / raíz / detalle / sub-catálogo)
✗  El prefijo de renglón NO es `detail_<raíz>`
      El esquema usa un prefijo de DOMINIO (`order_*`, `shift_*`, `closure_*`)
      en lugar del prefijo semántico de la regla:
         order_package            debería ser  detail_order
         order_payments           debería ser  detail_order_payment
         order_custom_products    debería ser  detail_order_custom
         shift_payment            debería ser  detail_cash_shift_payment
         closure_payment          debería ser  detail_daily_closure_payment
      Es una convención interna consistente, pero no la del grimorio.
✓  No se usa `detail_` mal aplicado en pivotes ni sub-catálogos (no hay ninguno)
```

### 4.2 Nombres (§7.2)

```
✗  Tablas en singular
      En plural:  order_clients · order_products · order_payments ·
                  order_histories · order_images · order_modifier_products ·
                  order_custom_products
      En singular: order · cash_shift · daily_closure · order_package ·
                  order_custom · order_category · order_modifier ·
                  method_pay · status_process · shift_payment
~  Columnas snake_case en inglés
      Excepciones reales:
         order_package.pedidos_id        español + plural (debería ser order_id)
         order_modifier_products.cant    español (debería ser quantity)
         order_modifier.isExtra          camelCase (debería ser is_extra)
         order.delivery_tipe             typo, columna muerta
         closure_status_proccess         typo en el NOMBRE DE LA TABLA
✓  PK siempre `id INT AUTO_INCREMENT` en las 20 tablas
✗  FK = `<tabla_referenciada>_id` — hay cuatro nombres para dos destinos:
         sucursal:  subsidiaries_id  (order, order_products, order_clients…)
                    subsidiary_id    (cash_shift, daily_closure)
         method_pay: method_pay_id     (order_payments)
                    payment_method_id (shift_payment, closure_payment)
         usuario:   usr_users_id     (order_histories)
                    employee_id      (cash_shift, daily_closure)
```

### 4.3 Columnas obligatorias (§7.3)

```
✓  `id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`      20 / 20 tablas
~  `active TINYINT NOT NULL DEFAULT 1`                7 / 20 tablas
      Lo tienen: cash_shift · daily_closure · order_products · order_category ·
                 order_clients · order_modifier · order_modifier_products
      Falta en:  order · order_package · order_payments · order_custom ·
                 order_custom_products · order_images · order_histories ·
                 shift_payment · shift_status_process · closure_payment ·
                 closure_status_proccess · method_pay · status_process
      Además el tipo es INT (o VARCHAR en order_category), no TINYINT,
      y ninguna lleva NOT NULL DEFAULT 1.
✗  `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`    1 / 20 tablas
      Sólo daily_closure.created_at. El resto usa cinco nombres distintos
      para lo mismo:  date_creation · date_create · date_created ·
                      date_pay · date_action · opened_at
      Ninguna tiene DEFAULT CURRENT_TIMESTAMP: la fecha la escribe PHP
      con date('Y-m-d H:i:s').
✗  `updated_at`                                       0 / 20 tablas
      No existe en ninguna tabla del módulo. No hay forma de saber en la BD
      cuándo se modificó un pedido; eso vive sólo en order_histories.
✓  Las transacciones raíz llevan sucursal y usuario
      order → subsidiaries_id · cash_shift y daily_closure → subsidiary_id +
      employee_id
✓  Hay `status` donde hay flujo: order · cash_shift · daily_closure
```

### 4.4 Tipos de datos (§7.4)

```
✓  Montos en DOUBLE — consistente en las 20 tablas
✗  Nombres cortos en VARCHAR, nunca TEXT
      order_modifier.name          TEXT   (12 filas, nombres de 5-30 chars)
      order_images.name            TEXT
      order_images.original_name   TEXT
      order_images.path            TEXT
✗  Estados discretos → catálogo + FK, no ENUM
      cash_shift.status   ENUM('open','closed')
      order.order_type    ENUM('pedido','mostrador')
      Ambos deberían ser FK a un catálogo, sobre todo cash_shift.status:
      el flujo ya pide un tercer estado (turno reabierto / recalculado).
✗  Contadores y flags con el tipo equivocado
      daily_closure.status         DOUBLE  para un flag 0/1
      daily_closure.total_shifts   DOUBLE  para un conteo de turnos
      order_clients.phone          DOUBLE  para un teléfono
         → pierde ceros a la izquierda, no admite +52 ni extensiones
      order_category.active        VARCHAR(255) para un booleano
      shift_status_process.amount  DOUBLE, pero guarda un CONTEO de pedidos;
      closure_status_proccess.amount   el nombre miente sobre el contenido
✓  Fecha de negocio en DATE — order.date_order
```

### 4.5 Foreign Keys (§7.5)

```
✓  30 FKs declaradas con CONSTRAINT explícito en el esquema
✓  Cada FK tiene su KEY
✗  Tres columnas de relación SIN FK declarada
      order_payments.subsidiaries_id  → sucursal del cobro cruzado
      order.cancelled_by              → usuario que canceló
      order_products.subsidiaries_id  (sí la tiene) — contrastar con la anterior
✓  Maestros corporativos referenciados cross-schema, no duplicados
      fayxzvov_alpha.subsidiaries · fayxzvov_alpha.usr_users ·
      fayxzvov_admin.companies
~  Política ON DELETE / ON UPDATE
      Las FKs existen pero conviene verificar una por una que
      detalle→raíz sea CASCADE y detalle→catálogo sea SET NULL.
```

### 4.6 Borrado (§7.6)

```
✗  Nunca DELETE físico
      Hay cuatro DELETE reales en los modelos:
         DELETE FROM order              (mdl-pedidos.php · deleteOrderById)
         DELETE FROM order_images       (×2)
         DELETE FROM shift_payment      (recalcShift borra y reinserta)
         DELETE FROM order_payments     (vía _Delete)
      El de shift_payment es aceptable: es la regeneración idempotente
      del desglose. Los de order y order_payments sí borran historial.
~  Los listados filtran `active = 1`
      Sólo donde la columna existe. El listado de pedidos filtra por
      status y por fechas, no por active — porque `order` no tiene active.
```

### 4.7 DDL / esquema (§7.7)

```
✓  Engine InnoDB en las 20 tablas del módulo
✗  Charset y collation
      Todo el esquema está en `latin1_swedish_ci`, no en
      `utf8mb4 / utf8mb4_0900_ai_ci`. Con acentos y ñ en nombres de
      productos y clientes, esto es deuda activa, no cosmética.
✗  MySQL 8
      El servidor es MySQL 5.7.36. La collation `utf8mb4_0900_ai_ci`
      que pide el grimorio ni siquiera existe en 5.7: la migración de
      charset tendría que ir a `utf8mb4_unicode_ci` mientras no se
      suba de versión.
~  Orden de columnas: id → negocio → montos → fechas → timestamps →
      status → FKs → active
      `order` y `daily_closure` lo respetan casi por completo.
      `cash_shift` mete los FKs antes de active, correcto.
      `order_category` pone active al final ✓ pero como VARCHAR ✗.
```

---

## 5. Resumen de la revisión

| Bloque del checklist | Resultado |
|---|---|
| Clasificación | ✓ clases claras · ✗ prefijo `detail_` no usado |
| Nombres | ✗ 7 tablas en plural · ✗ 3 pares de FK con nombres divergentes · 1 typo en nombre de tabla |
| Columnas obligatorias | ~ `active` en 7/20 · ✗ `created_at` en 1/20 · ✗ `updated_at` en 0/20 |
| Tipos | ✓ montos · ✗ 2 ENUM · ✗ 4 TEXT para nombres · ✗ 4 columnas con tipo equivocado |
| Foreign keys | ✓ 30 declaradas · ✗ 2 relaciones sin FK |
| Borrado | ✗ DELETE físico en `order` y `order_payments` |
| Esquema | ✓ InnoDB · ✗ latin1 en vez de utf8mb4 · ✗ MySQL 5.7 |

**Las tres desviaciones que sí cuestan dinero hoy**, en orden:

1. **`latin1_swedish_ci` en todo el esquema.** Nombres de productos y clientes con
   acentos y ñ. Es el que más riesgo de corrupción de datos acumula.
2. **Sin `updated_at` en ninguna tabla.** Cuando un pedido cambia de corte o un total
   no cuadra, no hay forma de preguntarle a la BD cuándo se tocó — hay que reconstruirlo
   desde `order_histories`, que sólo cubre parte de las operaciones.
3. **DELETE físico en `order` y `order_payments`.** Un pago borrado desaparece del
   histórico y descuadra cualquier recálculo posterior del turno.

Las de nomenclatura (plurales, `pedidos_id`, `cant`, `proccess`) son ruido real pero
barato: se viven con un renombre coordinado o con una capa de vistas, no urgen.

---

## 6. Qué sigue

Este entregable son las **cajas**, no el DDL. Si apruebas la lectura, el siguiente paso
puede ser cualquiera de estos, bajo pedido explícito:

- **DDL de migración** para las desviaciones que decidas atacar (charset, `updated_at`,
  tipos equivocados), con su plan de aplicación en local y luego en producción.
- **Esquema normalizado** de este mismo dominio como se vería recién nacido bajo
  `db-rules.md`, para usarlo de referencia en el POS nuevo.
- **Cajas del módulo de Eventos** (`evt_*`) o del POS (`pos_*`), que viven en el mismo
  esquema y todavía no están documentados.
