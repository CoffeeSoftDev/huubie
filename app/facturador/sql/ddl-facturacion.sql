-- ============================================================================
--  Facturador SAT — esquema fayxzvov_facturacion
--  Generado desde app/facturador/docs/plan-facturador.md
--
--  12 tablas: 7 catálogos · 2 transacciones raíz · 3 detalles · 0 pivotes
--
--  Convenciones aplicadas (grimorios/db-rules.md):
--    · InnoDB · utf8mb4 · utf8mb4_general_ci
--    · Montos en DOUBLE (convención de la casa, no DECIMAL)
--    · Sin ENUM: los estados van a catálogo + FK
--    · Soft-delete con `active`, nunca DELETE físico (salvo la recarga por batch)
--
--  Jerarquía corporativa PROPIA del módulo:  company (1) ──< branch (N)
--    · `company`  = membrete f1 del Excel  «COMIENDO EN CHIAPAS»
--    · `branch`   = membrete f2 del Excel  «CAFE DE CHIAPAS SUC. POLIFORUM»
--    · El aislamiento de TODO el módulo es por `branch_id` (antes subsidiaries_id).
--    · CERO FK cross-schema: el esquema es autónomo, no depende de
--      fayxzvov_alpha ni de fayxzvov_admin.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS fayxzvov_facturacion
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE fayxzvov_facturacion;


-- ============================================================================
--  1. CATÁLOGOS
-- ============================================================================

