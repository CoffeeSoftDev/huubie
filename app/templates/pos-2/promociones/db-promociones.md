# POS-2 — Modelo BD para Promociones "Buy X, Get Y Free" (BXGY / 3x2)

> **Esquema:** `fayxzvov_reginas` · **Charset:** `utf8mb4_0900_ai_ci` · **Engine:** `InnoDB`
> **Modulo:** Extension del POS-2 que coexiste con `pos_order_discount`. Cuando una promocion BXGY se aplica a un ticket, **se materializa como una fila en `pos_order_discount` con `scope='line'`** apuntando a la linea regalada, conservando trazabilidad en el motor existente.

---

## 1. Filosofia del diseno

Las promociones BXGY se modelan como **una definicion separada** del `pos_order_discount` (que sigue siendo el deposito final del descuento sobre la venta). El motor del POS resuelve en tiempo de cobro:

```
[productos en carrito] → match con pos_promotion → calcular sets de X → seleccionar Y mas baratos → INSERT pos_order_discount (scope='line', promotion_id, percentage=100)
```

| Tabla nueva | Rol |
|---|---|
| `pos_promotion` | Definicion (cabecera) de la promocion: tipo, X, Y, vigencia |
| `pos_promotion_product` | Productos elegibles (pivote) |
| `pos_promotion_category` | Categorias elegibles (alternativa al pivote anterior) |
| `pos_promotion_constraint` | Limites de uso (por usuario, por orden, por sucursal) |
| `pos_promotion_application` | Bitacora de aplicaciones (auditoria) |

| Tabla legacy con ALTER |
|---|
| `pos_order_discount` · `+ pos_promotion_id` (FK opcional — solo si vino de promo automatica) |

---

## 2. Diagrama de relaciones

