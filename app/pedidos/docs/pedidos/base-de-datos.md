# Pedidos — Base de datos (esquema vivo)

> **Inspeccionado vía PDO contra MySQL 8.0.31 el 2026-06-18.** Columnas, tipos, llaves,
> FKs declaradas y conteo de filas son los **reales** de la instancia local.
> Formato de tabla en cajas: `PK` · campos de negocio · montos · fechas · estado/FK.
> Convención de flechas: `──▶` FK dentro de `fayxzvov_reginas` · `┄▷` FK cross-schema (tenant/admin).

---

## 1. Conexión

| Parámetro | Valor |
|---|---|
| Host / Driver | `localhost` · PDO MySQL |
| Usuario / Pass | `root` / *(vacío en WAMP local)* |
| DB por defecto | `fayxzvov_alpha` (las queries califican el esquema explícitamente) |
| Charset | `SET NAMES utf8` |
| Config | [conf/_Conect.php](../../../conf/_Conect.php) · CRUD base [conf/_CRUD.php](../../../conf/_CRUD.php) |
| `$this->bd` | `'fayxzvov_reginas.'` (definido en [mdl-pedidos.php](../../mdl/mdl-pedidos.php)) |

Los tres esquemas se combinan con **JOINs cross-schema** calificados (`fayxzvov_alpha.subsidiaries`, `fayxzvov_admin.companies`).

---

## 2. Mapa de esquemas

```
fayxzvov_admin            fayxzvov_alpha                fayxzvov_reginas
┌──────────────┐          ┌──────────────────┐         ┌───────────────────────────────┐
│ companies    │◀─────────│ subsidiaries     │◀────────│ order  (transacción raíz)     │
│ (empresa)    │          │ usr_users        │◀────────│ order_clients, order_products │
└──────────────┘          │ usr_rols         │         │ cash_shift, daily_closure ... │
   ADMINISTRACIÓN          └──────────────────┘         └───────────────────────────────┘
                                TENANT                         MÓDULO (POS)
```

`fayxzvov_reginas` es un esquema legacy de ~57 tablas (eventos, reservaciones, inventario,
loyalty, kds…). **El módulo Pedidos solo usa el subconjunto** documentado abajo.

---

## 3. Núcleo del pedido — `fayxzvov_reginas`

### 3.1 `order` — transacción raíz

```
┌─ order ──────────────────────────────── raíz · 372 filas ─┐
│ id                int            PK · auto_increment        │
│ ── negocio ──                                              │
│ note              text           notas del pedido           │
│ location          varchar(255)   ubicación (default '')     │
│ delivery_type     int            0=local · 1=domicilio      │
│ is_delivered      int            0/1 entregado              │
│ order_type        enum('pedido','mostrador')                │
│ is_pos            tinyint        creado desde POS           │
│ ── montos (DOUBLE) ──                                       │
│ total_pay         double         total del pedido           │
│ discount          double         monto de descuento         │
│ info_discount     text           motivo del descuento       │
│ tip_amount        double         propina (default 0)        │
│ ── fechas ──                                               │
│ date_order        date           fecha de ENTREGA           │
│ time_order        time           hora de entrega            │
│ date_birthday     datetime       cumpleaños del cliente     │
│ date_creation     datetime       alta del registro          │
│ cancelled_at      datetime       fecha de cancelación       │
│ ── estado / FK ──                                          │
│ status            int       ──▶ status_process.id           │
│ type_id           int            avance de pago (1/2/3) *   │
│ client_id         int       ──▶ order_clients.id            │
│ subsidiaries_id   int       ┄▷ alpha.subsidiaries.id        │
│ cash_shift_id     int       ──▶ cash_shift.id               │
│ daily_closure_id  int       ──▶ daily_closure.id            │
│ cancelled_by      int            usuario que canceló        │
│ ── legacy ──   is_delivery · delivery_tipe(typo) · is_legacy│
└────────────────────────────────────────────────────────────┘
* type_id duplica la información de status (redundante).
```

### 3.2 `order_clients` — catálogo de clientes

