# Pedidos — Diagramas ER por sección

> Hermano de [base-de-datos.md](base-de-datos.md). Relaciones del esquema vivo (2026-06-18).
> Notación: `──▶` FK dentro de `fayxzvov_reginas` · `┄▷` FK cross-schema (tenant/admin).
> `1` = lado uno · `N` = lado muchos. Caja **doble** = esquema actual del módulo · caja **simple** = maestro cross-schema.

---

## 0. Diagrama global

```
        ╔═══════════════════╗ N        1 ┌──────────────────┐ N      1 ┌──────────────┐
        ║ order             ║┄┄┄┄┄┄┄┄┄┄┄▷│ subsidiaries     │┄┄┄┄┄┄┄┄▷│ companies    │
        ║ (transacción raíz)║            │ (alpha · tenant) │         │ (admin)      │
        ╚═══════════════════╝            └──────────────────┘         └──────────────┘
          │   │   │   │   │ N                    ▲ N
      ┌───┘   │   │   │   └───────────┐          ┊ 1
    1 ▼     N │ 1 │ N │             N ▼        ┌──────────────────┐
 ╔══════════╗ │   │   │        ╔═══════════╗   │ usr_users        │
 ║order_    ║ │   │   │        ║order_      ║   │ (alpha)          │
 ║clients   ║ │   │   │        ║payments    ║   └──────────────────┘
 ╚══════════╝ │   │   │        ╚═══════════╝          ▲ 1
    ┌─────────┘   │   └──────────┐                    ┊ N (employee/reopened)
  N ▼           N ▼            N ▼            ╔════════════╗   ╔══════════════╗
╔══════════╗ ╔══════════╗ ╔═══════════════╗  ║ cash_shift ║──▶║ daily_closure║
║order_    ║ ║status_   ║ ║ order_package ║  ╚════════════╝ N ╚══════════════╝ 1
║package   ║ ║process   ║ ║ (renglones)   ║     │ 1              │ 1
╚══════════╝ ╚══════════╝ ╚═══════════════╝   N ▼              N ▼
                              │  │  │       ╔═══════════════╗ ╔══════════════════╗
                              │  │  │       ║ shift_payment ║ ║ closure_payment  ║
                              │  │  │       ║ shift_status_ ║ ║ closure_status_  ║
                              │  │  │       ║   process     ║ ║   proccess       ║
                              │  │  │       ╚═══════════════╝ ╚══════════════════╝
                    ┌─────────┘  │  └──────────┐
                  N ▼          N ▼           N ▼
            ╔═════════════╗ ╔═══════════╗ ╔════════════════════════╗
            ║order_products║ ║order_custom║ ║order_modifier_products ║
            ╚═════════════╝ ╚═══════════╝ ╚════════════════════════╝
```

---

## 1. Sección PEDIDO (cabecera + abonos + bitácora)

**Fichas**

```
order  (raíz)                      order_clients (catálogo)        order_payments (movimiento)
 PK id                              PK id                           PK id
 datos status,total_pay,discount    datos name,phone,email          datos pay,type,description
 ──▶ client_id  → order_clients     ┄▷ subsidiaries_id              ──▶ order_id   → order
 ──▶ status     → status_process                                    ──▶ method_pay_id → method_pay
 ──▶ cash_shift_id → cash_shift
 ──▶ daily_closure_id → daily_closure
 ┄▷ subsidiaries_id → subsidiaries

order_histories (auditoría)
 PK id · datos action,comment,type
 ──▶ order_id → order   ·   ┄▷ usr_users_id (sin FK declarada)
```

**Conexiones**

```
order_clients   1 ──< N  order            (un cliente, muchos pedidos)
order           1 ──< N  order_payments   (un pedido, muchos abonos)
order           1 ──< N  order_histories  (un pedido, muchas entradas de bitácora)
status_process  1 ──< N  order            (un estado, muchos pedidos)
```

---

## 2. Sección LÍNEAS DEL PEDIDO (productos + personalizados + imágenes)

**Ficha central**

```
order_package  (renglón / detalle del pedido)
 PK id · datos quantity,price,order_details,dedication
 ──▶ pedidos_id  → order                       (a qué pedido pertenece)
 ──▶ product_id  → order_products              (si es producto de catálogo)
 ──▶ custom_id   → order_custom                (si es pastel personalizado)
 ──▶ modifier_id → order_modifier_products     (modificador aplicado)

order_images
 PK id · datos path,name,original_name
 ──▶ package_id → order_package
```

**Conexiones**

```
order            1 ──< N  order_package    (un pedido, varias líneas)
order_products   1 ──< N  order_package    (un producto puede ir en muchas líneas)
order_custom     1 ──< N  order_package    (un pastel custom referenciado por líneas)
order_package    1 ──< N  order_images     (una línea, varias fotos de referencia)
```

---

## 3. Sección CATÁLOGO (productos / categorías / modificadores)

**Fichas**

