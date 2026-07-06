# Propuesta de base de datos — Sistema Factura SAT

> Generada por **Coffee Intelligence** 🧠☕ siguiendo `db-rules.md` (CoffeeSoft/Huubie).
> Fuente: `Sistema Factura SAT.xlsx`. Ver contexto de negocio y fases en **`PLAN.md`**.
>
> ⚠️ **Modo offline (sin MCP MySQL).** Modelo como si el esquema estuviera vacío + maestros cross-schema.
> El esquema/tenant destino **debe confirmarse** (`SHOW DATABASES LIKE ...`) antes de correr el DDL.
> Aquí uso `rfwsmqex_facturacion` como placeholder, alineado con `rfwsmqex_erp.udn/usuarios`.

---

## 🔍 Inspección del template (Fase 1)

- **Evento raíz (doble):**
  - `sale` — la **orden/ticket** del POS que se cobra (hoja *Venta por pago*).
  - `invoice` — el **CFDI** emitido (hoja *Facturados*).
- **Detalles detectados:**
  - `detail_sale_payment` — cada **pago** aplicado a una orden (efectivo/tarjeta). Una orden tiene 1..N pagos.
- **Catálogos detectados (dropdowns / listas SAT):**
  - `payment_form` — SAT `c_FormaPago` (`01-Efectivo`, `04-Tarjetas de crédito`).
  - `payment_method` — SAT `c_MetodoPago` (`PUE`, `PPD`).
  - `order_type` — Tipo de orden (`Restaurant`).
  - `invoice_type` — Tipo de comprobante (`Factura de punto de venta (auto emisión)`).
  - `customer` — cliente fiscal (RFC + razón social), se repite entre facturas.
- **Pivotes N:M:** ninguno. (`customer→invoice`, `sale→invoice` son N:1.)
- **Maestros corporativos (cross-schema, NO se modelan aquí):**
  - `Mesero` → `empleado` (`rfwsmqex_gvsl_rrhh.empleados`).
  - `Cajero` → `usuario` (`rfwsmqex_erp.usuarios`).
  - Sucursal → `udn` (`rfwsmqex_erp.udn`).
- **Estados / flujo:**
  - `sale.status` — `Pagada` (estado del ticket).
  - `invoice.status` — `Vigente` / `Cancelado` (ciclo fiscal del CFDI).
- **Montos (DOUBLE):** `Monto`, `Total`, `Propina`, `Total Cobrado`, `Subtotal`, `IVA`, `IEPS`, `Total`.
- **Fechas:** `DIA`, `Fecha`, `Fecha de pago`, `Fecha de operación` → `DATE`. Auditoría → `DATETIME`.
- **Excluido por minimalismo (regla de oro):**
  - Hoja **Resumen** completa (participación del día, meta 0.7, tasas, `Orden Bloqueado`, `Nuevo orden`)
    → **cálculo/reporte derivado**, no se persiste.
  - `Total` del día y `Participación del día` → agregados analíticos.
  - `Subtipo de orden` → siempre `-` en los datos (sin información) → se omite; entra por `ALTER` si aplica.

---

## 🗂 Modelo lógico (Fase 2)

### Tablas propuestas

| Tabla | Clase | Estado |
|---|---|---|
| `customer` | catálogo | [NUEVO] |
| `payment_form` | catálogo (SAT) | [NUEVO] |
| `payment_method` | catálogo (SAT) | [NUEVO] |
| `order_type` | catálogo | [NUEVO] |
| `invoice_type` | catálogo | [NUEVO] |
| `sale` | transacción raíz | [NUEVO] |
| `detail_sale_payment` | detalle | [NUEVO] |
| `invoice` | transacción raíz | [NUEVO] |

### 🗺️ Diagrama de relaciones

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  rfwsmqex_erp / rfwsmqex_gvsl_rrhh   (cross-schema — maestros corporativos)     │
│  ┌──────────────┐   ┌────────────────┐   ┌────────────────────┐                 │
│  │ udn          │   │ usuarios       │   │ empleados          │                 │
│  │ • idUDN   PK │   │ • idUser    PK │   │ • idEmpleado    PK │                 │
│  └──────┬───────┘   └───────┬────────┘   └─────────┬──────────┘                 │
└─────────┼───────────────────┼──────────────────────┼───────────────────────────┘
          │ udn_id            │ user_id              │ employee_id
          ▼                   ▼                      ▼
