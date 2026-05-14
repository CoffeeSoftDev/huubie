# POS-2 — Modelo de base de datos

> **Esquema:** `fayxzvov_reginas` · **Charset:** `utf8mb4_0900_ai_ci` · **Engine:** `InnoDB`

---

## 1. Tablas REUSADAS (sin tocar)

### 1.1 Cross-schema `fayxzvov_alpha`

| Tabla | Rol |
|---|---|
| `subsidiaries` | UDN / sucursal |
| `usr_users` | Cajero / supervisor |

### 1.2 Mismo esquema `fayxzvov_reginas`

| Tabla | Rol |
|---|---|
| `order` | Raíz de la venta (con flag `is_pos`) |
| `order_package` | Líneas de la venta |
| `order_products` | Catálogo de productos |
| `order_category` | Categorías para grilla |
| `order_modifier` | Modificadores |
| `order_modifier_products` | Pivote producto ↔ modificador |
| `order_clients` | Clientes (compartido pedido / POS) |
| `order_histories` | Bitácora unificada |
| `status_process` | Estados (Cotización, Pendiente, Pagado, Cancelado) |
| `cash_shift` | Turno de caja |
| `shift_payment` | Cobros por método dentro del turno |
| `daily_closure` | Cierre del día |
| `closure_payment` | Cobros por método dentro del cierre |

---

## 2. Diagrama de relaciones

### 2.1 Vista general en zonas

```
                  ┌──────────────────── fayxzvov_alpha (cross-schema) ───────────────────┐
                  │                                                                      │
                  │   ┌────────────────────┐              ┌────────────────────┐         │
                  │   │   subsidiaries     │              │     usr_users      │         │
                  │   │   • idSubsidiary   │              │     • idUser       │         │
                  │   └─────────┬──────────┘              └──────────┬─────────┘         │
                  │             │                                    │                   │
                  └─────────────┼────────────────────────────────────┼───────────────────┘
                                │ subsidiary_id           user_id    │
                                │                                    │
   ╔════════════════════════════╪════════════════════════════════════╪════════════════════════════╗
   ║                            ▼  fayxzvov_reginas                  ▼                            ║
   ║                                                                                              ║
   ║  ┌── LEGACY REUSADO ──────────────┐        ┌── RAÍZ ────┐        ┌── POS-2 [NUEVO] ─────────┐║
   ║  │                                │        │            │        │                          │║
   ║  │  ┌──────────────────┐          │        │            │        │   ┌────────────────────┐ │║
   ║  │  │ status_process   │◄─────────┼──N:1───┤            │        │   │ pos_order_payment  │ │║
   ║  │  └──────────────────┘          │        │            ├──1:N──►│   │ • amount           │ │║
   ║  │                                │        │            │        │   │ • tendered_amount  │ │║
   ║  │  ┌──────────────────┐          │        │            │        │   │ • change_amount    │ │║
   ║  │  │ order_clients    │◄─────────┼──N:1───┤   order    │        │   │ • reference        │ │║
   ║  │  └──────────────────┘          │        │            │        │   │ • paid_at          │ │║
   ║  │                                │        │ +is_pos    │        │   │ • order_id      FK │ │║
   ║  │  ┌──────────────────┐          │        │ +tip_amount│        │   │ • user_id  ─→alpha │ │║
   ║  │  │ cash_shift       │◄─────────┼──N:1───┤            │        │   └──────────┬─────────┘ │║
   ║  │  └──────────────────┘          │        │            │        │              │ N:1       │║
   ║  │                                │        │            │        │              ▼           │║
   ║  │  ┌──────────────────┐          │        │            │        │   ┌────────────────────┐ │║
   ║  │  │ daily_closure    │◄─────────┼──N:1───┤            │        │   │ pos_payment_type   │ │║
   ║  │  └──────────────────┘          │        │            │        │   │ EFE / TDC / CORT   │ │║
   ║  │                                │        │            │        │   │ TRF / OTRO         │ │║
   ║  │  ┌──────────────────┐          │        │            │        │   └────────────────────┘ │║
   ║  │  │ order_histories  │◄─────────┼──1:N───┤            │        │                          │║
   ║  │  └──────────────────┘          │        │            │        │   ┌────────────────────┐ │║
   ║  │                                │        │            ├──1:N──►│   │ pos_order_discount │ │║
   ║  │  ┌──────────────────┐          │        │            │        │   │ • scope            │ │║
   ║  │  │ order_package    │◄─────────┼──1:N───┤            │        │   │   (order | line)   │ │║
   ║  │  │ (líneas de venta)│          │        │            │        │   │ • amount / pct     │ │║
   ║  │  └──────────────────┘          │        └────────────┘        │   │ • coupon_code      │ │║
   ║  │           │                    │                              │   │ • order_id      FK │ │║
   ║  │           │ N:1                │                              │   │ • order_package_id │ │║
   ║  │           ▼                    │                              │   │   (si scope=line)  │ │║
   ║  │  ┌──────────────────┐          │                              │   │ • authorized_by    │ │║
   ║  │  │ order_products   │          │                              │   │   ─→ alpha         │ │║
   ║  │  └──────────────────┘          │                              │   └──────────┬─────────┘ │║
   ║  │                                │                              │              │ N:1       │║
   ║  └────────────┬───────────────────┘                              │              ▼           │║
   ║               │                                                  │   ┌────────────────────┐ │║
   ║               │ (descuento de línea)                             │   │ pos_discount_reason│ │║
   ║               └───────────── 1:N ────────────────────────────────┼──►│ CORTESIA / PROMO   │ │║
   ║                       (cuando scope='line')                      │   │ CLIENTE_FREC       │ │║
   ║                                                                  │   │ EMPLEADO / OTRO    │ │║
   ║                                                                  │   └────────────────────┘ │║
   ║                                                                  └──────────────────────────┘║
   ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
```

