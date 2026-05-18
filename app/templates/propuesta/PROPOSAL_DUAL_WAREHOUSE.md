# Propuesta: Dual Warehouse — Almacen POS + Almacen Personal

> **Fecha:** 2026-05-18
> **Esquema objetivo:** `fayxzvov_reginas` (Huubie — POS + Inventario moderno)
> **Agentes de analisis:** `coffee-intelligence` + `Explore`

---

## 1. Resumen ejecutivo

Actualmente el proyecto Huubie opera con **dos universos de inventario completamente desconectados**:

| Sistema | Esquema | Manejo de stock | Conexion con POS |
|---------|---------|-----------------|------------------|
| POS + Pedidos | `fayxzvov_reginas` | `inv_supplies.stock` (stock directo, sin almacen) | Si — pero no descuenta stock al vender |
| ERP Legacy | `fayxzvov_almacen` | `product.quantity` + movimientos (`inventory_movement`) | No — sistema aparte |
| Prototipos UI | `app/inventarios/` | FAKE / SAMPLE_* | No hay backend |

**No existe la entidad `warehouse` / `almacen` en ningun esquema.** El stock se filtra unicamente por `subsidiary_id` / `udn_id`.

Esta propuesta introduce el concepto de **Dual Warehouse**: cada sucursal puede tener hasta dos almacenes logicos:
- **Almacen POS** (`type = 'pos'`) — abastece el punto de venta; stock se descuenta automaticamente al vender.
- **Almacen Personal** (`type = 'personal'`) — reserva de materia prima / insumos para produccion o uso interno.

---

## 2. Hallazgos del analisis

### 2.1 No hay tabla `warehouse`

```sql
-- Consulta ejecutada por coffee-intelligence:
SHOW TABLES LIKE '%warehouse%';
SHOW TABLES LIKE '%almacen%';
-- Resultado: 0 filas en fayxzvov_reginas
```

### 2.2 Stock vivo en esquema activo (`fayxzvov_reginas`)

| Tabla | Campo stock | Observacion |
|-------|-------------|-------------|
| `inv_supplies` | `stock` | Stock directo del insumo. Sin almacen. |
| `inv_kardex` | `previous_stock`, `new_stock` | Log historico de movimientos. Sin `warehouse_id`. |
| `inv_adjustments` | `quantity` | Mermas/ajustes. Sin `warehouse_id`. |

### 2.3 Stock en legacy (`fayxzvov_almacen`)

| Tabla | Campo stock | Observacion |
|-------|-------------|-------------|
| `product` | `quantity` | Stock directo del producto. Con `udn_id`. |
| `inventory_movement` | — | Header de movimiento. Con `udn_id`. |
| `inventory_movement_detail` | `previous_stock`, `resulting_stock` | Renglones con trazabilidad atomica. |

### 2.4 POS no toca inventario ERP

El flujo de venta en `app/pos/`:
1. Abre `cash_shift` (turno de caja).
2. Crea `order` + `order_package`.
3. Registra `pos_order_payment`.
4. **Nunca descuenta stock de `inv_supplies` ni de `product`.**

El flujo de `inv_recipes` (recetas) existe pero no se ejecuta al vender.

---

## 3. Modelo de datos propuesto

### 3.1 Tablas nuevas

#### `warehouse` — Almacenes

