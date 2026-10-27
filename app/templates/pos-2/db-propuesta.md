# Propuesta de base de datos — POS-2 (Reginas)

> **Estado:** ✅ **Decisiones cerradas** — listo para Fase 3 (DDL).
> **Autor:** Coffee Intelligence
> **Fecha:** 2026-05-12
> **Esquema destino:** `fayxzvov_reginas`
> **Charset / Collation:** `utf8mb4` / `utf8mb4_0900_ai_ci`
> **Engine:** `InnoDB`

---

## 1. Resumen ejecutivo

POS-2 es el módulo de Punto de Venta de mostrador para Reginas, que **convive en el mismo esquema `fayxzvov_reginas`** que el sistema de pedidos existente. Las nuevas tablas usan prefijo `pos_*` para identificar dominio del módulo. La premisa del usuario fue clara: **"pedidos y ventas van dentro del mismo sistema"**, por lo que se reusa toda la infraestructura compartida (productos, turnos, cierres, clientes, modificadores, estados) y solo se agregan tablas nuevas para lo que el POS aporta de novedad.

---

## 2. Decisiones cerradas

| # | Decisión | Resolución |
|---|---|---|
| 1 | Raíz de venta | **Opción A** — Reusar `order` legacy con flag `is_pos` |
| 2 | Catálogo métodos de pago | **Convivir** — `pos_payment_type` nueva, `method_pay` queda intacta |
| 3 | Tabla de cobros | **Paralela** — `pos_order_payment` nueva (no ALTER a `order_payments`) |
| 4 | Descuentos | **Una tabla** — `pos_order_discount` con `scope ∈ {'order','line'}` |
| 5 | Motivos de descuento | **5 motivos** — CORTESIA, CLIENTE_FREC, PROMO, EMPLEADO, OTRO |
| 6 | Charset tablas nuevas | **`utf8mb4_0900_ai_ci`** (legacy queda como deuda técnica) |
| 7 | Discriminador en `order` | **`is_pos TINYINT NOT NULL DEFAULT 0`** |
| 8 | Estados POS | **Reusar `status_process`** con sus 4 valores actuales |
| 9 | Propina | **Columna `tip_amount DOUBLE` en `order`** |
| — | Métodos de pago a sembrar | **5** — EFE, TDC, CORT, TRF, OTRO |
| — | Bitácora | **Reusar `order_histories`** (coherente con Opción A) |

---

## 3. Tablas que se REUSAN

### 3.1 Maestros corporativos (`fayxzvov_alpha`, cross-schema)

| Tabla | Rol | Columnas usadas |
|---|---|---|
| `fayxzvov_alpha.subsidiaries` | UDN / sucursal donde se factura | `idSubsidiary`, `name`, `active` |
| `fayxzvov_alpha.usr_users` | Cajero / supervisor | `idUser`, `name`, `active` |

### 3.2 Catálogos productos y modificadores (`fayxzvov_reginas`)

| Tabla | Rol |
|---|---|
| `order_products` | Catálogo de productos vendibles |
| `order_category` | Categorías para grilla y filtros |
| `order_modifier` | Modificadores (sin azúcar, extra queso, …) |
| `order_modifier_products` | Pivote producto ↔ modificador disponible |

### 3.3 Clientes (`fayxzvov_reginas`)

| Tabla | Rol |
|---|---|
| `order_clients` | Fuente única de clientes (compartida pedido / POS) |

### 3.4 Turnos y cierres (`fayxzvov_reginas`)

| Tabla | Rol |
|---|---|
| `cash_shift` | Turno abierto / cerrado del cajero |
| `shift_payment` | Cobros por método dentro del turno |
| `shift_status_process` | Estados de turno |
| `daily_closure` | Cierre del día por sucursal |
| `closure_payment` | Cobros por método dentro del cierre |
| `closure_status_proccess` | Estados de cierre |

### 3.5 Estados (`fayxzvov_reginas`)

| Tabla | Rol | Valores actuales |
|---|---|---|
| `status_process` | Estado de la venta POS | `Cotización`, `Pendiente`, `Pagado`, `Cancelado` |

### 3.6 Bitácora (`fayxzvov_reginas`)

| Tabla | Rol |
|---|---|
| `order_histories` | Bitácora unificada de cambios (pedido + venta POS) |

---

## 4. Cambios en tabla `order` legacy

### 4.1 ALTER mínimo

```sql
ALTER TABLE `order`
  ADD COLUMN `is_pos` TINYINT NOT NULL DEFAULT 0 AFTER `status_proccess_id`,
  ADD COLUMN `tip_amount` DOUBLE NOT NULL DEFAULT 0 AFTER `total`;
```