```
┌─ order_clients ─────────────────────── catálogo · 321 filas ─┐
│ id                int            PK · auto_increment           │
│ name              varchar(255)                                 │
│ phone             double   ⚠ debería ser VARCHAR (pierde 0s)   │
│ email             varchar(255)   default ''                    │
│ active            int            soft-delete                   │
│ date_create       datetime                                     │
│ subsidiaries_id   int       ┄▷ alpha.subsidiaries.id           │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 `order_payments` — abonos del pedido

```
┌─ order_payments ────────────────────── movimiento · 416 filas ─┐
│ id                int            PK · auto_increment             │
│ pay               double         importe del abono               │
│ type              int            tipo de movimiento              │
│ description        text           observación                    │
│ date_pay          datetime                                       │
│ order_id          int       ──▶ order.id                         │
│ method_pay_id     int       ──▶ method_pay.id                    │
└──────────────────────────────────────────────────────────────────┘
```

### 3.4 `order_package` — renglones del pedido (líneas)

```
┌─ order_package ─────────────────────── detalle · 311 filas ─┐
│ id                int            PK · auto_increment          │
│ quantity          int            cantidad                     │
│ price             double         precio de línea              │
│ order_details     varchar(255)   detalle libre (default '')   │
│ dedication        varchar(255)   dedicatoria (default '')     │
│ status            int                                         │
│ date_creation     datetime                                   │
│ pedidos_id        int       ──▶ order.id        (cabecera)    │
│ product_id        int       ──▶ order_products.id (catálogo)  │
│ custom_id         int       ──▶ order_custom.id   (pastel)    │
│ modifier_id       int       ──▶ order_modifier_products.id    │
└───────────────────────────────────────────────────────────────┘
Cada renglón es un producto de catálogo (product_id) o un pastel
personalizado (custom_id), opcionalmente con un modificador.
```

### 3.5 `order_images` — imágenes de referencia

```
┌─ order_images ──────────────────────── adjuntos · 14 filas ─┐
│ id                int            PK · auto_increment          │
│ path / name / original_name   text   archivo subido          │
│ date_created      datetime                                   │
│ package_id        int       ──▶ order_package.id              │
└───────────────────────────────────────────────────────────────┘
```

### 3.6 `order_histories` — bitácora del pedido

```
┌─ order_histories ───────────────────── auditoría · 145 filas ─┐
│ id                int            PK · auto_increment            │
│ title             varchar(50)                                  │
│ action / comment  text           qué pasó                      │
│ type              varchar(255)   payment / general …           │
│ date_action       datetime                                     │
│ order_id          int       ──▶ order.id                       │
│ usr_users_id      int       ┄▷ alpha.usr_users.id (sin FK decl)│
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Catálogo de productos — `fayxzvov_reginas`

### 4.1 `order_products` · `order_category`

```
┌─ order_products ────────────────────── catálogo · 333 filas ─┐   ┌─ order_category ──────── catálogo · 13 filas ─┐
│ id              int     PK · auto_increment                   │   │ id              int   PK · auto_increment      │
│ name            varchar(255)                                  │   │ classification  varchar(255)  nombre categoría │
│ description     text                                          │   │ description     text                           │
│ image           text                                         │   │ active          varchar(255) ⚠ debería ser int │
│ price           double                                       │   │ date_creation   datetime                       │
│ active          int     default 1                            │   │ subsidiaries_id int   ┄▷ alpha.subsidiaries.id │
│ date_creation   datetime                                     │   └────────────────────────────────────────────────┘
│ category_id     int  ──▶ order_category.id                   │
│ subsidiaries_id int  ┄▷ alpha.subsidiaries.id                │
│ companies_id    int  ┄▷ admin.companies.id                   │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 `order_modifier` · `order_modifier_products`

```
┌─ order_modifier ──────────── catálogo · 11 filas ─┐   ┌─ order_modifier_products ──── sub-catálogo · 216 filas ─┐
│ id            int   PK · auto_increment            │   │ id            int   PK · auto_increment                  │
│ name          text  grupo de modificador           │   │ name          varchar(255)                              │
│ isExtra       smallint  0=opción · 1=extra cobrado  │   │ price         double                                    │
│ active        int   default 1                       │   │ cant          double  default 1                         │
│ date_creation datetime                              │   │ description    varchar(255)                              │
└─────────────────────────────────────────────────────┘   │ active        int   default 1                            │
                                                           │ date_creation datetime                                  │
                                                           │ modifier_id   int   ──▶ order_modifier.id               │
                                                           └──────────────────────────────────────────────────────────┘