### 2.2 Queries típicas (los JOINs en acción)

#### A. Ticket completo con sus líneas, pagos y descuentos

```sql
-- Un ticket POS con todo su detalle.
-- Útil para reimprimir, auditar o mostrar en pantalla de venta.
SELECT
    o.id                          AS ticket_id,
    o.subtotal,
    o.tax,
    o.tip_amount,
    o.total,
    sp.name                       AS status,
    c.name                        AS cliente,
    u.name                        AS cajero
FROM `order` o
JOIN status_process sp                 ON sp.id = o.status_process_id
LEFT JOIN order_clients c              ON c.id  = o.order_clients_id
LEFT JOIN fayxzvov_alpha.usr_users u   ON u.idUser = o.user_id
WHERE o.id = :ticket_id
  AND o.is_pos = 1
  AND o.active = 1;
```

#### B. Pagos del ticket (split de pago)

```sql
-- Lista cada cobro del ticket con su método.
-- Si hay 3 filas → el cliente pagó en 3 partes (split).
SELECT
    pop.id,
    pop.amount,
    pop.tendered_amount,
    pop.change_amount,
    pop.paid_at,
    pt.code                       AS metodo,
    pt.name                       AS metodo_nombre,
    pt.is_cash
FROM pos_order_payment pop
JOIN pos_payment_type pt           ON pt.id = pop.pos_payment_type_id
WHERE pop.order_id = :ticket_id
  AND pop.active = 1
ORDER BY pop.paid_at;
```

#### C. Descuentos aplicados al ticket (línea + ticket completo)

```sql
-- Descuentos sobre el ticket: tanto los de scope='order' como los de scope='line'.
-- order_package_id queda NULL cuando es descuento de ticket completo.
SELECT
    pod.scope,
    pod.amount,
    pod.percentage,
    pod.coupon_code,
    pod.notes,
    dr.code                       AS motivo,
    dr.name                       AS motivo_nombre,
    op.product_id,                 -- NULL si scope='order'
    aut.name                      AS autorizado_por
FROM pos_order_discount pod
JOIN pos_discount_reason dr            ON dr.id  = pod.pos_discount_reason_id
LEFT JOIN order_package op             ON op.id  = pod.order_package_id
LEFT JOIN fayxzvov_alpha.usr_users aut ON aut.idUser = pod.authorized_by_user_id
WHERE pod.order_id = :ticket_id
  AND pod.active = 1;
```