- `is_pos = 0` → pedido a domicilio (legacy intacto).
- `is_pos = 1` → venta de mostrador POS-2.
- `tip_amount` → propina total del ticket (suma a `total`).

### 4.2 Comportamiento legacy preservado

Columnas como `delivery_type`, `address_id`, `date_birthday`, `is_delivery` se llenan `NULL` cuando `is_pos = 1`. Cero refactor en pedidos.

---

## 5. Tablas NUEVAS (`fayxzvov_reginas`)

### 5.1 `pos_payment_type` — métodos de pago del POS

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK auto_increment | |
| `code` | VARCHAR(10) NOT NULL UNIQUE | EFE, TDC, CORT, TRF, OTRO |
| `name` | VARCHAR(60) NOT NULL | Nombre legible |
| `requires_reference` | TINYINT NOT NULL DEFAULT 0 | Si pide referencia / autorización |
| `is_cash` | TINYINT NOT NULL DEFAULT 0 | Suma a "efectivo en caja" |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `active` | TINYINT NOT NULL DEFAULT 1 | |

**Seed inicial:**

| code | name | requires_reference | is_cash |
|---|---|:-:|:-:|
| EFE | Efectivo | 0 | 1 |
| TDC | Tarjeta de crédito | 1 | 0 |
| CORT | Cortesía | 0 | 0 |
| TRF | Transferencia | 1 | 0 |
| OTRO | Otro | 0 | 0 |

---

### 5.2 `pos_discount_reason` — motivos de descuento

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK auto_increment | |
| `code` | VARCHAR(20) NOT NULL UNIQUE | CORTESIA, CLIENTE_FREC, PROMO, EMPLEADO, OTRO |
| `name` | VARCHAR(80) NOT NULL | Nombre legible |
| `requires_authorization` | TINYINT NOT NULL DEFAULT 0 | Si necesita supervisor |
| `max_percentage` | DOUBLE NOT NULL DEFAULT 100 | Tope sin autorización |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `active` | TINYINT NOT NULL DEFAULT 1 | |

**Seed inicial:**

| code | name | requires_auth | max_pct |
|---|---|:-:|:-:|
| CORTESIA | Cortesía | 1 | 100 |
| CLIENTE_FREC | Cliente frecuente | 0 | 15 |
| PROMO | Promoción vigente | 0 | 100 |
| EMPLEADO | Descuento a empleado | 1 | 30 |
| OTRO | Otro motivo | 1 | 100 |

---

### 5.3 `pos_order_payment` — split de pago del POS (cuelga de `order`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK auto_increment | |
| `amount` | DOUBLE NOT NULL DEFAULT 0 | Monto aplicado a la venta |
| `tendered_amount` | DOUBLE NOT NULL DEFAULT 0 | Lo que entregó el cliente |
| `change_amount` | DOUBLE NOT NULL DEFAULT 0 | Cambio devuelto |
| `reference` | VARCHAR(50) DEFAULT NULL | Referencia bancaria / SPEI |
| `authorization_code` | VARCHAR(50) DEFAULT NULL | Código de autorización |
| `last_four` | VARCHAR(4) DEFAULT NULL | Últimos 4 de la tarjeta |
| `paid_at` | DATETIME NOT NULL | Momento del cobro |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `order_id` | INT NOT NULL | FK → `order(id)` CASCADE/CASCADE |
| `pos_payment_type_id` | INT DEFAULT NULL | FK → `pos_payment_type(id)` SET NULL/CASCADE |
| `user_id` | INT DEFAULT NULL | FK → `fayxzvov_alpha.usr_users(idUser)` SET NULL/CASCADE |
| `active` | TINYINT NOT NULL DEFAULT 1 | |

---

### 5.4 `pos_order_discount` — descuentos por ticket o línea (cuelga de `order`)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT PK auto_increment | |
| `scope` | VARCHAR(10) NOT NULL DEFAULT 'order' | `'order'` o `'line'` |
| `amount` | DOUBLE NOT NULL DEFAULT 0 | Monto descontado |
| `percentage` | DOUBLE NOT NULL DEFAULT 0 | Porcentaje aplicado |
| `coupon_code` | VARCHAR(50) DEFAULT NULL | Si viene de cupón |
| `notes` | TEXT DEFAULT NULL | Justificación libre |
| `applied_at` | DATETIME NOT NULL | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `order_id` | INT NOT NULL | FK → `order(id)` CASCADE/CASCADE |
| `order_package_id` | INT DEFAULT NULL | FK → `order_package(id)` cuando `scope='line'` |
| `pos_discount_reason_id` | INT DEFAULT NULL | FK → `pos_discount_reason(id)` SET NULL/CASCADE |
| `authorized_by_user_id` | INT DEFAULT NULL | FK → `fayxzvov_alpha.usr_users(idUser)` SET NULL/CASCADE |
| `active` | TINYINT NOT NULL DEFAULT 1 | |