-- ── sale_status ─────────────────────────────────────────────────────────────
-- Estado fiscal del ticket. Seed fijo de 2 filas: se dan de alta una vez y no
-- se editan, por eso NO lleva timestamps (desviación consciente de §2.3).
-- Global: no lleva branch_id (son 2 valores del formato del POS, de nadie).
CREATE TABLE sale_status (
  id              INT NOT NULL AUTO_INCREMENT,
  name            VARCHAR(20) NOT NULL,              -- V·I «Estado» verbatim
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_status_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── company ─────────────────────────────────────────────────────────────────
-- Empresa emisora. Raíz de la jerarquía corporativa del módulo.
-- Sale del membrete f1 del export; RFC y teléfono son captura manual.
CREATE TABLE company (
  id              INT NOT NULL AUTO_INCREMENT,
  business_name   VARCHAR(200) NOT NULL,             -- V·membrete f1
  rfc             VARCHAR(13) NULL,                  -- captura manual
  fiscal_address  VARCHAR(255) NULL,                 -- captura manual
  phone           VARCHAR(20) NULL,                  -- captura manual
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  -- Prefijo de 150: utf8mb4 gasta 4 bytes/char y el índice de InnoDB con
  -- ROW_FORMAT=COMPACT (default de este 5.7) tope en 767 bytes. 150*4 = 600.
  UNIQUE KEY uk_company_name (business_name(150))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── branch ──────────────────────────────────────────────────────────────────
-- Sucursal emisora. Cuelga de company y es la dimensión de aislamiento de todo
-- el módulo: cada export viene del POS de UNA sucursal.
-- Alimenta el membrete del ticket impreso.
-- company_id va NOT NULL + RESTRICT: una sucursal sin empresa no significa nada
-- y borrar la empresa dejaría el membrete huérfano (desviación de la política
-- "→ maestro SET NULL", justificada en el plan §3.4).
CREATE TABLE branch (
  id              INT NOT NULL AUTO_INCREMENT,
  business_name   VARCHAR(200) NOT NULL,             -- V·membrete f2
  rfc             VARCHAR(13) NULL,                  -- captura manual
  fiscal_address  VARCHAR(255) NULL,                 -- V·membrete f3
  phone           VARCHAR(20) NULL,                  -- captura manual
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  company_id      INT NOT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_branch_name (business_name(150), company_id),   -- prefijo: ver company
  KEY idx_branch_company (company_id),
  CONSTRAINT fk_branch_company FOREIGN KEY (company_id)
    REFERENCES company (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── payment_method ──────────────────────────────────────────────────────────
-- Forma de pago del POS. 6 valores medidos en el export.
-- Lleva branch_id: cada POS escribe los nombres a su manera.
CREATE TABLE payment_method (
  id              INT NOT NULL AUTO_INCREMENT,
  name            VARCHAR(30) NOT NULL,              -- P·B «Método de pago» verbatim
  is_cash         TINYINT NOT NULL DEFAULT 0,        -- 1 = EFECTIVO: el generador lo oculta
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  branch_id       INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_method_name (name, branch_id),
  KEY idx_payment_method_cash (is_cash, active),
  KEY idx_payment_method_branch (branch_id),
  CONSTRAINT fk_payment_method_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── product ─────────────────────────────────────────────────────────────────
-- Platillos, modificadores y puentes. 376 claves medidas.
-- La clave es local al POS: por eso el UNIQUE incluye la sucursal.
CREATE TABLE product (
  id              INT NOT NULL AUTO_INCREMENT,
  code            VARCHAR(10) NOT NULL,              -- C·G «claveproducto»
  name            VARCHAR(60) NOT NULL,              -- C·I «descripcion»
  is_modifier     TINYINT NOT NULL DEFAULT 0,        -- derivado: 1 si nunca cobró
  is_bridge       TINYINT NOT NULL DEFAULT 0,        -- lo marca el usuario a mano
  price           DOUBLE NOT NULL DEFAULT 0,         -- captura manual (ver §6 del plan)
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  branch_id       INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_product_code (code, branch_id),
  KEY idx_product_generator (is_bridge, is_modifier, active),
  KEY idx_product_branch (branch_id),
  CONSTRAINT fk_product_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── waiter ──────────────────────────────────────────────────────────────────
-- Mesero del POS. 18 códigos. `name` nace con el propio código: nunca NULL.
-- El código '03' es un mesero distinto en cada sucursal: el UNIQUE la incluye.
CREATE TABLE waiter (
  id              INT NOT NULL AUTO_INCREMENT,
  code            VARCHAR(5) NOT NULL,               -- C·F «mesero» · VARCHAR salva el '03'
  name            VARCHAR(150) NOT NULL,             -- DEFAULT = code
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  branch_id       INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_waiter_code (code, branch_id),
  KEY idx_waiter_branch (branch_id),
  CONSTRAINT fk_waiter_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── import_batch ────────────────────────────────────────────────────────────
-- Bitácora de carga. Sin usuario: identifica el archivo y su sucursal.
CREATE TABLE import_batch (
  id              INT NOT NULL AUTO_INCREMENT,
  file_name       VARCHAR(255) NOT NULL,
  sheet_name      VARCHAR(60) NOT NULL,              -- Reporte de ventas / Pagos / comandas
  period_year     INT NULL,
  period_month    INT NULL,
  row_count       INT NOT NULL DEFAULT 0,            -- 3821 / 3909 / 13141
  control_total   DOUBLE NOT NULL DEFAULT 0,         -- 2644933.30 en ventas
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  branch_id       INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_import_period (period_year, period_month, sheet_name),
  KEY idx_import_branch (branch_id),
  CONSTRAINT fk_import_batch_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================================
--  2. TRANSACCIONES RAÍZ
-- ============================================================================

-- ── sale ────────────────────────────────────────────────────────────────────
-- El ticket. Hoja «Reporte de ventas», 3 821 filas.
-- Los montos entran LITERALES: subtotal + tax != total en los 145 tickets con
-- descuento, y eso es correcto por diseño del origen.
-- Sin updated_at: la recarga borra y reinserta, no actualiza.
CREATE TABLE sale (
  id              INT NOT NULL AUTO_INCREMENT,
  folio           VARCHAR(10) NOT NULL,              -- V·A «Folio» · llave de cruce
  billing_code    VARCHAR(30) NOT NULL,              -- V·B «Código facturación» tal cual
  invoice_series  VARCHAR(10) NULL,                  -- V·J «Folio factura» · 'C2482'
  source_row      INT NULL,                          -- fila física del Excel

  discount_percent DOUBLE NOT NULL DEFAULT 0,        -- V·D «Descuento» ES PORCENTAJE
  subtotal        DOUBLE NOT NULL DEFAULT 0,         -- V·E base ANTES del descuento
  tax             DOUBLE NOT NULL DEFAULT 0,         -- V·F impuesto DESPUÉS del descuento
  total           DOUBLE NOT NULL DEFAULT 0,         -- V·G autoritativo

  operation_date  DATETIME NULL,                     -- V·C «Fecha» CON hora
  expires_at      DATETIME NULL,                     -- V·H «Fecha de expiración»
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  sale_status_id  INT NULL,                          -- V·I «Estado» resuelto
  branch_id       INT NULL,
  import_batch_id INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_folio (folio, branch_id),
  UNIQUE KEY uk_sale_billing_code (billing_code, branch_id),
  KEY idx_sale_operation (operation_date, sale_status_id),
  KEY idx_sale_status (sale_status_id),
  KEY idx_sale_branch (branch_id),
  KEY idx_sale_batch (import_batch_id),
  CONSTRAINT fk_sale_status FOREIGN KEY (sale_status_id)
    REFERENCES sale_status (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sale_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_sale_batch FOREIGN KEY (import_batch_id)
    REFERENCES import_batch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── virtual_ticket ──────────────────────────────────────────────────────────
-- La nota que imprime el generador de folios.
-- branch_id hace las dos cosas: resuelve el membrete impreso Y ancla el
-- consecutivo diario. Por eso va NOT NULL: un UNIQUE con NULL deja de bloquear
-- duplicados en MySQL y dos sucursales chocarían con su «Nota #12» del mismo día.
CREATE TABLE virtual_ticket (
  id              INT NOT NULL AUTO_INCREMENT,
  note_number     INT NOT NULL,                      -- «Nota #12», reinicia cada día

  subtotal        DOUBLE NOT NULL DEFAULT 0,         -- suma de líneas puente
  discount        DOUBLE NOT NULL DEFAULT 0,         -- ajuste de cuadre
  total           DOUBLE NOT NULL DEFAULT 0,         -- = sale.total

  issue_date      DATE NOT NULL,                     -- DATE(sale.operation_date)
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  sale_id         INT NULL,                          -- ticket que respalda
  branch_id       INT NOT NULL,                      -- emisora del membrete + del folio
  active          TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  UNIQUE KEY uk_virtual_ticket_note (issue_date, note_number, branch_id),
  KEY idx_vt_sale (sale_id),
  KEY idx_vt_branch (branch_id),
  CONSTRAINT fk_vt_sale FOREIGN KEY (sale_id)
    REFERENCES sale (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_vt_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================================
--  3. DETALLES
-- ============================================================================

-- ── detail_sale ─────────────────────────────────────────────────────────────
-- RÉPLICA LITERAL de comandas.xls: las 12 columnas, fila por fila.
-- Mesa, mesero, apertura y cierre SE REPITEN en cada partida a propósito.
-- El índice (sale_id, product_id) NO puede ser UNIQUE: 1 578 pares se repiten,
-- hasta 13 veces el mismo producto en la misma cuenta.
-- Sin branch_id propio: la sucursal se hereda por sale_id (no se repite en
-- 13 141 filas).
CREATE TABLE detail_sale (
  id              INT NOT NULL AUTO_INCREMENT,
  comanda_folio   VARCHAR(10) NULL,                  -- C·A «foliocomanda» · vacío en 13138/13141
  sale_folio      VARCHAR(10) NOT NULL,              -- C·B «foliocuenta» · llave de cruce
  table_number    VARCHAR(5) NULL,                   -- C·C «orden» = nº de MESA
  waiter_code     VARCHAR(5) NULL,                   -- C·F «mesero»
  product_code    VARCHAR(10) NULL,                  -- C·G «claveproducto»
  description     VARCHAR(60) NULL,                  -- C·I «descripcion»
  source_row      INT NULL,

  quantity        DOUBLE NOT NULL DEFAULT 0,         -- C·J «cantidad» · 0.096061 exige DOUBLE
  discount_percent DOUBLE NOT NULL DEFAULT 0,        -- C·K «descuento» · '20%' -> 20.0
  amount          DOUBLE NOT NULL DEFAULT 0,         -- C·L «importe» · 0.00 es legítimo

  opened_at       DATETIME NULL,                     -- C·D «fechaapertura» (serial Excel)
  closed_at       DATETIME NULL,                     -- C·E «fechacierre»
  captured_at     DATETIME NULL,                     -- C·H «fechadecaptura»
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  sale_id         INT NULL,
  product_id      INT NULL,
  waiter_id       INT NULL,
  import_batch_id INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  KEY idx_detail_sale_sale (sale_id, product_id),
  KEY idx_detail_sale_folio (sale_folio),
  KEY idx_detail_sale_product (product_id),
  KEY idx_detail_sale_waiter (waiter_id),
  KEY idx_detail_sale_batch (import_batch_id),
  CONSTRAINT fk_detail_sale_sale FOREIGN KEY (sale_id)
    REFERENCES sale (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detail_sale_product FOREIGN KEY (product_id)
    REFERENCES product (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_detail_sale_waiter FOREIGN KEY (waiter_id)
    REFERENCES waiter (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_detail_sale_batch FOREIGN KEY (import_batch_id)
    REFERENCES import_batch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── detail_sale_payment ─────────────────────────────────────────────────────
-- Hoja «Pagos», columnas A:H, 3 909 filas.
-- OJO: sale_subtotal / sale_tax / sale_total son del TICKET y se repiten en los
-- 81 tickets multipago. NUNCA se suman. El único monto sumable es `amount`.
CREATE TABLE detail_sale_payment (
  id              INT NOT NULL AUTO_INCREMENT,
  sale_folio      VARCHAR(10) NOT NULL,              -- P·A «Folio» · llave de cruce
  currency        VARCHAR(30) NULL,                  -- P·C «Moneda»
  source_row      INT NULL,

  amount          DOUBLE NOT NULL DEFAULT 0,         -- P·D «Importe» · ÚNICO monto sumable
  exchange_rate   DOUBLE NOT NULL DEFAULT 1,         -- P·E «Tipo de cambio»
  sale_subtotal   DOUBLE NOT NULL DEFAULT 0,         -- P·F del TICKET · NO SUMAR
  sale_tax        DOUBLE NOT NULL DEFAULT 0,         -- P·G del TICKET · NO SUMAR
  sale_total      DOUBLE NOT NULL DEFAULT 0,         -- P·H copia de Importe · NO SUMAR

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  sale_id         INT NULL,
  payment_method_id INT NULL,
  import_batch_id INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  KEY idx_payment_sale (sale_id),
  KEY idx_payment_folio (sale_folio),
  KEY idx_payment_method (payment_method_id),
  KEY idx_payment_batch (import_batch_id),
  CONSTRAINT fk_payment_sale FOREIGN KEY (sale_id)
    REFERENCES sale (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_method FOREIGN KEY (payment_method_id)
    REFERENCES payment_method (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_payment_batch FOREIGN KEY (import_batch_id)
    REFERENCES import_batch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── detail_virtual_ticket ───────────────────────────────────────────────────
-- Renglones puente de la nota generada.
-- description y unit_price son SNAPSHOT: un documento impreso no puede cambiar
-- porque mañana cambie el catálogo.
CREATE TABLE detail_virtual_ticket (
  id              INT NOT NULL AUTO_INCREMENT,
  description     VARCHAR(60) NOT NULL,              -- snapshot de product.name

  quantity        DOUBLE NOT NULL DEFAULT 0,
  unit_price      DOUBLE NOT NULL DEFAULT 0,         -- snapshot de product.price
  amount          DOUBLE NOT NULL DEFAULT 0,         -- quantity * unit_price

  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  virtual_ticket_id INT NOT NULL,
  product_id      INT NULL,
  active          TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  KEY idx_dvt_ticket (virtual_ticket_id),
  KEY idx_dvt_product (product_id),
  CONSTRAINT fk_dvt_ticket FOREIGN KEY (virtual_ticket_id)
    REFERENCES virtual_ticket (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dvt_product FOREIGN KEY (product_id)
    REFERENCES product (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================================
--  4. SEEDS
-- ============================================================================

-- Estado fiscal: los 2 valores medidos en el export (VENCIDO 3565 / FACTURADO 256)
INSERT INTO sale_status (name) VALUES
  ('VENCIDO'),
  ('FACTURADO');

-- Empresa emisora: membrete f1 del export. RFC y domicilio, captura manual.
INSERT INTO company (business_name) VALUES
  ('COMIENDO EN CHIAPAS');

-- Sucursal emisora: membrete f2 y f3. RFC y teléfono son captura manual.
INSERT INTO branch (business_name, fiscal_address, company_id) VALUES
  ('CAFE DE CHIAPAS SUC. POLIFORUM',
   'CALLE BRASIL, NUM 572, COL. EL RETIRO, Tuxtla Gutierrez, Chiapas, Mexico',
   (SELECT id FROM company WHERE business_name = 'COMIENDO EN CHIAPAS'));

-- Formas de pago: los 6 valores medidos, con su conteo del mes de junio.
-- Se amarran a la sucursal recién dada de alta.
SET @branch_id := (SELECT id FROM branch WHERE business_name = 'CAFE DE CHIAPAS SUC. POLIFORUM');

INSERT INTO payment_method (name, is_cash, branch_id) VALUES
  ('EFECTIVO',         1, @branch_id),   -- 1881 pagos · el generador oculta estos tickets
  ('DEBITO',           0, @branch_id),   -- 1233
  ('VISA',             0, @branch_id),   --  678
  ('MASTERCARD',       0, @branch_id),   --   78
  ('AMERICAN EXPRESS', 0, @branch_id),   --   36
  ('TRANSFERENCIA',    0, @branch_id);   --    3