#### D. Reporte de cierre — total cobrado por método de pago en el día

```sql
-- Total cobrado por método en una sucursal y fecha (todas las ventas POS del día).
-- Útil para conciliar con cash_shift / daily_closure.
SELECT
    pt.code                       AS metodo,
    pt.name                       AS metodo_nombre,
    COUNT(*)                      AS num_cobros,
    SUM(pop.amount)               AS total
FROM pos_order_payment pop
JOIN pos_payment_type pt           ON pt.id   = pop.pos_payment_type_id
JOIN `order` o                     ON o.id    = pop.order_id
WHERE o.is_pos = 1
  AND o.subsidiary_id = :sucursal_id
  AND DATE(pop.paid_at) = :fecha
  AND pop.active = 1
GROUP BY pt.code, pt.name
ORDER BY total DESC;
```

#### E. Reporte de auditoría — descuentos por motivo en el turno

```sql
-- Cuántos descuentos y por qué monto se aplicaron en el turno activo.
-- Útil para detectar abuso de 'CORTESIA' o 'EMPLEADO'.
SELECT
    dr.code                       AS motivo,
    COUNT(*)                      AS num_descuentos,
    SUM(pod.amount)               AS total_descontado,
    AVG(pod.percentage)           AS pct_promedio
FROM pos_order_discount pod
JOIN pos_discount_reason dr        ON dr.id = pod.pos_discount_reason_id
JOIN `order` o                     ON o.id  = pod.order_id
WHERE o.cash_shift_id = :turno_id
  AND o.is_pos = 1
  AND pod.active = 1
GROUP BY dr.code
ORDER BY total_descontado DESC;
```

---

## 3. Cardinalidades

| Origen | → | Destino | Cardinalidad |
|---|:-:|---|:-:|
| `order` | → | `order_package` | 1 : N |
| `order` | → | `pos_order_payment` | 1 : N |
| `order` | → | `pos_order_discount` | 1 : N |
| `order` | → | `order_histories` | 1 : N |
| `order` | → | `status_process` | N : 1 |
| `order` | → | `order_clients` | N : 1 |
| `order` | → | `cash_shift` | N : 1 |
| `order` | → | `daily_closure` | N : 1 |
| `order` | → | `subsidiaries` (alpha) | N : 1 |
| `order` | → | `usr_users` (alpha) | N : 1 |
| `order_package` | → | `order_products` | N : 1 |
| `order_package` | → | `pos_order_discount` | 1 : N (cuando `scope='line'`) |
| `pos_order_payment` | → | `pos_payment_type` | N : 1 |
| `pos_order_payment` | → | `usr_users` (alpha) | N : 1 |
| `pos_order_discount` | → | `pos_discount_reason` | N : 1 |
| `pos_order_discount` | → | `usr_users` (alpha) | N : 1 |

---

## 4. Notación del diagrama

- `╔═══╗` doble = esquema actual (`fayxzvov_reginas`)
- `┌───┐` simple = esquema externo cross-schema (`fayxzvov_alpha`)
- `─→ alpha` = FK que apunta fuera del esquema
- `[NUEVO]` = tabla o columna que se crea en esta entrega
- Flechas con cardinalidad (`1:N`, `N:1`) junto a la línea de relación

---

## 5. Tablas NUEVAS (4)

| # | Tabla | Clase | Propósito |
|:-:|---|---|---|
| 1 | `pos_payment_type` | Catálogo | Métodos de pago del POS (EFE, TDC, CORT, TRF, OTRO) |
| 2 | `pos_discount_reason` | Catálogo | Motivos de descuento (CORTESIA, CLIENTE_FREC, PROMO, EMPLEADO, OTRO) |
| 3 | `pos_order_payment` | Detalle | Split de pago con propina, cambio, referencia (cuelga de `order`) |
| 4 | `pos_order_discount` | Detalle | Descuentos por ticket o por línea (cuelga de `order` o de `order_package`) |

---

## 6. Tabla legacy con ALTER (1)