```
   ╔════════════════════════ fayxzvov_reginas ═════════════════════════════════════╗
   ║                                                                                ║
   ║   ┌── PROMOCIONES [NUEVO] ─────────────────────────────────────────────────┐   ║
   ║   │                                                                         │   ║
   ║   │   ┌────────────────────────┐                                            │   ║
   ║   │   │   pos_promotion        │◄────────────┐                              │   ║
   ║   │   │   • name               │             │                              │   ║
   ║   │   │   • type (BXGY/PCT)    │             │ N:1                          │   ║
   ║   │   │   • buy_quantity (X)   │             │                              │   ║
   ║   │   │   • pay_quantity (Y)   │   ┌─────────┴──────────────┐               │   ║
   ║   │   │   • start_date         │   │ pos_promotion_product  │               │   ║
   ║   │   │   • end_date           │   │ • promotion_id      FK │               │   ║
   ║   │   │   • is_active          │   │ • product_id        FK │               │   ║
   ║   │   │   • subsidiary_id   FK │   └────────────────────────┘               │   ║
   ║   │   └──────┬────────┬─────┬──┘                                            │   ║
   ║   │          │ 1:N    │ 1:N │ 1:N                                           │   ║
   ║   │          ▼        ▼     ▼                                               │   ║
   ║   │   ┌──────────┐ ┌──────────┐ ┌─────────────────────────┐                 │   ║
   ║   │   │ pos_pro- │ │ pos_pro- │ │ pos_promotion_          │                 │   ║
   ║   │   │ motion_  │ │ motion_  │ │ application             │                 │   ║
   ║   │   │ category │ │ constra- │ │ • promotion_id       FK │                 │   ║
   ║   │   │          │ │ int      │ │ • order_id           FK │                 │   ║
   ║   │   └──────────┘ └──────────┘ │ • order_package_id   FK │                 │   ║
   ║   │                             │ • amount_saved          │                 │   ║
   ║   │                             │ • applied_at            │                 │   ║
   ║   │                             └────────┬────────────────┘                 │   ║
   ║   │                                      │ N:1                              │   ║
   ║   │                                      ▼                                  │   ║
   ║   └──────────────────────────────────────┼──────────────────────────────────┘   ║
   ║                                          │                                      ║
   ║   ┌── POS-2 (existente) ─────────────────┼──────────────────────────────────┐   ║
   ║   │                                      ▼                                  │   ║
   ║   │   ┌────────────────────┐    ┌──────────────────────┐                    │   ║
   ║   │   │     order          │◄───┤  pos_order_discount  │                    │   ║
   ║   │   │                    │    │  + pos_promotion_id  │                    │   ║
   ║   │   └────────────────────┘    │    (FK opcional)     │                    │   ║
   ║   │                             └──────────────────────┘                    │   ║
   ║   └─────────────────────────────────────────────────────────────────────────┘   ║
   ║                                                                                ║
   ╚════════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Cardinalidades

| Origen | → | Destino | Cardinalidad |
|---|:-:|---|:-:|
| `pos_promotion` | → | `pos_promotion_product` | 1 : N |
| `pos_promotion` | → | `pos_promotion_category` | 1 : N |
| `pos_promotion` | → | `pos_promotion_constraint` | 1 : N |
| `pos_promotion` | → | `pos_promotion_application` | 1 : N |
| `pos_promotion` | → | `subsidiaries` (alpha, opcional) | N : 1 |
| `pos_promotion_application` | → | `order` | N : 1 |
| `pos_promotion_application` | → | `order_package` | N : 1 |
| `pos_order_discount` | → | `pos_promotion` | N : 1 (FK opcional) |

---

## 4. Definicion de columnas

> Orden canonico Huubie: `id → negocio → montos → fechas operativas → created_at → updated_at → status → FKs → active`.

### 4.1 `pos_promotion` (Cabecera)

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `code` | VARCHAR(40) | NO | — | UNIQUE: identificador legible (`PROMO_3X2_LATTE`, `BXGY_PASTRY_2X1`) |
| 3 | `name` | VARCHAR(120) | NO | — | Nombre comercial visible |
| 4 | `description` | TEXT | SI | NULL | Texto largo de promo |
| 5 | `type` | VARCHAR(20) | NO | `'BXGY'` | `BXGY` / `PERCENTAGE` / `FIXED` (extensible) |
| 6 | `buy_quantity` | INT UNSIGNED | NO | `0` | X — productos que el cliente debe llevar |
| 7 | `pay_quantity` | INT UNSIGNED | NO | `0` | Y — productos que paga (X-Y = gratis) |
| 8 | `eligible_mode` | VARCHAR(10) | NO | `'PRODUCT'` | `PRODUCT` / `CATEGORY` / `MIX` |
| 9 | `discount_target` | VARCHAR(10) | NO | `'CHEAPEST'` | Que producto regala: `CHEAPEST` / `MOST_EXP` / `LAST_ADDED` |
| 10 | `priority` | INT | NO | `100` | Resuelve conflictos cuando varias promos aplican (menor = primero) |
| 11 | `start_date` | DATE | NO | — | Vigencia desde |
| 12 | `end_date` | DATE | SI | NULL | Vigencia hasta (NULL = indefinida) |
| 13 | `start_time` | TIME | SI | NULL | Solo aplica en franja horaria |
| 14 | `end_time` | TIME | SI | NULL | Solo aplica en franja horaria |
| 15 | `weekdays` | VARCHAR(20) | SI | NULL | CSV: `1,2,3,4,5` (lun-vie). NULL = todos los dias |
| 16 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 17 | `updated_at` | DATETIME | NO | `CURRENT_TIMESTAMP ON UPDATE` | |
| 18 | `subsidiary_id` | INT UNSIGNED | SI | NULL | FK → `fayxzvov_alpha.subsidiaries(idSubsidiary)`. NULL = todas las sucursales |
| 19 | `created_by_user_id` | INT UNSIGNED | SI | NULL | FK → `fayxzvov_alpha.usr_users(idUser)` · SET NULL/CASCADE |
| 20 | `is_active` | TINYINT(1) | NO | `1` | Activa/Pausada manualmente |
| 21 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Indices:** `UNIQUE KEY uk_pos_promotion_code (code)`, `KEY (subsidiary_id)`, `KEY (start_date, end_date)`, `KEY (is_active, active)`
**Regla:** Para `type='BXGY'` debe cumplirse `buy_quantity > pay_quantity AND pay_quantity >= 0`. Ej: 3x2 → buy=3, pay=2.

---

### 4.2 `pos_promotion_product` (Pivote N:M)

Productos individuales elegibles para la promocion.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 3 | `pos_promotion_id` | INT UNSIGNED | NO | — | FK → `pos_promotion(id)` · CASCADE/CASCADE |
| 4 | `product_id` | INT UNSIGNED | NO | — | FK → `order_products(id)` · RESTRICT/CASCADE |
| 5 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Indices:** `UNIQUE KEY uk_promo_product (pos_promotion_id, product_id)`

---

### 4.3 `pos_promotion_category` (Pivote N:M)

Categorias elegibles. Alternativa o complemento a `pos_promotion_product`.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 3 | `pos_promotion_id` | INT UNSIGNED | NO | — | FK → `pos_promotion(id)` · CASCADE/CASCADE |
| 4 | `order_category_id` | INT UNSIGNED | NO | — | FK → `order_category(id)` · RESTRICT/CASCADE |
| 5 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Indices:** `UNIQUE KEY uk_promo_category (pos_promotion_id, order_category_id)`

---

### 4.4 `pos_promotion_constraint` (1:N)

Restricciones de uso. Una promo puede tener varios constraints simultaneos.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `constraint_type` | VARCHAR(30) | NO | — | `MAX_USES_PER_ORDER` / `MAX_USES_PER_USER_DAY` / `MIN_TICKET_AMOUNT` / `MAX_USES_TOTAL` / `REQUIRES_CLIENT` |
| 3 | `value` | DOUBLE | NO | `0` | Valor del limite (cantidad o monto) |
| 4 | `notes` | VARCHAR(120) | SI | NULL | Descripcion humana |
| 5 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 6 | `pos_promotion_id` | INT UNSIGNED | NO | — | FK → `pos_promotion(id)` · CASCADE/CASCADE |
| 7 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Indices:** `KEY (pos_promotion_id)`, `KEY (constraint_type)`

---

### 4.5 `pos_promotion_application` (Bitacora)

Cada vez que el motor aplica la promocion sobre un ticket, registra aqui. Sirve para auditoria, reportes y limites por usuario.

| # | Columna | Tipo | Null | Default | Notas |
|:-:|---|---|:-:|---|---|
| 1 | `id` | INT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| 2 | `sets_applied` | INT UNSIGNED | NO | `1` | Cuantos sets de X se aplicaron en este ticket |
| 3 | `items_free` | INT UNSIGNED | NO | `0` | Cuantos productos resultaron gratis |
| 4 | `amount_saved` | DOUBLE | NO | `0` | Total ahorrado por el cliente |
| 5 | `applied_at` | DATETIME | NO | — | Momento de aplicacion |
| 6 | `created_at` | DATETIME | NO | `CURRENT_TIMESTAMP` | |
| 7 | `pos_promotion_id` | INT UNSIGNED | NO | — | FK → `pos_promotion(id)` · RESTRICT/CASCADE |
| 8 | `order_id` | INT UNSIGNED | NO | — | FK → `order(id)` · CASCADE/CASCADE |
| 9 | `order_package_id` | INT UNSIGNED | SI | NULL | FK → `order_package(id)` · linea regalada |
| 10 | `user_id` | INT UNSIGNED | SI | NULL | FK → `fayxzvov_alpha.usr_users(idUser)` · cajero que cobro |
| 11 | `order_clients_id` | INT UNSIGNED | SI | NULL | FK → `order_clients(id)` · cliente (para limites por usuario) |
| 12 | `active` | TINYINT(1) | NO | `1` | Soft-delete |

**Indices:** `KEY (pos_promotion_id)`, `KEY (order_id)`, `KEY (applied_at)`, `KEY (order_clients_id, applied_at)`

---

### 4.6 ALTER `pos_order_discount` (legacy)

| # | Columna | Tipo | Default | Posicion | Notas |
|:-:|---|---|---|---|---|
| + | `pos_promotion_id` | INT UNSIGNED NULL | `NULL` | `AFTER pos_discount_reason_id` | FK → `pos_promotion(id)` · SET NULL/CASCADE · Solo se llena si el descuento vino de una promo automatica. Si lo aplico un cajero a mano queda NULL. |

**KEY agregada:** `KEY (pos_promotion_id)`

---

## 5. Orden de ejecucion DDL

| # | Accion | Tabla |
|:-:|---|---|
| 1 | CREATE | `pos_promotion` |
| 2 | CREATE | `pos_promotion_product` |
| 3 | CREATE | `pos_promotion_category` |
| 4 | CREATE | `pos_promotion_constraint` |
| 5 | ALTER | `pos_order_discount` (+ pos_promotion_id) |
| 6 | CREATE | `pos_promotion_application` |

---

## 6. Ejemplo de insercion — "3x2 en cafe del dia, lun-vie 7am-11am, max 2 sets por orden"

```sql
-- 1. Cabecera de la promocion
INSERT INTO pos_promotion (
    code, name, description,
    type, buy_quantity, pay_quantity,
    eligible_mode, discount_target, priority,
    start_date, end_date, start_time, end_time, weekdays,
    subsidiary_id, created_by_user_id,
    is_active, active
) VALUES (
    'PROMO_3X2_CAFE_MAT',
    '3x2 en cafe matutino',
    'Llevate 3 cafes y paga solo 2 — el mas barato es gratis. Valido lun-vie de 7 a 11 am.',
    'BXGY', 3, 2,
    'PRODUCT', 'CHEAPEST', 100,
    '2026-05-01', '2026-08-31', '07:00:00', '11:00:00', '1,2,3,4,5',
    1, 7,
    1, 1
);
SET @promo_id = LAST_INSERT_ID();