╔═════════════════════════════════════════════════════════════════════════════════╗
║  rfwsmqex_facturacion   (esquema del módulo — placeholder, confirmar)            ║
║                                                                                 ║
║  ┌────────────────────┐        ┌──────────────────────────────┐                 ║
║  │ order_type         │  N:1   │ sale             [NUEVO]      │                 ║
║  │ • id            PK │◄───────┤ • id                    PK    │                 ║
║  │ • name             │        │ • pos_reference (ID cruce)    │                 ║
║  └────────────────────┘        │ • operation_date             │                 ║
║  ┌────────────────────┐        │ • status  (Pagada)           │                 ║
║  │ invoice_type       │        │ • udn_id ─→ erp.udn          │                 ║
║  │ • id            PK │        │ • employee_id ─→ rrhh (mesero)│                ║
║  │ • name             │        │ • user_id ─→ erp (cajero)    │                 ║
║  └────────────────────┘        └───────┬──────────────────────┘                 ║
║                                         │ 1:N                                    ║
║  ┌────────────────────┐   N:1           ▼                                        ║
║  │ payment_form (SAT) │◄──────┌──────────────────────────────┐                  ║
║  │ • id            PK │       │ detail_sale_payment [NUEVO]   │                  ║
║  │ • code (01/04)     │       │ • id                    PK    │                  ║
║  │ • name             │       │ • amount / tip / total_charged│                  ║
║  └─────────┬──────────┘       │ • payment_date               │                  ║
║            │ N:1              │ • sale_id ─────→ sale         │                  ║
║            │                  │ • payment_form_id ─→ payment_form                ║
║            │                  └──────────────────────────────┘                  ║
║            │                                                                     ║
║  ┌─────────┴──────────┐        ┌──────────────────────────────┐                 ║
║  │ payment_method(SAT)│  N:1   │ invoice          [NUEVO]      │  N:1  ┌────────┐║
║  │ • id            PK │◄───────┤ • id                    PK    │──────►│customer│║
║  │ • code (PUE/PPD)   │        │ • folio / reference / uuid    │       │• id  PK│║
║  │ • name             │        │ • subtotal/tax/ieps/total/tip │       │• rfc   │║
║  └────────────────────┘        │ • invoice_date/operation_date │       │• name  │║
║                                │ • status (Vigente/Cancelado)  │       └────────┘║
║                                │ • sale_id ───────→ sale       │                 ║
║                                │ • payment_form_id ─→ payment_form               ║
║                                │ • payment_method_id ─→ payment_method           ║
║                                │ • order_type_id ─→ order_type │                 ║
║                                │ • invoice_type_id ─→ invoice_type               ║
║                                │ • udn_id / user_id  ─→ cross  │                 ║
║                                └──────────────────────────────┘                 ║
╚═════════════════════════════════════════════════════════════════════════════════╝
```

### Cardinalidades

| Origen | → | Destino | Cardinalidad |
|---|---|---|---|
| sale | → | detail_sale_payment | 1 : N |
| sale | → | order_type | N : 1 |
| sale | → | udn / empleados / usuarios | N : 1 (cross-schema) |
| detail_sale_payment | → | payment_form | N : 1 |
| invoice | → | sale | N : 1 (efectivo 1:1) |
| invoice | → | customer | N : 1 |
| invoice | → | payment_form | N : 1 |
| invoice | → | payment_method | N : 1 |
| invoice | → | order_type | N : 1 |
| invoice | → | invoice_type | N : 1 |
| invoice | → | udn / usuarios | N : 1 (cross-schema) |

---

## ✅ Estructura de tablas (Fase 3)

### Catálogos

```
┌──────────────────────────────────────────────────────────────────────┐
│ customer  (catálogo — cliente fiscal / receptor CFDI)                 │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  rfc                    VARCHAR(13)     RFC del receptor              │
│  name                   VARCHAR(255)    razón social                  │
│                                                                      │
│  ── Timestamps ──                                                     │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ payment_form  (catálogo SAT c_FormaPago)                             │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  code                   CHAR(2)         01, 04 …                      │
│  name                   VARCHAR(100)    Efectivo, Tarjetas de crédito │
│                                                                      │
│  ── Timestamps ──                                                     │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ payment_method  (catálogo SAT c_MetodoPago)                          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  code                   CHAR(3)         PUE, PPD                      │
│  name                   VARCHAR(100)    Pago en una sola exhibición   │
│                                                                      │
│  ── Timestamps ──                                                     │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ order_type  (catálogo — tipo de orden)                              │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  name                   VARCHAR(100)    Restaurant                    │
│                                                                      │
│  ── Timestamps ──                                                     │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ invoice_type  (catálogo — tipo de comprobante)                      │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  name                   VARCHAR(150)    Factura de PV (auto emisión)  │
│                                                                      │
│  ── Timestamps ──                                                     │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Transacciones raíz