| Tabla | Cambio |
|---|---|
| `order` | `+ is_pos TINYINT NOT NULL DEFAULT 0` · `+ tip_amount DOUBLE NOT NULL DEFAULT 0` |

---

## 7. Definición de columnas por tabla

> Orden canónico Huubie: `id → negocio → montos → fechas operativas → created_at → updated_at → status → FKs → active → KEYs → CONSTRAINTs`.

### 7.0 ALTER `order` (legacy)

| # | Columna | Tipo | Default | Posición | Notas |
|:-:|---|---|---|---|---|
| + | `is_pos` | TINYINT | `0` | `AFTER status_proccess_id` | Flag: `1` = venta POS, `0` = pedido legacy |
| + | `tip_amount` | DOUBLE | `0` | `AFTER total` | Propina del ticket |

### 7.1 `pos_payment_type` (Catálogo)

Métodos de pago del POS. Convive con `method_pay` legacy.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `code` | VARCHAR(10) | NO | — | UNIQUE: `EFE`, `TDC`, `CORT`, `TRF`, `OTRO` |
| 3 | `name` | VARCHAR(60) | NO | — | Nombre legible |
| 4 | `is_cash` | TINYINT(1) | NO | `0` | Suma a "efectivo en caja" |
| 5 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 6 | `updated_at` | DATETIME | NO | `CURRENT_TIMESTAMP ON UPDATE` | |
| 7 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Índices:** `UNIQUE KEY uk_pos_payment_type_code (code)`
**Seed:** 5 filas (EFE, TDC, CORT, TRF, OTRO)

### 7.2 `pos_discount_reason` (Catálogo)

Motivos de descuento con tope y autorización.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `code` | VARCHAR(20) | NO | — | UNIQUE: `CORTESIA`, `CLIENTE_FREC`, `PROMO`, `EMPLEADO`, `OTRO` |
| 3 | `name` | VARCHAR(80) | NO | — | Nombre legible |
| 4 | `requires_authorization` | TINYINT(1) | NO | `0` | Necesita supervisor |
| 5 | `max_percentage` | DOUBLE | NO | `100` | Tope sin autorización |
| 6 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 7 | `updated_at` | DATETIME | NO | `CURRENT_TIMESTAMP ON UPDATE` | |
| 8 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Índices:** `UNIQUE KEY uk_pos_discount_reason_code (code)`
**Seed:** 5 filas (CORTESIA, CLIENTE_FREC, PROMO, EMPLEADO, OTRO)

### 7.3 `pos_order_payment` (Detalle de `order`)

Split de pago del ticket POS. Sin prefijo `detail_` porque `pos_` ya identifica el dominio.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `amount` | DOUBLE | NO | `0` | Monto aplicado a la venta |
| 3 | `tendered_amount` | DOUBLE | NO | `0` | Lo que entregó el cliente |
| 4 | `change_amount` | DOUBLE | NO | `0` | Cambio devuelto |
| 5 | `paid_at` | DATETIME | NO | — | Momento real del cobro |
| 6 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 7 | `updated_at` | DATETIME | NO | `CURRENT_TIMESTAMP ON UPDATE` | |
| 8 | `order_id` | INT UNSIGNED | NO | — | FK → `order(id)` · CASCADE/CASCADE |
| 9 | `pos_payment_type_id` | INT UNSIGNED | SÍ | NULL | FK → `pos_payment_type(id)` · SET NULL/CASCADE |
| 10 | `user_id` | INT UNSIGNED | SÍ | NULL | FK → `fayxzvov_alpha.usr_users(idUser)` · SET NULL/CASCADE |
| 11 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**KEYs:** `KEY (order_id)`, `KEY (pos_payment_type_id)`, `KEY (user_id)`, `KEY (paid_at)`

### 7.4 `pos_order_discount` (Detalle de `order` o `order_package`)