-- 2. Productos elegibles
INSERT INTO pos_promotion_product (pos_promotion_id, product_id, created_at, active) VALUES
    (@promo_id, 12, NOW(), 1),  -- Latte
    (@promo_id, 13, NOW(), 1),  -- Cappuccino
    (@promo_id, 14, NOW(), 1);  -- Americano

-- 3. Restriccion: max 2 sets por orden
INSERT INTO pos_promotion_constraint (
    constraint_type, value, notes,
    pos_promotion_id, created_at, active
) VALUES (
    'MAX_USES_PER_ORDER', 2, 'Maximo 2 sets de 3 por ticket',
    @promo_id, NOW(), 1
);

-- 4. (En tiempo de cobro) — ticket aplica la promo
-- El motor inserta 2 registros: el descuento concreto y la bitacora.
SET @order_id = 1043;          -- ticket POS recien creado
SET @line_free = 9871;         -- linea del Americano de $45 (el mas barato del set)

INSERT INTO pos_order_discount (
    scope, notes,
    amount, percentage,
    applied_at, created_at, updated_at,
    order_id, order_package_id,
    pos_discount_reason_id, pos_promotion_id,
    authorized_by_user_id,
    active
) VALUES (
    'line', 'Auto: PROMO_3X2_CAFE_MAT — Americano gratis del set',
    45.00, 100.00,
    NOW(), NOW(), NOW(),
    @order_id, @line_free,
    (SELECT id FROM pos_discount_reason WHERE code = 'PROMO'),
    @promo_id,
    NULL,
    1
);