```
order_products (catálogo)          order_category (catálogo)       order_modifier (catálogo)
 PK id · datos name,price,image     PK id · datos classification    PK id · datos name,isExtra
 ──▶ category_id → order_category   ┄▷ subsidiaries_id              (grupo de modificadores)
 ┄▷ subsidiaries_id
 ┄▷ companies_id                   order_modifier_products (sub-catálogo)
                                    PK id · datos name,price,cant
                                    ──▶ modifier_id → order_modifier
```

**Conexiones**

```
order_category  1 ──< N  order_products            (categoría → productos)
order_modifier  1 ──< N  order_modifier_products   (grupo → opciones)
subsidiaries    1 ──< N  order_products            (catálogo por sucursal)
companies       1 ──< N  order_products
```

---

## 4. Sección PASTEL PERSONALIZADO

**Fichas**

```
order_custom                        order_custom_products
 PK id · datos name,portion_qty      PK id · datos price,quantity,details
        price,price_real             ──▶ custom_id   → order_custom
 (cabecera del pastel)               ──▶ modifier_id → order_modifier_products
```

**Conexiones**

```
order_custom              1 ──< N  order_custom_products   (pastel → componentes)
order_modifier_products   1 ──< N  order_custom_products   (opción usada en componentes)
```

---

## 5. Sección TURNO DE CAJA

**Fichas**

```
cash_shift (transacción)            shift_payment              shift_status_process
 PK id · datos opening_amount,       PK id · datos amount        PK id · datos amount
        total_sales,cash,card,       ──▶ cash_shift_id           ──▶ cash_shift_id
        transfer,status              ──▶ payment_method_id       ──▶ status_process_id
 ┄▷ subsidiary_id  → subsidiaries        → method_pay                → status_process
 ┄▷ employee_id    → usr_users
 ──▶ daily_closure_id → daily_closure
```

**Conexiones**

```
cash_shift     1 ──< N  shift_payment          (desglose por método de pago)
cash_shift     1 ──< N  shift_status_process   (conteo por estado de pedido)
cash_shift     1 ──< N  order                  (pedidos atendidos en el turno)
subsidiaries   1 ──< N  cash_shift
usr_users      1 ──< N  cash_shift             (employee_id)
```

---

## 6. Sección CIERRE DEL DÍA

**Fichas**

```
daily_closure (transacción)         closure_payment            closure_status_proccess
 PK id · datos total,total_cash,     PK id · datos amount        PK id · datos amount
        total_card,total_transfer,   ──▶ daily_closure_id        ──▶ daily_closure_id
        total_orders,status          ──▶ payment_method_id       ──▶ status_process_id
 ┄▷ subsidiary_id  → subsidiaries        → method_pay                → status_process
 ┄▷ employee_id    → usr_users
 ┄▷ reopened_by    → usr_users  (reapertura)
```

**Conexiones**

```
daily_closure  1 ──< N  closure_payment          (desglose por método)
daily_closure  1 ──< N  closure_status_proccess  (conteo por estado)
daily_closure  1 ──< N  cash_shift               (turnos incluidos en el cierre)
daily_closure  1 ──< N  order                    (pedidos del día cerrados)
subsidiaries   1 ──< N  daily_closure
```

---

## 7. Tabla de cardinalidades (resumen)

| Padre (1) | Hijo (N) | FK en el hijo | Tipo |
|---|---|---|---|
| order_clients | order | client_id | ──▶ negocio |
| status_process | order | status | ──▶ negocio |
| cash_shift | order | cash_shift_id | ──▶ negocio |
| daily_closure | order | daily_closure_id | ──▶ negocio |
| order | order_payments | order_id | ──▶ negocio |
| order | order_package | pedidos_id | ──▶ negocio |
| order | order_histories | order_id | ──▶ negocio |
| order_products | order_package | product_id | ──▶ negocio |
| order_custom | order_package | custom_id | ──▶ negocio |
| order_modifier_products | order_package | modifier_id | ──▶ negocio |
| order_package | order_images | package_id | ──▶ negocio |
| order_category | order_products | category_id | ──▶ negocio |
| order_modifier | order_modifier_products | modifier_id | ──▶ negocio |
| order_custom | order_custom_products | custom_id | ──▶ negocio |
| order_modifier_products | order_custom_products | modifier_id | ──▶ negocio |
| method_pay | order_payments | method_pay_id | ──▶ negocio |
| cash_shift | shift_payment | cash_shift_id | ──▶ negocio |
| cash_shift | shift_status_process | cash_shift_id | ──▶ negocio |
| daily_closure | cash_shift | daily_closure_id | ──▶ negocio |
| daily_closure | closure_payment | daily_closure_id | ──▶ negocio |
| daily_closure | closure_status_proccess | daily_closure_id | ──▶ negocio |
| method_pay | shift_payment / closure_payment | payment_method_id | ──▶ negocio |
| status_process | shift_status_process / closure_status_proccess | status_process_id | ──▶ negocio |
| **alpha.subsidiaries** | order, order_clients, order_products, order_category, cash_shift, daily_closure | subsidiar(y\|ies)_id | ┄▷ tenant |
| **alpha.usr_users** | cash_shift, daily_closure | employee_id / reopened_by | ┄▷ tenant |
| **admin.companies** | order_products, alpha.subsidiaries | companies_id | ┄▷ admin |
```