Descuentos a nivel ticket (`scope='order'`) o a nivel línea (`scope='line'`).

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `scope` | VARCHAR(10) | NO | `'order'` | `'order'` o `'line'` (promovible a catálogo si crece) |
| 3 | `coupon_code` | VARCHAR(50) | SÍ | NULL | Cupón aplicado |
| 4 | `notes` | TEXT | SÍ | NULL | Justificación libre |
| 5 | `amount` | DOUBLE | NO | `0` | Monto descontado |
| 6 | `percentage` | DOUBLE | NO | `0` | Porcentaje aplicado |
| 7 | `applied_at` | DATETIME | NO | — | Momento real de aplicación |
| 8 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 9 | `updated_at` | DATETIME | NO | `CURRENT_TIMESTAMP ON UPDATE` | |
| 10 | `order_id` | INT UNSIGNED | NO | — | FK → `order(id)` · CASCADE/CASCADE |
| 11 | `order_package_id` | INT UNSIGNED | SÍ | NULL | FK → `order_package(id)` · solo si `scope='line'` |
| 12 | `pos_discount_reason_id` | INT UNSIGNED | SÍ | NULL | FK → `pos_discount_reason(id)` · SET NULL/CASCADE |
| 13 | `authorized_by_user_id` | INT UNSIGNED | SÍ | NULL | FK → `fayxzvov_alpha.usr_users(idUser)` · SET NULL/CASCADE |
| 14 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**KEYs:** `KEY (order_id)`, `KEY (order_package_id)`, `KEY (pos_discount_reason_id)`, `KEY (authorized_by_user_id)`, `KEY (applied_at)`
**Regla aplicación:** `scope='order' ⇒ order_package_id IS NULL` · `scope='line' ⇒ order_package_id NOT NULL`

### 7.5 Orden de ejecución DDL

| # | Acción | Tabla | Tipo |
|:-:|---|---|---|
| 1 | CREATE | `pos_payment_type` | Catálogo |
| 2 | CREATE | `pos_discount_reason` | Catálogo |
| 3 | ALTER | `order` | +2 columnas |
| 4 | CREATE | `pos_order_payment` | Detalle (depende de 1) |
| 5 | CREATE | `pos_order_discount` | Detalle (depende de 2) |
| 6 | INSERT seed | `pos_payment_type` | 5 filas |
| 7 | INSERT seed | `pos_discount_reason` | 5 filas |

---

## 8. Ejemplos de inserción

> Cada ejemplo muestra el flujo completo: crear el `order` (raíz), sus líneas en `order_package`, y los registros de pago/descuento que aplican.
> Se asume que los catálogos `pos_payment_type` y `pos_discount_reason` ya tienen su seed.

### 8.1 Ejemplo 1 — Venta simple en efectivo (sin descuentos, sin propina)

> Cliente compra 2 cafés ($45 c/u) y paga con un billete de $100. Cambio de $10.
> Total: subtotal $90 + IVA $0 = **$90** (paga con $100, recibe $10 de cambio).

```sql
-- 1. Cabecera de la venta (order)
INSERT INTO `order` (
    folio, subtotal, tax, total, tip_amount,
    is_pos, status_proccess_id, order_clients_id,
    cash_shift_id, subsidiary_id, user_id,
    created_at, updated_at, active
) VALUES (
    'POS-000123', 90.00, 0.00, 90.00, 0.00,
    1, 3, NULL,
    15, 1, 7,
    NOW(), NOW(), 1
);
SET @order_id = LAST_INSERT_ID();

-- 2. Líneas de la venta (order_package)
INSERT INTO order_package (order_id, product_id, quantity, unit_price, subtotal, created_at, active)
VALUES
    (@order_id, 12, 2, 45.00, 90.00, NOW(), 1);

-- 3. Pago en efectivo (un solo registro)
INSERT INTO pos_order_payment (
    amount, tendered_amount, change_amount,
    paid_at, created_at, updated_at,
    order_id, pos_payment_type_id, user_id,
    active
) VALUES (
    90.00, 100.00, 10.00,
    NOW(), NOW(), NOW(),
    @order_id,
    (SELECT id FROM pos_payment_type WHERE code = 'EFE'),
    7,
    1
);
```

---

### 8.2 Ejemplo 2 — Split de pago (efectivo + tarjeta) con propina

> Cliente consume $480 + $20 de propina = $500.
> Paga $200 en efectivo y $300 con tarjeta de crédito (autorización 485920, terminada en 1234).