INSERT INTO pos_promotion_application (
    sets_applied, items_free, amount_saved, applied_at, created_at,
    pos_promotion_id, order_id, order_package_id, user_id, order_clients_id,
    active
) VALUES (
    1, 1, 45.00, NOW(), NOW(),
    @promo_id, @order_id, @line_free, 7, NULL,
    1
);
```

---

## 7. Queries criticas del motor

### 7.1 Promociones activas para una sucursal en este momento

```sql
SELECT p.*
FROM pos_promotion p
WHERE p.active = 1
  AND p.is_active = 1
  AND CURRENT_DATE BETWEEN p.start_date AND COALESCE(p.end_date, '9999-12-31')
  AND (p.subsidiary_id IS NULL OR p.subsidiary_id = :sucursal_id)
  AND (p.start_time IS NULL OR CURRENT_TIME BETWEEN p.start_time AND p.end_time)
  AND (p.weekdays IS NULL OR FIND_IN_SET(DAYOFWEEK(CURRENT_DATE) - 1, p.weekdays))
ORDER BY p.priority ASC;
```

### 7.2 Productos elegibles de una promo

```sql
SELECT pp.product_id, op.name, op.price
FROM pos_promotion_product pp
JOIN order_products op ON op.id = pp.product_id
WHERE pp.pos_promotion_id = :promo_id
  AND pp.active = 1
  AND op.active = 1;