```sql
CREATE TABLE warehouse (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    code            VARCHAR(20)  NOT NULL,
    type            ENUM('pos','personal') NOT NULL DEFAULT 'pos',
    subsidiary_id   INT UNSIGNED NOT NULL,
    is_default      TINYINT(1)   NOT NULL DEFAULT 0,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_warehouse_subsidiary
        FOREIGN KEY (subsidiary_id) REFERENCES fayxzvov_alpha.subsidiaries(id),

    UNIQUE KEY uk_warehouse_code (code),
    KEY idx_warehouse_subsidiary (subsidiary_id),
    KEY idx_warehouse_type (type),
    KEY idx_warehouse_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Reglas de negocio:**
- Una sucursal puede tener **maximo un** `warehouse` de tipo `pos` con `is_default = 1`.
- Una sucursal puede tener **maximo un** `warehouse` de tipo `personal` con `is_default = 1`.
- El `code` es unico global (ej: `POS-CEN-01`, `PER-CEN-01`).

#### `warehouse_inventory` — Stock por almacen

```sql
CREATE TABLE warehouse_inventory (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    warehouse_id    INT UNSIGNED NOT NULL,
    supply_id       INT UNSIGNED NOT NULL,
    quantity        DOUBLE       NOT NULL DEFAULT 0,
    min_stock       DOUBLE       NOT NULL DEFAULT 0,
    max_stock       DOUBLE       NOT NULL DEFAULT 0,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_wi_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouse(id) ON DELETE CASCADE,
    CONSTRAINT fk_wi_supply
        FOREIGN KEY (supply_id) REFERENCES inv_supplies(id) ON DELETE CASCADE,

    UNIQUE KEY uk_wi_warehouse_supply (warehouse_id, supply_id),
    KEY idx_wi_supply (supply_id),
    KEY idx_wi_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Reglas de negocio:**
- Un insumo puede existir en multiples almacenes (misma sucursal o distintas).
- `quantity` es el stock fisico actual en ese almacen.
- `min_stock` / `max_stock` son umbrales por almacen (pueden variar del catalogo global).

#### `warehouse_transfer` — Traspasos entre almacenes

```sql
CREATE TABLE warehouse_transfer (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    folio               VARCHAR(30)  NOT NULL,
    origin_warehouse_id INT UNSIGNED NOT NULL,
    dest_warehouse_id   INT UNSIGNED NOT NULL,
    status              ENUM('draft','in_transit','completed','cancelled') NOT NULL DEFAULT 'draft',
    total_items         INT UNSIGNED NOT NULL DEFAULT 0,
    total_quantity      DOUBLE       NOT NULL DEFAULT 0,
    notes               TEXT,
    employee_id         INT UNSIGNED DEFAULT NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP    NULL,

    CONSTRAINT fk_wt_origin
        FOREIGN KEY (origin_warehouse_id) REFERENCES warehouse(id),
    CONSTRAINT fk_wt_dest
        FOREIGN KEY (dest_warehouse_id) REFERENCES warehouse(id),
    CONSTRAINT fk_wt_employee
        FOREIGN KEY (employee_id) REFERENCES fayxzvov_alpha.usr_users(id),

    UNIQUE KEY uk_wt_folio (folio),
    KEY idx_wt_status (status),
    KEY idx_wt_origin (origin_warehouse_id),
    KEY idx_wt_dest (dest_warehouse_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### `warehouse_transfer_detail` — Renglones de traspaso

```sql
CREATE TABLE warehouse_transfer_detail (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transfer_id         INT UNSIGNED NOT NULL,
    supply_id           INT UNSIGNED NOT NULL,
    quantity            DOUBLE       NOT NULL,
    origin_prev_stock   DOUBLE       NOT NULL,
    origin_post_stock   DOUBLE       NOT NULL,
    dest_prev_stock     DOUBLE       NOT NULL,
    dest_post_stock     DOUBLE       NOT NULL,

    CONSTRAINT fk_wtd_transfer
        FOREIGN KEY (transfer_id) REFERENCES warehouse_transfer(id) ON DELETE CASCADE,
    CONSTRAINT fk_wtd_supply
        FOREIGN KEY (supply_id) REFERENCES inv_supplies(id),

    KEY idx_wtd_transfer (transfer_id),
    KEY idx_wtd_supply (supply_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 Adaptaciones a tablas existentes

#### `inv_kardex` — Agregar `warehouse_id`

```sql
ALTER TABLE inv_kardex
    ADD COLUMN warehouse_id INT UNSIGNED NULL AFTER supply_id,
    ADD CONSTRAINT fk_kardex_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
    ADD KEY idx_kardex_warehouse (warehouse_id);
```

#### `inv_adjustments` — Agregar `warehouse_id`

```sql
ALTER TABLE inv_adjustments
    ADD COLUMN warehouse_id INT UNSIGNED NULL AFTER supply_id,
    ADD CONSTRAINT fk_adjustments_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
    ADD KEY idx_adjustments_warehouse (warehouse_id);
```

#### `order` / `order_package` — Opcional: ligar venta a `warehouse_id`

```sql
ALTER TABLE order
    ADD COLUMN warehouse_id INT UNSIGNED NULL AFTER subsidiaries_id,
    ADD CONSTRAINT fk_order_warehouse
        FOREIGN KEY (warehouse_id) REFERENCES warehouse(id),
    ADD KEY idx_order_warehouse (warehouse_id);
```

---

## 4. Diagrama de relaciones (propuesto)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  fayxzvov_alpha                                                         │
│  ┌──────────────────┐                                                   │
│  │ subsidiaries     │                                                   │
│  │ • id             │                                                   │
│  │ • name           │                                                   │
│  └─────────┬────────┘                                                   │
└────────────┼──────────────────────────────────────────────────────────────┘
             │ 1:N
             ▼
╔═══════════════════════════════════════════════════════════════════════════╗
║  fayxzvov_reginas                                                         ║
║                                                                           ║
║  ┌─────────────────┐         ┌─────────────────┐                         ║
║  │ warehouse       │         │ inv_supplies    │                         ║
║  │ • id            │◄────────│ • id            │                         ║
║  │ • name          │   1:N   │ • name          │                         ║
║  │ • code          │         │ • sku           │                         ║
║  │ • type          │         │ • stock         │  ← deprecar gradualmente ║
║  │ • subsidiary_id │         │ • cost          │                         ║
║  │ • is_default    │         └─────────────────┘                         ║
║  └────────┬────────┘                                                      ║
║           │ 1:N                                                           ║
║           ▼                                                               ║
║  ┌─────────────────────────────────────────────────────────────────┐     ║
║  │ warehouse_inventory                                             │     ║
║  │ • id          PK                                                │     ║
║  │ • warehouse_id  FK ─→ warehouse                                 │     ║
║  │ • supply_id     FK ─→ inv_supplies                            │     ║
║  │ • quantity      (stock actual en este almacen)                  │     ║
║  │ • min_stock                                                     │     ║
║  │ • max_stock                                                     │     ║
║  └────────┬──────────────────────────────────────────────────────────┘     ║
║           │                                                               ║
║           │ 1:N                                                           ║
║           ▼                                                               ║
║  ┌─────────────────────────────────────────────────────────────────┐     ║
║  │ inv_kardex  (+ warehouse_id)                                    │     ║
║  │ • id                                                            │     ║
║  │ • supply_id                                                     │     ║
║  │ • warehouse_id   FK ─→ warehouse                                │     ║
║  │ • type        (entrada, salida, ajuste, merma, venta, compra)   │     ║
║  │ • quantity                                                      │     ║
║  │ • previous_stock                                                │     ║
║  │ • new_stock                                                     │     ║
║  └─────────────────────────────────────────────────────────────────┘     ║
║                                                                           ║
║  ┌─────────────────────────────────────────────────────────────────┐     ║
║  │ warehouse_transfer                                              │     ║
║  │ • id          PK                                                │     ║
║  │ • folio                                                         │     ║
║  │ • origin_warehouse_id  FK ─→ warehouse                          │     ║
║  │ • dest_warehouse_id    FK ─→ warehouse                          │     ║
║  │ • status    (draft, in_transit, completed, cancelled)           │     ║
║  └────────┬──────────────────────────────────────────────────────────┘     ║
║           │ 1:N                                                           ║
║           ▼                                                               ║
║  ┌─────────────────────────────────────────────────────────────────┐     ║
║  │ warehouse_transfer_detail                                       │     ║
║  │ • id          PK                                                │     ║
║  │ • transfer_id   FK ─→ warehouse_transfer                        │     ║
║  │ • supply_id     FK ─→ inv_supplies                              │     ║
║  │ • quantity                                                      │     ║
║  │ • origin_prev_stock, origin_post_stock                          │     ║
║  │ • dest_prev_stock, dest_post_stock                              │     ║
║  └─────────────────────────────────────────────────────────────────┘     ║
║                                                                           ║
║  Transacciones POS (adaptadas):                                         ║
║  ┌─────────────────┐                                                    ║
║  │ order           │                                                    ║
║  │ • id            │                                                    ║
║  │ • warehouse_id  FK ─→ warehouse  (almacen POS de la venta)       │     ║
║  │ • status        │                                                    ║
║  └────────┬────────┘                                                    ║
║           │ 1:N                                                        ║
║           ▼                                                            ║
║  ┌─────────────────┐                                                    ║
║  │ order_package   │                                                    ║
║  │ • id            │                                                    ║
║  │ • pedidos_id    │                                                    ║
║  │ • product_id    │                                                    ║
║  │ • quantity      │  ← al guardar, descontar de warehouse_inventory  ║
║  └─────────────────┘                                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Cardinalidades

| Origen | → | Destino | Cardinalidad |
|--------|---|---------|--------------|
| `subsidiaries` | → | `warehouse` | 1 : N |
| `warehouse` | → | `warehouse_inventory` | 1 : N |
| `inv_supplies` | → | `warehouse_inventory` | 1 : N |
| `warehouse_inventory` | → | `inv_kardex` | 1 : N |
| `warehouse` | → | `inv_kardex` | 1 : N |
| `warehouse` | → | `warehouse_transfer` (origin) | 1 : N |
| `warehouse` | → | `warehouse_transfer` (dest) | 1 : N |
| `warehouse_transfer` | → | `warehouse_transfer_detail` | 1 : N |
| `warehouse` | → | `order` | 1 : N |

---

## 5. Flujos de negocio

### 5.1 Flujo de venta POS (con dual warehouse)

```
1. Usuario abre turno de caja (cash_shift).
2. Sistema detecta warehouse POS default de la subsidiary.
3. Al agregar producto a la orden:
   a. Si el producto tiene receta (inv_recipes):
      - Calcula insumos necesarios.
      - Valida stock en warehouse_inventory (warehouse_id = POS default).
      - Si stock insuficiente → bloquea venta o muestra advertencia.
   b. Si es producto simple (sin receta):
      - Valida stock directo en warehouse_inventory.
4. Al pagar (status = 3, Pagado):
   a. Descuenta insumos de warehouse_inventory.quantity.
   b. Inserta movimientos en inv_kardex (type = 'venta').
   c. Guarda warehouse_id en order.warehouse_id.
```

### 5.2 Flujo de traspaso entre almacenes

```
1. Usuario selecciona almacen origen y destino.
   - Restriccion: origen y destino deben ser de la MISMA subsidiary.
2. Agrega insumos y cantidades.
   - Valida que origen tenga suficiente stock.
3. Guarda como borrador (status = 'draft').
4. Al confirmar envio:
   a. Descuenta stock del origen (warehouse_inventory).
   b. Inserta en inv_kardex (type = 'salida' para origen).
   c. Cambia status a 'in_transit'.
5. Al recibir en destino:
   a. Suma stock al destino (warehouse_inventory).
   b. Inserta en inv_kardex (type = 'entrada' para destino).
   c. Cambia status a 'completed'.
   d. Registra stocks previo/posterior en warehouse_transfer_detail.
6. Cancelacion:
   a. Si status = 'draft' → elimina.
   b. Si status = 'in_transit' → revierte stock al origen.
```

### 5.3 Flujo de compra (orden de compra)

```
1. Usuario crea inv_purchase_orders.
2. Al recibir mercancia:
   a. Selecciona warehouse destino (POS o Personal).
   b. Suma stock a warehouse_inventory.
   c. Inserta en inv_kardex (type = 'compra', warehouse_id = destino).
```

---

## 6. Migracion de datos

### Paso 1: Crear warehouses por sucursal

```sql
INSERT INTO warehouse (name, code, type, subsidiary_id, is_default, active)
SELECT
    CONCAT('Almacen POS - ', s.name) AS name,
    CONCAT('POS-', UPPER(LEFT(s.name, 3)), '-01') AS code,
    'pos' AS type,
    s.id AS subsidiary_id,
    1 AS is_default,
    1 AS active
FROM fayxzvov_alpha.subsidiaries s
WHERE s.active = 1;
```

### Paso 2: Migrar stock de `inv_supplies` a `warehouse_inventory`

```sql
INSERT INTO warehouse_inventory (warehouse_id, supply_id, quantity, min_stock, max_stock)
SELECT
    w.id AS warehouse_id,
    inv.id AS supply_id,
    inv.stock AS quantity,
    inv.min_stock,
    inv.max_stock
FROM inv_supplies inv
JOIN warehouse w ON w.subsidiary_id = inv.subsidiary_id AND w.type = 'pos' AND w.is_default = 1;
```

### Paso 3: Backfill `inv_kardex` con `warehouse_id`

```sql
UPDATE inv_kardex k
JOIN inv_supplies inv ON inv.id = k.supply_id
JOIN warehouse w ON w.subsidiary_id = inv.subsidiary_id AND w.type = 'pos' AND w.is_default = 1
SET k.warehouse_id = w.id
WHERE k.warehouse_id IS NULL;
```

---

## 7. Consideraciones de deuda tecnica

Segun el analisis de `db-rules.md` realizado por coffee-intelligence:

| Regla violada actualmente | Correccion en propuesta |
|---------------------------|------------------------|
| `inv_supplies` (plural) | Mantener por compatibilidad; nuevas tablas usan singular (`warehouse`). |
| `inv_kardex` sin `warehouse_id` | Se corrige con ALTER. |
| `inv_adjustments` sin `warehouse_id` | Se corrige con ALTER. |
| ENUM en tablas legacy | `warehouse_transfer.status` usa ENUM; evaluar si cambiar a catalogo `status_process`. |

---

## 8. Templates de propuesta (UI)

Los templates visuales se encuentran en:

| Template | Ruta | Descripcion |
|----------|------|-------------|
| Hub de navegacion | `app/templates/propuesta/dual-warehouse-hub.html` | Landing con cards de las 4 pantallas |
| Admin de almacenes | `app/templates/propuesta/dual-warehouse-almacenes.html` | CRUD de almacenes con columna "Tipo" (POS/Personal) |
| Stock dual | `app/templates/propuesta/dual-warehouse-stock.html` | Vista de stock por almacen, con filtro por tipo |
| Traspaso | `app/templates/propuesta/dual-warehouse-traspaso.html` | Wizard de traspaso origen → destino con validacion de stock |

Todos los templates usan el sistema de diseno dark de Huubie (Tailwind + Inter + Lucide), alineados con `admin-inventarios.html`.

---

## 9. Plan de implementacion sugerido

| Fase | Tarea | Duracion estimada |
|------|-------|-------------------|
| 1 | Crear tablas `warehouse`, `warehouse_inventory`, `warehouse_transfer`, `warehouse_transfer_detail` | 1 dia |
| 2 | Adaptar `inv_kardex` y `inv_adjustments` con `warehouse_id` | 0.5 dias |
| 3 | Migrar datos existentes (`inv_supplies` → `warehouse_inventory`) | 0.5 dias |
| 4 | Implementar backend (ctrl/mdl) para CRUD de almacenes | 2 dias |
| 5 | Implementar backend para traspasos | 2 dias |
| 6 | Integrar POS: descuento automatico de stock al vender | 3 dias |
| 7 | Implementar frontend (templates → componentes JS) | 3 dias |
| 8 | Pruebas end-to-end | 2 dias |

**Total estimado: ~14 dias laborables.**

---

## 10. Preguntas abiertas para el equipo

1. **¿Las recetas (`inv_recipes`) se ejecutaran automaticamente al vender?** Actualmente estan definidas pero no se usan.
2. **¿El almacen `personal` puede existir en multiples instancias por sucursal?** (Ej: Personal-Refrigerados, Personal-Secos) o es unico.
3. **¿Los traspasos entre sucursales estan en scope?** La propuesta actual limita traspasos a la misma `subsidiary_id`.
4. **¿Se depreca `inv_supplies.stock` gradualmente o se mantiene como cache?** Se recomienda mantener como cache (SUM de `warehouse_inventory`) durante la transicion.