```sql
-- 1. Cabecera
INSERT INTO `order` (
    folio, subtotal, tax, total, tip_amount,
    is_pos, status_proccess_id, order_clients_id,
    cash_shift_id, subsidiary_id, user_id,
    created_at, updated_at, active
) VALUES (
    'POS-000124', 480.00, 0.00, 480.00, 20.00,
    1, 3, NULL,
    15, 1, 7,
    NOW(), NOW(), 1
);
SET @order_id = LAST_INSERT_ID();

-- 2. Líneas
INSERT INTO order_package (order_id, product_id, quantity, unit_price, subtotal, created_at, active)
VALUES
    (@order_id, 25, 1, 280.00, 280.00, NOW(), 1),
    (@order_id, 41, 2, 100.00, 200.00, NOW(), 1);

-- 3. Pago A — efectivo $200 (cliente entregó exacto)
INSERT INTO pos_order_payment (
    amount, tendered_amount, change_amount,
    paid_at, created_at, updated_at,
    order_id, pos_payment_type_id, user_id,
    active
) VALUES (
    200.00, 200.00, 0.00,
    NOW(), NOW(), NOW(),
    @order_id,
    (SELECT id FROM pos_payment_type WHERE code = 'EFE'),
    7,
    1
);

-- 4. Pago B — tarjeta $300
INSERT INTO pos_order_payment (
    amount, tendered_amount, change_amount,
    paid_at, created_at, updated_at,
    order_id, pos_payment_type_id, user_id,
    active
) VALUES (
    300.00, 300.00, 0.00,
    NOW(), NOW(), NOW(),
    @order_id,
    (SELECT id FROM pos_payment_type WHERE code = 'TDC'),
    7,
    1
);
```

---

### 8.3 Ejemplo 3 — Venta con descuento de línea + cortesía autorizada por supervisor

> Cliente pide 3 productos. Se aplica:
> - 15% de descuento (CLIENTE_FREC) al producto más caro — **scope='line'**.
> - $50 de cortesía sobre el total — **scope='order'**, autorizada por supervisor (user 9).
> - Pago final en transferencia con folio SPEI.

```sql
-- 1. Cabecera
-- Subtotal bruto: $250 + $180 + $80 = $510
-- Desc línea (15% de $250): -$37.50
-- Desc ticket (cortesía): -$50.00
-- Total: $422.50
INSERT INTO `order` (
    folio, subtotal, tax, total, tip_amount,
    is_pos, status_proccess_id, order_clients_id,
    cash_shift_id, subsidiary_id, user_id,
    created_at, updated_at, active
) VALUES (
    'POS-000125', 510.00, 0.00, 422.50, 0.00,
    1, 3, 88,
    15, 1, 7,
    NOW(), NOW(), 1
);
SET @order_id = LAST_INSERT_ID();

-- 2. Líneas
INSERT INTO order_package (order_id, product_id, quantity, unit_price, subtotal, created_at, active)
VALUES
    (@order_id, 30, 1, 250.00, 250.00, NOW(), 1),
    (@order_id, 31, 1, 180.00, 180.00, NOW(), 1),
    (@order_id, 32, 1,  80.00,  80.00, NOW(), 1);

-- Capturamos el id del primer renglón (producto 30, el caro) para el descuento de línea
SET @line_id = (
    SELECT id FROM order_package
    WHERE order_id = @order_id AND product_id = 30
    LIMIT 1
);

-- 3. Descuento A — sobre la línea cara (15%, no requiere autorización)
INSERT INTO pos_order_discount (
    scope, coupon_code, notes,
    amount, percentage,
    applied_at, created_at, updated_at,
    order_id, order_package_id, pos_discount_reason_id, authorized_by_user_id,
    active
) VALUES (
    'line', NULL, 'Descuento cliente frecuente sobre producto principal',
    37.50, 15.00,
    NOW(), NOW(), NOW(),
    @order_id,
    @line_id,
    (SELECT id FROM pos_discount_reason WHERE code = 'CLIENTE_FREC'),
    NULL,
    1
);

-- 4. Descuento B — cortesía sobre el ticket (requiere supervisor)
INSERT INTO pos_order_discount (
    scope, coupon_code, notes,
    amount, percentage,
    applied_at, created_at, updated_at,
    order_id, order_package_id, pos_discount_reason_id, authorized_by_user_id,
    active
) VALUES (
    'order', NULL, 'Cortesía de la casa por demora en cocina',
    50.00, 0.00,
    NOW(), NOW(), NOW(),
    @order_id,
    NULL,
    (SELECT id FROM pos_discount_reason WHERE code = 'CORTESIA'),
    9,
    1
);

-- 5. Pago — transferencia SPEI por el total final
INSERT INTO pos_order_payment (
    amount, tendered_amount, change_amount,
    paid_at, created_at, updated_at,
    order_id, pos_payment_type_id, user_id,
    active
) VALUES (
    422.50, 422.50, 0.00,
    NOW(), NOW(), NOW(),
    @order_id,
    (SELECT id FROM pos_payment_type WHERE code = 'TRF'),
    7,
    1
);
```