```

### 7.3 Cuantos sets se han aplicado en el dia (limite por usuario)

```sql
SELECT COALESCE(SUM(sets_applied), 0) AS total_sets
FROM pos_promotion_application
WHERE pos_promotion_id = :promo_id
  AND order_clients_id = :cliente_id
  AND DATE(applied_at) = CURRENT_DATE
  AND active = 1;
```

### 7.4 Reporte de efectividad por promo (mes corrido)

```sql
SELECT
    p.code, p.name,
    COUNT(*)                     AS veces_aplicada,
    SUM(pa.sets_applied)         AS sets_totales,
    SUM(pa.items_free)           AS items_regalados,
    SUM(pa.amount_saved)         AS total_descontado
FROM pos_promotion_application pa
JOIN pos_promotion p ON p.id = pa.pos_promotion_id
WHERE pa.applied_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
  AND pa.active = 1
GROUP BY p.id, p.code, p.name
ORDER BY total_descontado DESC;
```

---

## 8. Reglas de aplicacion del motor (backend)

| # | Regla | Validacion |
|:-:|---|---|
| 1 | Identificar productos elegibles en el carrito | `JOIN pos_promotion_product / category` |
| 2 | Agrupar en sets de X | `floor(qty_elegible / buy_quantity)` |
| 3 | Por cada set: marcar Y mas baratos como gratis | `discount_target='CHEAPEST'` → ordenar por unit_price ASC |
| 4 | Insertar `pos_order_discount` con scope='line' por cada item gratis | `percentage=100`, `amount=unit_price` |
| 5 | Insertar `pos_promotion_application` con totales | trazabilidad |
| 6 | Validar constraints antes de aplicar | `MAX_USES_PER_ORDER`, `MIN_TICKET_AMOUNT`, etc. |
| 7 | Resolver prioridades si varias promos coinciden | `ORDER BY priority ASC` — primero el menor |
| 8 | Toda validacion corre en backend (nunca solo frontend) | seguridad |

---

## 9. Seguridad

- **Validar precios en backend.** Frontend solo muestra el calculo; el motor recalcula al cerrar venta.
- **Constraints inmutables en BD.** Modificar limites mientras un ticket esta abierto no afecta tickets ya cobrados.
- **Auditar `pos_promotion_application`.** Toda aplicacion deja rastro con `user_id` y `applied_at`.
- **Soft-delete (`active=0`).** Una promo "borrada" sigue siendo consultable para reportes historicos.
- **Resolver conflictos por `priority`.** Evita doble descuento en mismo set de productos.

---

## 10. Extensiones futuras (no v1)

| Feature | Cambio sugerido |
|---|---|
| Cupones nominativos | Tabla `pos_promotion_coupon (code, max_uses, used_count)` |
| Promociones combinadas (3x2 + 10% off) | `pos_promotion_stack` con orden de aplicacion |
| Mix de categorias (1 cafe + 1 pan = $X) | `pos_promotion_bundle (promotion_id, slot, product_id/category_id, qty)` |
| Promo por monto de ticket (gasta $500 → 1 gratis) | Constraint `MIN_TICKET_AMOUNT` ya soportado |
| Niveles de cliente (oro/plata) | FK opcional `customer_tier_id` en `pos_promotion` |