```

---

## 5. Pasteles personalizados — `fayxzvov_reginas`

```
┌─ order_custom ──────────────────────── 303 filas ─┐   ┌─ order_custom_products ─────────── 1 644 filas ─┐
│ id            int   PK · auto_increment            │   │ id            int   PK · auto_increment          │
│ name          varchar(255)                         │   │ price         double                            │
│ description   varchar(255)                         │   │ quantity      double                            │
│ image         varchar(255)                         │   │ details       varchar(255)  default ''          │
│ price         double   precio de venta             │   │ date_created  datetime                          │
│ price_real    double   costo real                  │   │ custom_id     int  ──▶ order_custom.id           │
│ portion_qty   int      porciones                   │   │ modifier_id   int  ──▶ order_modifier_products.id│
│ date_created  datetime                             │   └───────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────┘
Un pastel (order_custom) se compone de N order_custom_products (capas/rellenos/extras).
```

---

## 6. Catálogos de referencia — `fayxzvov_reginas`

```
┌─ status_process ── 4 filas ─┐     ┌─ method_pay ──────── 3 filas ─┐
│ id   int  PK                │     │ id          int  PK            │
│ status varchar(50)          │     │ method_pay  varchar(20)        │
│                             │     │ code        text               │
│ 1 Cotización  2 Pendiente   │     │ 1 Efectivo(EFE) 2 Tarjeta(TDC) │
│ 3 Pagado      4 Cancelado   │     │ 3 Transferencia (TRANSF)       │
└─────────────────────────────┘     └─────────────────────────────────┘
```

---

## 7. Turnos de caja — `fayxzvov_reginas`

### 7.1 `cash_shift` — turno

```
┌─ cash_shift ──────────────────────────── transacción · 47 filas ─┐
│ id                int            PK · auto_increment               │
│ shift_name        varchar(255)   nombre del turno                  │
│ status            enum('open','closed')                            │
│ ── montos (DOUBLE) ──                                              │
│ opening_amount    double         fondo de apertura                 │
│ total_sales       double         venta total del turno             │
│ cash / card / transfer  double    desglose por método              │
│ total_orders      int            pedidos del turno                 │
│ ── fechas ──   opened_at · closed_at   datetime                    │
│ ── FK ──                                                           │
│ subsidiary_id     int       ┄▷ alpha.subsidiaries.id  (singular!)  │
│ employee_id       int       ┄▷ alpha.usr_users.id                  │
│ daily_closure_id  int       ──▶ daily_closure.id                   │
│ active            int                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 `shift_payment` · `shift_status_process` — desglose del turno

```
┌─ shift_payment ──────────── 126 filas ─┐   ┌─ shift_status_process ─────── 126 filas ─┐
│ id                int  PK               │   │ id                int  PK                 │
│ amount            double                │   │ amount            double  conteo           │
│ cash_shift_id     int ──▶ cash_shift.id │   │ cash_shift_id     int ──▶ cash_shift.id    │
│ payment_method_id int ──▶ method_pay.id │   │ status_process_id int ──▶ status_process.id│
└──────────────────────────────────────────┘   └─────────────────────────────────────────────┘
```

---

## 8. Cierre del día — `fayxzvov_reginas`

### 8.1 `daily_closure` — cierre