---

### 8.4 Reglas implícitas en los ejemplos

| Patrón | Regla aplicada |
|---|---|
| Catálogos por `code` | Siempre se resuelve con `SELECT id FROM <catalogo> WHERE code = '…'` — nunca hard-codear el `id`. |
| `is_pos = 1` | Discrimina la venta POS del pedido legacy. |
| `tip_amount` | Se guarda en la raíz `order`, no en el pago. La suma de pagos debe ser `total + tip_amount`. |
| `scope = 'line'` | Obliga a tener `order_package_id NOT NULL`. |
| `scope = 'order'` | Obliga a tener `order_package_id NULL`. |
| Autorización | `authorized_by_user_id` se llena solo si el motivo `requires_authorization = 1`. |

---

## 9. Features opcionales / extensiones

> Funcionalidades que **no forman parte del core POS-2 v1** pero se documentan aquí para que cuando se decida activarlas, ya exista el modelo aprobado. Cada feature lista su impacto de schema, su definición de columnas y un ejemplo de uso.

### 9.1 Paquetes / Combos

> Permite agrupar varios productos del catálogo bajo un "combo" vendible con precio fijo. Al venderlo se inserta una sola línea cobrable + N líneas hijas que sirven para cocina/inventario.

#### 9.1.1 Cambios al schema

| Acción | Tabla | Tipo |
|---|---|---|
| ALTER | `order_products` | `+ is_combo TINYINT NOT NULL DEFAULT 0` |
| CREATE | `order_product_combo` | Pivote N:M (combo padre ↔ componentes) |
| ALTER | `order_package` | `+ combo_id INT UNSIGNED NULL` (self-reference a la línea cabecera) |

#### 9.1.2 ALTER `order_products` (legacy)

| # | Columna | Tipo | Default | Posición | Notas |
|:-:|---|---|---|---|---|
| + | `is_combo` | TINYINT(1) | `0` | `AFTER <ultima_col_negocio>` | `1` = es combo (sus componentes viven en `order_product_combo`) |

#### 9.1.3 `order_product_combo` (Pivote N:M)

Define qué productos componen cada combo del catálogo.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `quantity` | DOUBLE | NO | `1` | Cuántas unidades del componente trae el combo |
| 3 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 4 | `updated_at` | DATETIME | NO | `CURRENT_TIMESTAMP ON UPDATE` | |
| 5 | `combo_product_id` | INT UNSIGNED | NO | — | FK → `order_products(id)` · combo padre · CASCADE/CASCADE |
| 6 | `component_product_id` | INT UNSIGNED | NO | — | FK → `order_products(id)` · componente · RESTRICT/CASCADE |
| 7 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Índices:** `UNIQUE KEY uk_combo_component (combo_product_id, component_product_id)` (un componente no se duplica en el mismo combo)
**KEYs:** `KEY (combo_product_id)`, `KEY (component_product_id)`

#### 9.1.4 ALTER `order_package` (legacy)