**Regla de integridad (lógica de app):**
- `scope = 'order'` → `order_package_id IS NULL`.
- `scope = 'line'` → `order_package_id NOT NULL`.

---

## 6. Diagrama de relaciones

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  fayxzvov_alpha (cross-schema)                                                │
│  ┌────────────────────┐                          ┌────────────────────┐       │
│  │ subsidiaries       │                          │ usr_users          │       │
│  │ • idSubsidiary PK  │                          │ • idUser PK        │       │
│  │ • name             │                          │ • name             │       │
│  └─────────┬──────────┘                          └─────────┬──────────┘       │
└────────────┼─────────────────────────────────────────────────┼─────────────────┘
             │ subsidiary_id                                  │ user_id
             │                                                │
             ▼                                                ▼
╔════════════════════════════════════════════════════════════════════════════════╗
║  fayxzvov_reginas                                                              ║
║                                                                                ║
║  ┌──────────────────┐         ┌─────────────────────────┐                      ║
║  │ status_process   │◄────────┤ order  (legacy + 2 cols)│                      ║
║  │ • Cotización     │         │ • id            PK      │                      ║
║  │ • Pendiente      │         │ • subtotal              │                      ║
║  │ • Pagado         │         │ • tax                   │                      ║
║  │ • Cancelado      │         │ • total                 │                      ║
║  └──────────────────┘         │ • tip_amount   [NUEVO]  │                      ║
║                               │ • is_pos       [NUEVO]  │                      ║
║  ┌──────────────────┐         │ • status_process_id  FK │                      ║
║  │ order_clients    │◄────────┤ • order_clients_id   FK │                      ║
║  └──────────────────┘         │ • cash_shift_id      FK │                      ║
║                               │ • subsidiary_id      FK ├─→ alpha             ║
║  ┌──────────────────┐         │ • user_id            FK ├─→ alpha             ║
║  │ cash_shift       │◄────────┤ • daily_closure_id   FK │                      ║
║  └────────┬─────────┘         └───┬──────────────────┬──┘                      ║
║           │                       │                  │                         ║
║           │ N                     │ N                │ N                       ║
║           ▼                       ▼                  ▼                         ║
║  ┌──────────────────┐    ┌──────────────────┐  ┌─────────────────────────┐    ║
║  │ shift_payment    │    │ order_package    │  │ order_histories         │    ║
║  │ • method_pay_id  │    │ (líneas de venta │  │ (bitácora unificada)    │    ║
║  └──────────────────┘    │  reusadas)       │  └─────────────────────────┘    ║
║                          │ • product_id   FK│                                  ║
║  ┌──────────────────┐    │ • order_id     FK│   ════════════════════════      ║
║  │ daily_closure    │    └────────┬─────────┘   ║   TABLAS POS-2 NUEVAS  ║    ║
║  └────────┬─────────┘             │             ════════════════════════      ║
║           │ N                     │ 1                                          ║
║           ▼                       │             ┌─────────────────────────┐    ║
║  ┌──────────────────┐             │   N         │ pos_order_payment       │    ║
║  │ closure_payment  │             │  ◄──────────┤ • order_id          FK  │    ║
║  └──────────────────┘             │             │ • pos_payment_type_id   │    ║
║                                   │             │ • user_id  ─→ alpha     │    ║
║  ┌──────────────────┐             │             │ • amount                │    ║
║  │ order_products   │◄────────────┘             │ • tendered_amount       │    ║
║  │ order_category   │                           │ • change_amount         │    ║
║  │ order_modifier   │                           │ • reference             │    ║
║  └──────────────────┘                           │ • authorization_code    │    ║
║                                                 │ • last_four             │    ║
║                                                 │ • paid_at               │    ║
║                                                 └───────────┬─────────────┘    ║
║                                                             │ N                ║
║                                                             ▼                  ║
║                                                 ┌─────────────────────────┐    ║
║                                                 │ pos_payment_type        │    ║
║                                                 │ • EFE / TDC / CORT      │    ║
║                                                 │ • TRF / OTRO            │    ║
║                                                 └─────────────────────────┘    ║
║                                                                                ║
║                                  ┌─────────────────────────┐                   ║
║                              N   │ pos_order_discount      │                   ║
║         order ─────────────────► │ • order_id          FK  │                   ║
║                                  │ • order_package_id  FK  │◄── opcional       ║
║                                  │ • scope ∈ {order,line}  │   (cuando scope=  ║
║                                  │ • amount / percentage   │    'line')        ║
║                                  │ • coupon_code / notes   │                   ║
║                                  │ • applied_at            │                   ║
║                                  │ • authorized_by_user_id │─→ alpha           ║
║                                  └───────────┬─────────────┘                   ║
║                                              │ N                               ║
║                                              ▼                                 ║
║                                  ┌─────────────────────────┐                   ║
║                                  │ pos_discount_reason     │                   ║
║                                  │ • CORTESIA / PROMO      │                   ║
║                                  │ • CLIENTE_FREC          │                   ║
║                                  │ • EMPLEADO / OTRO       │                   ║
║                                  └─────────────────────────┘                   ║
╚════════════════════════════════════════════════════════════════════════════════╝
```

### 6.1 Cardinalidades

| Origen | → | Destino | Cardinalidad |
|---|---|---|---|
| `order` | → | `order_package` | 1 : N |
| `order` | → | `pos_order_payment` | 1 : N (split de pago) |
| `order` | → | `pos_order_discount` | 1 : N |
| `order` | → | `order_histories` | 1 : N |
| `order_package` | → | `pos_order_discount` | 1 : N (cuando `scope='line'`) |
| `pos_order_payment` | → | `pos_payment_type` | N : 1 |
| `pos_order_discount` | → | `pos_discount_reason` | N : 1 |
| `cash_shift` | → | `order` | 1 : N |
| `daily_closure` | → | `order` | 1 : N |

---

## 7. Plan de DDL (Fase 3)

Orden de ejecución (respeta dependencias):

1. **Catálogos nuevos:**
   - `CREATE TABLE pos_payment_type`
   - `CREATE TABLE pos_discount_reason`
2. **ALTER a tabla legacy:**
   - `ALTER TABLE order ADD COLUMN is_pos`, `ADD COLUMN tip_amount`
3. **Detalles nuevos:**
   - `CREATE TABLE pos_order_payment`
   - `CREATE TABLE pos_order_discount`
4. **Seeds:**
   - `INSERT INTO pos_payment_type` (5 filas)
   - `INSERT INTO pos_discount_reason` (5 filas)
5. **Auto-revisión §7 de db-rules.md**

**Entregable:** archivo `db-ddl.sql` ejecutable.

---

## 8. Cumplimiento de db-rules.md

| Regla | Aplicada |
|---|---|
| §1.4 Clases de tabla | `pos_payment_type` / `pos_discount_reason` = catálogos · `pos_order_payment` / `pos_order_discount` = detalles |
| §2.1 Singular, snake_case, inglés | OK |
| §2.2 PK = `id`, FKs = `<tabla>_id` | OK |
| §2.3 Columnas obligatorias | `id`, `active`, `created_at`, `updated_at` en todas |
| §3.1 Orden de columnas | id → negocio → montos → fechas → timestamps → status → FKs → active |
| §4 Tipos canónicos | DOUBLE en montos, VARCHAR en nombres, DATETIME en timestamps, TEXT solo en `notes` |
| §5.1 FK con CONSTRAINT + KEY | Se materializa en Fase 3 |
| §5.2 Política ON DELETE/UPDATE | Detalle→raíz CASCADE/CASCADE · Detalle→catálogo SET NULL/CASCADE · →maestro corp SET NULL/CASCADE |
| §5.3 Cross-schema | `subsidiary_id` y `user_id` apuntan a `fayxzvov_alpha` |
| §6 No `ENUM` | OK (`scope` es VARCHAR(10), promovible a catálogo si crece) |
| §6 No `DELETE` físico | Soft-delete vía `active = 0` |

### Deuda técnica detectada (no se replica)

- Legacy en plural y mezcla inglés/español (`order_clients`, `usr_users`, `subsidiaries`).
- Charset latin1 en legacy → utf8mb4 solo en tablas nuevas; migración del legacy queda como proyecto aparte.
- Eventual unificación de `method_pay` ↔ `pos_payment_type` queda como deuda controlada (hoy conviven).

---

## 9. Estado

✅ **Listo para Fase 3.** Tras confirmar este documento, genero `db-ddl.sql` ejecutable.