```
┌──────────────────────────────────────────────────────────────────────┐
│ sale  (transacción raíz — orden/ticket del POS a facturar)          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  pos_reference          VARCHAR(30)     "ID" del POS (llave de cruce) │
│  pos_movement           INT             Movimiento PDV                │
│  order_seq              INT             ORDEN dentro del día          │
│  invoiced               TINYINT         Facturado Sí/No (ver notas)   │
│                                                                      │
│  ── Timestamps ──                                                     │
│  operation_date         DATE            DIA / Fecha del ticket        │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Status ──                                                         │
│  status                 VARCHAR(20)     Pagada                        │
│                                                                      │
│  ── FK cross-schema ──                                                │
│  udn_id                 → rfwsmqex_erp.udn                            │
│  employee_id            → rfwsmqex_gvsl_rrhh.empleados  (mesero)      │
│  user_id                → rfwsmqex_erp.usuarios         (cajero)      │
│                                                                      │
│  ── FK locales ──                                                     │
│  order_type_id          → order_type          SET NULL               │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ invoice  (transacción raíz — CFDI emitido)                          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  folio                  VARCHAR(20)     folio interno (A133)          │
│  reference              VARCHAR(50)     referencia (AE_…)             │
│  uuid                   CHAR(36)        folio fiscal SAT (único)      │
│  order_number           INT            Número de orden               │
│  observations           VARCHAR(255)    Observaciones (NULL)          │
│                                                                      │
│  ── Montos ──                                                         │
│  subtotal               DOUBLE                                        │
│  tax                    DOUBLE          IVA                           │
│  ieps                   DOUBLE          IEPS                          │
│  total                  DOUBLE                                        │
│  tip                    DOUBLE          Propina                       │
│                                                                      │
│  ── Timestamps ──                                                     │
│  invoice_date           DATE            Fecha de emisión              │
│  operation_date         DATE            Fecha de operación            │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── Status ──                                                         │
│  status                 VARCHAR(20)     Vigente / Cancelado          │
│                                                                      │
│  ── FK cross-schema ──                                                │
│  udn_id                 → rfwsmqex_erp.udn                            │
│  user_id                → rfwsmqex_erp.usuarios     (emisor)          │
│                                                                      │
│  ── FK locales ──                                                     │
│  sale_id                → sale                 SET NULL               │
│  customer_id            → customer             SET NULL               │
│  payment_form_id        → payment_form         SET NULL               │
│  payment_method_id      → payment_method       SET NULL               │
│  order_type_id          → order_type           SET NULL               │
│  invoice_type_id        → invoice_type         SET NULL               │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Detalles

```
┌──────────────────────────────────────────────────────────────────────┐
│ detail_sale_payment  (detalle — pago aplicado a una orden)          │
├──────────────────────────────────────────────────────────────────────┤
│  id                     INT PK                                        │
│                                                                      │
│  ── Negocio ──                                                        │
│  reference              VARCHAR(100)    Referencia                    │
│  transaction            VARCHAR(100)    Transacción (NULL)            │
│  terminal               VARCHAR(50)     Terminal (SERVER1)            │
│  validation_code        VARCHAR(50)     Código de validación          │
│                                                                      │
│  ── Montos ──                                                         │
│  amount                 DOUBLE          Total (base)                  │
│  tip                    DOUBLE          Propina                       │
│  total_charged          DOUBLE          Total Cobrado                 │
│                                                                      │
│  ── Timestamps ──                                                     │
│  payment_date           DATE            Fecha de pago                 │
│  created_at             DATETIME                                      │
│  updated_at             DATETIME                                      │
│                                                                      │
│  ── FK locales ──                                                     │
│  sale_id                → sale                 CASCADE                │
│  payment_form_id        → payment_form         SET NULL               │
│                                                                      │
│  ── Soft-delete ──                                                    │
│  active                 TINYINT                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Pivotes

_Ninguno._ Todas las relaciones son N:1; no hay N:M en los datos.

---

## 📜 DDL (`CREATE TABLE`)

> El usuario pidió una propuesta completa → se incluye el DDL. Ajustar el nombre del esquema y los
> targets cross-schema una vez confirmados contra el servidor real.