| # | Columna | Tipo | Default | Notas |
|:-:|---|---|---|---|
| + | `combo_id` | INT UNSIGNED NULL | `NULL` | FK → `order_package(id)` · SET NULL/CASCADE · Self-reference. `NULL` en líneas normales y en la cabecera del combo. Solo se llena en líneas hijas. |

**KEY agregada:** `KEY (combo_id)`

#### 9.1.5 Semántica de lectura de un ticket

| Combinación | Significado |
|---|---|
| `is_combo = 1 AND combo_id IS NULL` | Cabecera del combo (la línea que cobra el precio fijo) |
| `combo_id IS NOT NULL` | Componente del combo (precio $0, sirve para cocina/inventario) |
| `is_combo = 0 AND combo_id IS NULL` | Producto suelto normal |

#### 9.1.6 Ejemplo de inserción — vender 1 "Combo Familiar" ($299)

> Combo contiene: 1 Pizza Grande + 1 Refresco 2L + 1 Papas Familia.

```sql
-- 1. Cabecera del ticket
INSERT INTO `order` (
    folio, subtotal, tax, total, tip_amount,
    is_pos, status_proccess_id,
    cash_shift_id, subsidiary_id, user_id,
    created_at, updated_at, active
) VALUES (
    'POS-000126', 299.00, 0.00, 299.00, 0.00,
    1, 3,
    15, 1, 7,
    NOW(), NOW(), 1
);
SET @order_id = LAST_INSERT_ID();

-- 2. Línea CABECERA del combo (la que cobra)
INSERT INTO order_package (
    order_id, product_id, quantity, unit_price, subtotal,
    combo_id, created_at, active
) VALUES (
    @order_id, 100, 1, 299.00, 299.00,
    NULL, NOW(), 1
);
SET @combo_line = LAST_INSERT_ID();

-- 3. Líneas HIJAS — apuntan a la cabecera vía combo_id
INSERT INTO order_package (
    order_id, product_id, quantity, unit_price, subtotal,
    combo_id, created_at, active
) VALUES
    (@order_id, 30, 1, 0.00, 0.00, @combo_line, NOW(), 1),  -- Pizza Grande
    (@order_id, 41, 1, 0.00, 0.00, @combo_line, NOW(), 1),  -- Refresco 2L
    (@order_id, 55, 1, 0.00, 0.00, @combo_line, NOW(), 1);  -- Papas Familia

-- 4. Pago normal
INSERT INTO pos_order_payment (
    amount, tendered_amount, change_amount,
    paid_at, created_at, updated_at,
    order_id, pos_payment_type_id, user_id,
    active
) VALUES (
    299.00, 300.00, 1.00,
    NOW(), NOW(), NOW(),
    @order_id,
    (SELECT id FROM pos_payment_type WHERE code = 'EFE'),
    7,
    1
);
```

#### 9.1.7 Query útil — expandir un combo a sus componentes en cocina

```sql
-- Lo que la cocina/almacen debe preparar de este ticket
-- (cabeceras de combo se ignoran, se reemplazan por sus hijos)
SELECT
    op.id            AS line_id,
    p.name           AS producto,
    op.quantity,
    op.combo_id,
    CASE
        WHEN op.combo_id IS NOT NULL THEN 'componente'
        WHEN p.is_combo = 1          THEN 'combo (cabecera, no preparar)'
        ELSE 'suelto'
    END              AS tipo_linea
FROM order_package op
JOIN order_products p ON p.id = op.product_id
WHERE op.order_id = :ticket_id
  AND op.active = 1
  AND NOT (p.is_combo = 1 AND op.combo_id IS NULL)  -- excluye cabeceras
ORDER BY op.id;
```

#### 9.1.8 Notas de implementación

- El descuento `pos_order_discount scope='line'` sigue funcionando sobre la **cabecera** del combo (no sobre componentes — sus precios son $0).
- Si un combo se cancela, el `ON DELETE SET NULL` de `combo_id` deja a los hijos huérfanos pero rastreables; la app debe limpiarlos o cancelarlos en cascada lógica.
- Modelo soporta tanto **combos fijos del menú** (los más comunes) como **combos armables por el cliente** (mismo schema, la diferencia es de UX no de BD).