```
┌─ daily_closure ─────────────────────────── transacción · 5 filas ─┐
│ id                int            PK · auto_increment                │
│ status            double         estado del cierre                  │
│ ── montos (DOUBLE) ──                                               │
│ total / subtotal / tax           double                             │
│ total_cash / total_card / total_transfer  double                    │
│ total_discount / total_shifts    double                             │
│ total_orders      int                                               │
│ ── fechas ──   created_at · closure_date · reopened_at  datetime    │
│ ── FK / reapertura ──                                               │
│ subsidiary_id     int       ┄▷ alpha.subsidiaries.id                │
│ employee_id       int       ┄▷ alpha.usr_users.id                   │
│ reopened_by       int       ┄▷ alpha.usr_users.id                   │
│ reopen_reason     text                                              │
│ active            int     ·   is_legacy int                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 `closure_payment` · `closure_status_proccess` — desglose del cierre

```
┌─ closure_payment ─────────── 15 filas ─┐   ┌─ closure_status_proccess ⚠typo · 7 filas ─┐
│ id                int  PK               │   │ id                int  PK                  │
│ amount            double                │   │ amount            double  conteo            │
│ daily_closure_id  int ──▶ daily_closure │   │ daily_closure_id  int ──▶ daily_closure.id  │
│ payment_method_id int ──▶ method_pay.id │   │ status_process_id int ──▶ status_process.id │
└──────────────────────────────────────────┘   └──────────────────────────────────────────────┘
```

---

## 9. Maestros del tenant — `fayxzvov_alpha` / `fayxzvov_admin`

```
┌─ alpha.subsidiaries ── 8 filas ─┐   ┌─ alpha.usr_users ──── 41 filas ─┐   ┌─ admin.companies ── 4 filas ─┐
│ id            int  PK            │   │ id            int  PK            │   │ id           int  PK          │
│ name          varchar(200)      │   │ fullname / user / key  text     │   │ social_name  varchar(255)     │
│ logo / ubication text           │   │ photo         text              │   │ rfc          varchar(20)      │
│ enabled / active                │   │ phone         varchar(255)      │   │ logo/address/ubication text   │
│ date_creation datetime          │   │ birthday      date              │   │ phone        double           │
│ companies_id  int ┄▷ companies  │   │ enabled/active/owner            │   │ name_bd      varchar(255)     │
└───────────────────────────────────┘   │ usr_rols_id   int ──▶ usr_rols  │   │ customers_id int ┄▷ customers │
                                        │ subsidiaries_id int ──▶ subsid. │   └────────────────────────────────┘
┌─ alpha.usr_rols ── 5 filas ─┐         └───────────────────────────────────┘
│ id int PK · rols varchar(50)│           rol 1 = admin (todas las sucursales)
│ active · superadmin         │
└─────────────────────────────┘
```

---

## 10. Hallazgos de la inspección (auto-revisión)

| # | Hallazgo | Detalle / riesgo |
|---|---|---|
| 1 | **Tablas inexistentes referenciadas** | `projects`, `order_details`, `cash_shift_movements` viven en el código (ctrl/mdl-projects, getOrderById, getShiftMovements) pero **no existen** → rutas muertas o errores en runtime. |
| 2 | **Inconsistencia `subsidiaries_id` vs `subsidiary_id`** | `order`/`order_clients`/`order_products` usan plural; `cash_shift`/`daily_closure` usan singular. Dificulta JOINs genéricos. |
| 3 | **Typos en nombres de objeto** | tabla `closure_status_proccess` (doble c) · columna `order.delivery_tipe`. Quedan congelados por compatibilidad. |
| 4 | **`phone` como `DOUBLE`** | en `order_clients` y `companies`. Pierde ceros a la izquierda y `+`/espacios → debería ser `VARCHAR`. |
| 5 | **`order_category.active` como `VARCHAR(255)`** | bandera de soft-delete en texto; debería ser `TINYINT`. |
| 6 | **Columnas legacy duplicadas en `order`** | `is_delivery` + `delivery_tipe` + `delivery_type` conviven; solo `delivery_type` se usa hoy. `type_id` duplica `status`. |
| 7 | **FKs declaradas pero sin `created_at/updated_at` estándar** | varias tablas usan `date_creation`/`date_created` en vez de los `created_at`/`updated_at` canónicos. |
| 8 | **Sin prefijo `detail_`** | `order_package` y `order_custom_products` son renglones de transacción; en el estándar de la casa serían `detail_*`. Es esquema heredado, se documenta, no se renombra. |

> Estos puntos son **observaciones sobre el esquema existente**, no un rediseño. Cualquier
> corrección (p. ej. unificar `subsidiary(ies)_id` o tipar `phone`) requiere migración + ajuste
> de las queries en `mdl/*.php`.