```sql
-- ============================================================
-- Esquema: rfwsmqex_facturacion  (PLACEHOLDER — confirmar tenant)
-- Engine InnoDB · utf8mb4 · utf8mb4_0900_ai_ci
-- ============================================================

-- ---------- 1. Catálogos ----------

CREATE TABLE customer (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rfc         VARCHAR(13) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active      TINYINT NOT NULL DEFAULT 1,
  KEY `rfc` (`rfc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE payment_form (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code        CHAR(2) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active      TINYINT NOT NULL DEFAULT 1,
  KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE payment_method (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code        CHAR(3) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active      TINYINT NOT NULL DEFAULT 1,
  KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE order_type (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active      TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE invoice_type (
  id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active      TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------- 2. Transacciones raíz ----------

CREATE TABLE sale (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pos_reference  VARCHAR(30) NOT NULL,
  pos_movement   INT DEFAULT NULL,
  order_seq      INT DEFAULT NULL,
  invoiced       TINYINT NOT NULL DEFAULT 0,
  operation_date DATE DEFAULT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status         VARCHAR(20) DEFAULT NULL,
  udn_id         INT DEFAULT NULL,
  employee_id    INT DEFAULT NULL,
  user_id        INT DEFAULT NULL,
  order_type_id  INT DEFAULT NULL,
  active         TINYINT NOT NULL DEFAULT 1,
  KEY `pos_reference` (`pos_reference`),
  KEY `udn_id` (`udn_id`),
  KEY `employee_id` (`employee_id`),
  KEY `user_id` (`user_id`),
  KEY `order_type_id` (`order_type_id`),
  CONSTRAINT `sale_ibfk_1` FOREIGN KEY (`udn_id`)
    REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_2` FOREIGN KEY (`employee_id`)
    REFERENCES `rfwsmqex_gvsl_rrhh`.`empleados`(`idEmpleado`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_3` FOREIGN KEY (`user_id`)
    REFERENCES `rfwsmqex_erp`.`usuarios`(`idUser`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sale_ibfk_4` FOREIGN KEY (`order_type_id`)
    REFERENCES `order_type`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE invoice (
  id                INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  folio             VARCHAR(20) DEFAULT NULL,
  reference         VARCHAR(50) DEFAULT NULL,
  uuid              CHAR(36) DEFAULT NULL,
  order_number      INT DEFAULT NULL,
  observations      VARCHAR(255) DEFAULT NULL,
  subtotal          DOUBLE NOT NULL DEFAULT 0,
  tax               DOUBLE NOT NULL DEFAULT 0,
  ieps              DOUBLE NOT NULL DEFAULT 0,
  total             DOUBLE NOT NULL DEFAULT 0,
  tip               DOUBLE NOT NULL DEFAULT 0,
  invoice_date      DATE DEFAULT NULL,
  operation_date    DATE DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status            VARCHAR(20) NOT NULL DEFAULT 'Vigente',
  udn_id            INT DEFAULT NULL,
  user_id           INT DEFAULT NULL,
  sale_id           INT DEFAULT NULL,
  customer_id       INT DEFAULT NULL,
  payment_form_id   INT DEFAULT NULL,
  payment_method_id INT DEFAULT NULL,
  order_type_id     INT DEFAULT NULL,
  invoice_type_id   INT DEFAULT NULL,
  active            TINYINT NOT NULL DEFAULT 1,
  UNIQUE KEY `uuid` (`uuid`),
  KEY `udn_id` (`udn_id`),
  KEY `user_id` (`user_id`),
  KEY `sale_id` (`sale_id`),
  KEY `customer_id` (`customer_id`),
  KEY `payment_form_id` (`payment_form_id`),
  KEY `payment_method_id` (`payment_method_id`),
  KEY `order_type_id` (`order_type_id`),
  KEY `invoice_type_id` (`invoice_type_id`),
  CONSTRAINT `invoice_ibfk_1` FOREIGN KEY (`udn_id`)
    REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `rfwsmqex_erp`.`usuarios`(`idUser`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_3` FOREIGN KEY (`sale_id`)
    REFERENCES `sale`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_4` FOREIGN KEY (`customer_id`)
    REFERENCES `customer`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_5` FOREIGN KEY (`payment_form_id`)
    REFERENCES `payment_form`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_6` FOREIGN KEY (`payment_method_id`)
    REFERENCES `payment_method`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_7` FOREIGN KEY (`order_type_id`)
    REFERENCES `order_type`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoice_ibfk_8` FOREIGN KEY (`invoice_type_id`)
    REFERENCES `invoice_type`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------- 3. Detalles ----------

CREATE TABLE detail_sale_payment (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reference       VARCHAR(100) DEFAULT NULL,
  transaction     VARCHAR(100) DEFAULT NULL,
  terminal        VARCHAR(50) DEFAULT NULL,
  validation_code VARCHAR(50) DEFAULT NULL,
  amount          DOUBLE NOT NULL DEFAULT 0,
  tip             DOUBLE NOT NULL DEFAULT 0,
  total_charged   DOUBLE NOT NULL DEFAULT 0,
  payment_date    DATE DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sale_id         INT DEFAULT NULL,
  payment_form_id INT DEFAULT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  KEY `sale_id` (`sale_id`),
  KEY `payment_form_id` (`payment_form_id`),
  CONSTRAINT `detail_sale_payment_ibfk_1` FOREIGN KEY (`sale_id`)
    REFERENCES `sale`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_sale_payment_ibfk_2` FOREIGN KEY (`payment_form_id`)
    REFERENCES `payment_form`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

---

## 🧪 Checklist de validación (Fase 4)

- [x] **§7.1 Clasificación** — 5 catálogos, 2 raíces, 1 detalle, 0 pivotes; `detail_` solo en el renglón de pago.
- [x] **§7.2 Nombres** — singular, snake_case, inglés; PK `id`; FKs `<tabla>_id`; `KEY` = nombre de columna.
- [x] **§7.3 Columnas obligatorias** — `id`/`active`/`created_at`/`updated_at` en todas; `udn_id` en las raíces; `user_id` donde hay acción; `status` donde hay flujo.
- [x] **§7.4 Tipos** — montos `DOUBLE`; nombres `VARCHAR`; fechas de negocio `DATE`, auditoría `DATETIME`; sin `ENUM`.
- [x] **§7.5 Foreign Keys** — `CONSTRAINT <tabla>_ibfk_n` + `KEY`; políticas ON DELETE (detalle→raíz CASCADE, →catálogo/maestro SET NULL); maestros cross-schema, no duplicados.
- [x] **§7.6 Borrado** — `active` en todas; sin pivotes que requieran DELETE físico.
- [x] **§7.7 DDL final** — InnoDB, `utf8mb4_0900_ai_ci` sin mezclar; orden de columnas `id → negocio → montos → fechas → created_at/updated_at → status → FKs → active → KEYs → CONSTRAINTs`.

---

## 💡 Notas y decisiones

1. **Hoja `Resumen` no se modela.** Es analítica pura (participación del día, meta `0.7`, `TASA A FACTURAR`,
   `Orden Bloqueado`, `Nuevo orden`). Se resuelve con consultas/vistas sobre `sale` + `invoice` en F4.
2. **`sale.invoiced` (Facturado Sí/No)** se incluye porque está literal en los datos y es el eje del tablero,
   **pero es derivable** de la existencia de un `invoice` con ese `sale_id`. Se puede mantener por la app al
   timbrar, o eliminar y derivar por JOIN. **Pregunta abierta al usuario.**
3. **`invoice.status` y `sale.status`** se modelaron como `VARCHAR(20)` (flujo fiscal `Vigente/Cancelado` y
   ticket `Pagada`). Si el negocio quiere administrarlos como listas extensibles → migrar a catálogo + FK.
4. **`invoice ↔ sale` es N:1 (hoy 1:1).** Si en el futuro se emiten **facturas globales** (un CFDI que agrupa
   muchos tickets), esto pasa a N:M → tabla pivote `invoice_sale`. Hoy no aplica (auto-emisión por ticket).
5. **Mesero/Cajero/Sucursal** se referencian cross-schema (`empleados`/`usuarios`/`udn`). El Excel guarda solo
   los **nombres**; el importador deberá resolverlos a IDs. Confirmar los targets/PK reales cross-schema.
6. **Campos CFDI 4.0 ausentes en el Excel** (`uso_cfdi`, `regimen_fiscal`, `codigo_postal`, `moneda`, `serie`,
   `lugar_expedicion`) **no se inventan**; entran por `ALTER TABLE invoice` al integrar el PAC (Fase 5).
7. **`uuid` con `UNIQUE KEY`** por ser folio fiscal irrepetible.
8. **Esquema/tenant sin verificar (modo offline).** Antes de correr el DDL: `SHOW DATABASES LIKE 'rfwsmqex_%'`
   y confirmar targets cross-schema; si las ventas viven en el POS (`fayxzvov_*`), evaluar si `sale`/`detail_*`
   se importan o se referencian cross-schema en lugar de duplicarse.
