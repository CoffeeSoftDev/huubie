# POS-2 — Modelo de base de datos

> **Esquema:** `fayxzvov_reginas` · **Charset:** `utf8mb4_0900_ai_ci` · **Engine:** `InnoDB`

---

## 1. Tablas NUEVAS (4)

| # | Tabla | Clase | Propósito |
|:-:|---|---|---|
| 1 | `pos_payment_type` | Catálogo | Métodos de pago del POS (EFE, TDC, CORT, TRF, OTRO) |
| 2 | `pos_discount_reason` | Catálogo | Motivos de descuento (CORTESIA, CLIENTE_FREC, PROMO, EMPLEADO, OTRO) |
| 3 | `pos_order_payment` | Detalle | Split de pago con propina, cambio, referencia (cuelga de `order`) |
| 4 | `pos_order_discount` | Detalle | Descuentos por ticket o por línea (cuelga de `order` o de `order_package`) |

---

## 2. Tabla legacy con ALTER (1)

| Tabla | Cambio |
|---|---|
| `order` | `+ is_pos TINYINT NOT NULL DEFAULT 0` · `+ tip_amount DOUBLE NOT NULL DEFAULT 0` |

---

## 3. Tablas REUSADAS (sin tocar)

### 3.1 Cross-schema `fayxzvov_alpha`

| Tabla | Rol |
|---|---|
| `subsidiaries` | UDN / sucursal |
| `usr_users` | Cajero / supervisor |

### 3.2 Mismo esquema `fayxzvov_reginas`

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

## 4. Diagrama de relaciones

### 4.1 Vista general en zonas

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

### 4.2 Queries típicas (los JOINs en acción)

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
    pop.reference,
    pop.authorization_code,
    pop.last_four,
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

## 5. Cardinalidades

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

## 6. Notación del diagrama

- `╔═══╗` doble = esquema actual (`fayxzvov_reginas`)
- `┌───┐` simple = esquema externo cross-schema (`fayxzvov_alpha`)
- `─→ alpha` = FK que apunta fuera del esquema
- `[NUEVO]` = tabla o columna que se crea en esta entrega
- Flechas con cardinalidad (`1:N`, `N:1`) junto a la línea de relación
