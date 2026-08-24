-- ============================================================================
--  Migracion 05 — los cajones que Wansoft necesita
--
--  El esquema se diseño leyendo un export de Soft Restaurant, que reporta el
--  ticket como documento fiscal: folio, codigo de facturacion, IVA por cuenta,
--  vencimiento. Wansoft reporta la misma cena como operacion de piso: quien
--  atendio, quien cobro, en que terminal, cuanta propina.
--
--  Esta migracion abre los cajones del segundo sin cerrar los del primero. Es
--  ADITIVA: no borra ni una fila, no estrecha ni un tipo, y las dos columnas que
--  cambian de restriccion solo se AFLOJAN (NOT NULL -> NULL, VARCHAR(5) -> (20)),
--  que nunca pierde datos.
--
--  El resultado son dos zonas de nulos simetricas y eso es correcto: cuando carga
--  Soft Restaurant quedan vacias propina, cajero y terminal; cuando carga Wansoft
--  quedan vacias billing_code, expires_at e invoice_series. Cada POS solo puede
--  decir lo que vio.
--
--  Convenciones aplicadas (coffee/docs/db-patterns/db-rules.md):
--    · §2.1 singular, snake_case, ingles. `detail_` solo para movimiento de raiz
--    · §2.3 id + active + created_at + updated_at en toda tabla persistente
--    · §3.1 orden: negocio -> montos -> fechas -> timestamps -> FKs -> active
--    · §4   montos en DOUBLE, banderas en TINYINT
--    · §5   FK con CONSTRAINT + KEY
--
--  La collation sigue la del esquema (utf8mb4_general_ci) y no la de db-rules:
--  mezclar collations rompe los JOIN contra las tablas que ya existen.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-05-wansoft-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- ---------------------------------------------------------------------------
--  0. Helpers
--
--  MySQL 8 no tiene ADD COLUMN IF NOT EXISTS (eso es MariaDB), asi que la
--  idempotencia se resuelve preguntandole a information_schema antes de tocar
--  nada. Los tres procedimientos se borran al final: son andamio, no esquema.
-- ---------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS addColumnIfMissing;
DROP PROCEDURE IF EXISTS addIndexIfMissing;
DROP PROCEDURE IF EXISTS addForeignKeyIfMissing;

DELIMITER $$

CREATE PROCEDURE addColumnIfMissing(
    IN tableName  VARCHAR(64),
    IN columnName VARCHAR(64),
    IN definition VARCHAR(500)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = tableName
           AND COLUMN_NAME  = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tableName, '` ADD COLUMN `', columnName, '` ', definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE addIndexIfMissing(
    IN tableName VARCHAR(64),
    IN indexName VARCHAR(64),
    IN definition VARCHAR(500)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = tableName
           AND INDEX_NAME   = indexName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tableName, '` ADD ', definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE addForeignKeyIfMissing(
    IN tableName VARCHAR(64),
    IN fkName    VARCHAR(64),
    IN definition VARCHAR(500)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA    = DATABASE()
           AND TABLE_NAME      = tableName
           AND CONSTRAINT_NAME = fkName
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', tableName, '` ADD CONSTRAINT `', fkName, '` ', definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- ============================================================================
--  1. CATALOGOS NUEVOS
-- ============================================================================

-- ── sale_operation_status ───────────────────────────────────────────────────
-- El eje OPERATIVO del ticket, que no es el fiscal.
--
-- `sale_status` responde "¿ya se facturo?" (VENCIDO / FACTURADO). Wansoft
-- responde otra cosa: "¿esta pagada?" (Pagada / Cancelada). Son dos preguntas
-- distintas y meterlas en la misma columna haria imposible la unica que importa
-- de verdad: cuantas PAGADAS siguen SIN FACTURAR.
--
-- Seed fijo de 4 filas: se dan de alta una vez y no se editan, por eso no lleva
-- timestamps (misma desviacion consciente de §2.3 que ya tiene sale_status).
CREATE TABLE IF NOT EXISTS sale_operation_status (
  id      INT NOT NULL AUTO_INCREMENT,
  name    VARCHAR(20) NOT NULL,               -- D·G «Estatus» verbatim
  active  TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sale_operation_status_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── cashier ─────────────────────────────────────────────────────────────────
-- Quien cobro. Rol distinto al mesero: uno atiende la mesa, otro cierra la
-- cuenta, y en el export del 22 de agosto son personas distintas en cada fila.
--
-- Gemela de `waiter` a proposito. Unificar las dos en un `staff` con rol seria
-- mas elegante, pero obliga a migrar las 13 141 filas de detail_sale que ya
-- cuelgan de waiter_id. La gemela es aditiva: cero riesgo sobre lo que funciona.
--
-- `code` admite NULL porque Wansoft no lo manda: la llave real es el nombre.
CREATE TABLE IF NOT EXISTS cashier (
  id          INT NOT NULL AUTO_INCREMENT,
  code        VARCHAR(20) NULL,               -- ningun POS medido lo manda todavia
  name        VARCHAR(150) NOT NULL,          -- D·I «Cajero»
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  branch_id   INT NULL,
  active      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_cashier_name (name, branch_id),
  KEY idx_cashier_branch (branch_id),
  CONSTRAINT fk_cashier_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================================
--  2. TABLAS VIVAS QUE ABREN CAJON
-- ============================================================================

-- ── sale ────────────────────────────────────────────────────────────────────
--
-- `billing_code` pasa a admitir NULL: Wansoft no tiene codigo de facturacion y
-- con NOT NULL la primera fila revienta el INSERT y no entra ninguna. El UNIQUE
-- (billing_code, branch_id) NO se toca: MySQL permite varios NULL en un UNIQUE,
-- asi que sigue bloqueando duplicados reales sin estorbar a Wansoft.
--
-- `pdv_movement` es el identificador estable del ticket en Wansoft (6266, 6267…)
-- y es el que se copia a `folio`. La «Orden» del dia va en `order_number` y NO
-- puede ser el folio: reinicia en 1 cada dia y chocaria con uk_sale_folio en la
-- segunda carga.

CALL addColumnIfMissing('sale', 'pdv_movement',
    "VARCHAR(20) NULL COMMENT 'Wansoft · Movimiento PDV' AFTER billing_code");

CALL addColumnIfMissing('sale', 'order_number',
    "INT NULL COMMENT 'Wansoft · Orden del dia, reinicia cada dia' AFTER pdv_movement");

CALL addColumnIfMissing('sale', 'guest_count',
    "INT NULL COMMENT 'comensales' AFTER invoice_series");

CALL addColumnIfMissing('sale', 'operation_status_id',
    "INT NULL COMMENT 'eje operativo' AFTER sale_status_id");

CALL addColumnIfMissing('sale', 'waiter_id',
    "INT NULL COMMENT 'mesero a nivel cuenta' AFTER operation_status_id");

CALL addColumnIfMissing('sale', 'cashier_id',
    "INT NULL COMMENT 'cajero que cerro' AFTER waiter_id");

ALTER TABLE sale MODIFY COLUMN billing_code VARCHAR(30) NULL;

CALL addIndexIfMissing('sale', 'idx_sale_pdv',            'KEY idx_sale_pdv (pdv_movement, branch_id)');
CALL addIndexIfMissing('sale', 'idx_sale_operation_status','KEY idx_sale_operation_status (operation_status_id)');
CALL addIndexIfMissing('sale', 'idx_sale_waiter',         'KEY idx_sale_waiter (waiter_id)');
CALL addIndexIfMissing('sale', 'idx_sale_cashier',        'KEY idx_sale_cashier (cashier_id)');

CALL addForeignKeyIfMissing('sale', 'fk_sale_operation_status',
    'FOREIGN KEY (operation_status_id) REFERENCES sale_operation_status (id) ON DELETE SET NULL ON UPDATE CASCADE');

CALL addForeignKeyIfMissing('sale', 'fk_sale_waiter',
    'FOREIGN KEY (waiter_id) REFERENCES waiter (id) ON DELETE SET NULL ON UPDATE CASCADE');

CALL addForeignKeyIfMissing('sale', 'fk_sale_cashier',
    'FOREIGN KEY (cashier_id) REFERENCES cashier (id) ON DELETE SET NULL ON UPDATE CASCADE');


-- ── detail_sale_payment ─────────────────────────────────────────────────────
--
-- La tabla que mas crece: todo el rastro de cobro que Wansoft reporta y el
-- reporte de Soft Restaurant nunca anoto.
--
-- `tip` es el hueco mas grande que tenia el esquema: 1 526.04 de propina en un
-- solo dia sin ningun lugar donde caer. Va en el PAGO y no en la venta porque
-- ahi es dato de origen (Wansoft la reporta por pago, columna Q); en `sale`
-- seria un rollup derivable.
--
-- «Total Cobrado» (columna R) NO se guarda: es amount + tip, exacto en las 38
-- filas medidas. Lo derivado no ocupa columna.

CALL addColumnIfMissing('detail_sale_payment', 'terminal',
    "VARCHAR(30) NULL COMMENT 'Wansoft · Terminal' AFTER currency");

CALL addColumnIfMissing('detail_sale_payment', 'reference',
    "VARCHAR(30) NULL COMMENT 'Wansoft · Referencia' AFTER terminal");

CALL addColumnIfMissing('detail_sale_payment', 'transaction_code',
    "VARCHAR(30) NULL COMMENT 'Wansoft · Transaccion' AFTER reference");

CALL addColumnIfMissing('detail_sale_payment', 'validation_code',
    "VARCHAR(30) NULL COMMENT 'Wansoft · Codigo de validacion' AFTER transaction_code");

CALL addColumnIfMissing('detail_sale_payment', 'tip',
    "DOUBLE NOT NULL DEFAULT 0 COMMENT 'Wansoft · Propina del pago' AFTER amount");

CALL addColumnIfMissing('detail_sale_payment', 'paid_at',
    "DATETIME NULL COMMENT 'Wansoft · Fecha de pago' AFTER sale_total");


-- ── waiter ──────────────────────────────────────────────────────────────────
--
-- Soft Restaurant manda un codigo de 2 o 3 digitos y ningun nombre; Wansoft
-- manda el nombre completo y ningun codigo. La tabla tiene que aceptar las dos
-- formas de identificar a la misma persona.
--
-- El UNIQUE por nombre es lo que sostiene el cruce de Wansoft: con `code` en
-- NULL el uk_waiter_code deja de bloquear nada (MySQL permite varios NULL) y
-- dos cargas del mismo mes crearian dos «DANIEL ZEBADUA».
--
-- La collation utf8mb4_general_ci ignora mayusculas y acentos, asi que «RAMON»
-- y «Ramon» se cruzan solos. Lo que si crea duplicados es un espacio de mas: el
-- importador debe limpiar el nombre antes de sembrarlo.

ALTER TABLE waiter MODIFY COLUMN code VARCHAR(20) NULL;

CALL addIndexIfMissing('waiter', 'uk_waiter_name', 'UNIQUE KEY uk_waiter_name (name, branch_id)');


-- ── branch ──────────────────────────────────────────────────────────────────
--
-- La hoja «Propinas por mesero» reporta comision sobre propina y hoy ese dato no
-- vive en ninguna parte. El DEFAULT 0 refleja lo medido en el export (los 6
-- meseros van en cero), no una suposicion.

CALL addColumnIfMissing('branch', 'tip_commission_rate',
    "DOUBLE NOT NULL DEFAULT 0 COMMENT 'comision sobre propina, %' AFTER phone");


-- ============================================================================
--  3. DETALLES NUEVOS
-- ============================================================================

-- ── detail_sale_payment_card ────────────────────────────────────────────────
-- El rastro bancario del pago con tarjeta. Movimiento anidado de la raiz, por
-- eso conserva el prefijo `detail_` (§2.1).
--
-- UNA tabla para las DOS hojas de terminal. «Pagos por terminal bancaria» y «Can
-- y Dev por terminal bancaria» traen las mismas columnas menos una, y la
-- cancelacion es la misma operacion con signo contrario: las distingue
-- `is_refund`, no una tabla gemela.
--
-- Banco, tipo de tarjeta y tipo de operacion MERECEN catalogo, pero las tres
-- hojas bancarias del export vinieron VACIAS: no hay un solo valor real medido.
-- Entran como replica literal de la hoja —igual que detail_sale replica
-- comandas.xls— y se promueven a catalogo cuando llegue un export con tarjetas
-- cobradas de verdad. Adivinar un catalogo es peor que posponerlo.
CREATE TABLE IF NOT EXISTS detail_sale_payment_card (
  id                  INT NOT NULL AUTO_INCREMENT,
  pdv_order           VARCHAR(20) NULL,        -- T·Orden
  pdv_order_id        VARCHAR(30) NULL,        -- T·OrdenId
  transaction_code    VARCHAR(30) NULL,        -- T·Transaccion
  authorization_code  VARCHAR(30) NULL,        -- T·Numero de autorizacion
  arqc                VARCHAR(40) NULL,        -- T·ARQC · criptograma EMV
  terminal            VARCHAR(30) NULL,        -- T·Terminal
  apn                 VARCHAR(60) NULL,        -- T·APN
  pinpad_type         VARCHAR(30) NULL,        -- T·Tipo pinPad
  operation_type      VARCHAR(30) NULL,        -- T·Tipo operacion · candidato a catalogo
  bank                VARCHAR(60) NULL,        -- T·Banco · candidato a catalogo
  card_type           VARCHAR(30) NULL,        -- T·Tipo tarjeta · candidato a catalogo
  card_number         VARCHAR(25) NULL,        -- T·Numero de tarjeta · enmascarado
  response_message    VARCHAR(120) NULL,       -- T·Mensaje de respuesta
  is_prepaid          TINYINT NOT NULL DEFAULT 0,  -- T·Pago Anticipado
  is_refund           TINYINT NOT NULL DEFAULT 0,  -- 1 = hoja «Can y Dev»

  amount              DOUBLE NOT NULL DEFAULT 0,   -- T·Monto

  operation_date      DATETIME NULL,           -- T·Fecha operacion
  authorized_at       DATETIME NULL,           -- T·Fecha de autorizacion
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  sale_payment_id     INT NULL,
  import_batch_id     INT NULL,
  active              TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  KEY idx_card_payment (sale_payment_id),
  KEY idx_card_order (pdv_order),
  KEY idx_card_refund (is_refund, active),
  KEY idx_card_batch (import_batch_id),
  CONSTRAINT fk_card_payment FOREIGN KEY (sale_payment_id)
    REFERENCES detail_sale_payment (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_card_batch FOREIGN KEY (import_batch_id)
    REFERENCES import_batch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── deleted_sale_payment ────────────────────────────────────────────────────
-- Bitacora de pagos borrados en el POS (hoja «Pagos Eliminados»).
--
-- Va SIN prefijo `detail_` a proposito: no es el renglon de una transaccion viva
-- —el pago que describe ya no existe— sino el registro de un evento. Por eso
-- tampoco cuelga de `sale`: se ancla a la sucursal.
--
-- `modified_by` es texto y no FK: el usuario que borro es del POS, no de Huubie,
-- y no tiene fila en ningun catalogo nuestro.
CREATE TABLE IF NOT EXISTS deleted_sale_payment (
  id                INT NOT NULL AUTO_INCREMENT,
  pdv_order         VARCHAR(20) NULL,          -- E·Orden
  terminal          VARCHAR(30) NULL,          -- E·Terminal
  modified_by       VARCHAR(150) NULL,         -- E·Usuario Modifica

  amount            DOUBLE NOT NULL DEFAULT 0, -- E·Total
  tip               DOUBLE NOT NULL DEFAULT 0, -- E·Propina

  operation_date    DATETIME NULL,             -- E·Fecha de operacion
  registered_at     DATETIME NULL,             -- E·Fecha registro
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  waiter_id         INT NULL,
  cashier_id        INT NULL,
  payment_method_id INT NULL,
  branch_id         INT NULL,
  import_batch_id   INT NULL,
  active            TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  KEY idx_deleted_payment_branch (branch_id, operation_date),
  KEY idx_deleted_payment_waiter (waiter_id),
  KEY idx_deleted_payment_cashier (cashier_id),
  KEY idx_deleted_payment_method (payment_method_id),
  KEY idx_deleted_payment_batch (import_batch_id),
  CONSTRAINT fk_deleted_payment_waiter FOREIGN KEY (waiter_id)
    REFERENCES waiter (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_deleted_payment_cashier FOREIGN KEY (cashier_id)
    REFERENCES cashier (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_deleted_payment_method FOREIGN KEY (payment_method_id)
    REFERENCES payment_method (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_deleted_payment_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_deleted_payment_batch FOREIGN KEY (import_batch_id)
    REFERENCES import_batch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ── daily_sale_summary ──────────────────────────────────────────────────────
-- El bloque de resumen del reporte (filas 8-12 de la hoja de detalle).
--
-- Aqui va SOLO lo que no se puede derivar de las ventas cargadas: comensales,
-- cortesias y platillos cancelados son conteos que el POS calcula y que ningun
-- renglon nuestro reconstruye. Los promedios (venta por mesa, venta por persona)
-- NO se guardan: salen de dividir.
--
-- El UNIQUE por dia y sucursal es lo que hace que recargar el mismo dia
-- reemplace en vez de acumular, igual que el resto del modulo de cargas.
CREATE TABLE IF NOT EXISTS daily_sale_summary (
  id                    INT NOT NULL AUTO_INCREMENT,
  order_count           INT NOT NULL DEFAULT 0,   -- No. ordenes
  guest_count           INT NOT NULL DEFAULT 0,   -- No. Personas
  courtesy_count        INT NOT NULL DEFAULT 0,   -- Cortesias completas
  free_dish_count       INT NOT NULL DEFAULT 0,   -- Platillos gratis
  cancelled_dish_count  INT NOT NULL DEFAULT 0,   -- Platillos cancelados
  cancelled_sale_count  INT NOT NULL DEFAULT 0,   -- Ventas canceladas

  subtotal              DOUBLE NOT NULL DEFAULT 0,
  tax                   DOUBLE NOT NULL DEFAULT 0,
  total                 DOUBLE NOT NULL DEFAULT 0,
  tip                   DOUBLE NOT NULL DEFAULT 0,
  courtesy_total        DOUBLE NOT NULL DEFAULT 0,
  cancellation_total    DOUBLE NOT NULL DEFAULT 0,

  operation_date        DATE NOT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  branch_id             INT NULL,
  import_batch_id       INT NULL,
  active                TINYINT NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  UNIQUE KEY uk_daily_summary (operation_date, branch_id),
  KEY idx_daily_summary_branch (branch_id),
  KEY idx_daily_summary_batch (import_batch_id),
  CONSTRAINT fk_daily_summary_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_daily_summary_batch FOREIGN KEY (import_batch_id)
    REFERENCES import_batch (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ============================================================================
--  4. SEEDS
-- ============================================================================

-- Estado operativo: los 4 valores que el modulo necesita distinguir. «Pagada» es
-- el unico que aparece en el export medido (las 38 filas); «Eliminada» lo exige
-- la hoja de pagos eliminados y «Abierta» la cuenta que todavia no cierra.
INSERT INTO sale_operation_status (name) VALUES
  ('Abierta'),
  ('Pagada'),
  ('Cancelada'),
  ('Eliminada')
ON DUPLICATE KEY UPDATE name = VALUES(name);


-- Formas de pago de Wansoft.
--
-- Esto NO es cosmetico: `sinEfectivo()` del modulo de tickets filtra con
-- UPPER(pm.name) <> 'EFECTIVO', y con payment_method_id en NULL esa comparacion
-- devuelve NULL en vez de TRUE. La venta desapareceria del listado Y del
-- reparto. Sin este seed, los pagos con tarjeta —el 42 % del dia medido— no
-- existirian para el modulo.
--
-- Se guarda SIN acento porque asi lo deja la normalizacion del importador:
-- strtoupper() no es multibyte y «Tarjeta de credito» quedaria «TARJETA DE
-- CRéDITO», que no empata con nada.
--
-- 'EFECTIVO' ya existe para esta sucursal desde el DDL original y el
-- ON DUPLICATE lo respeta.
SET @branch_id := (SELECT id FROM branch WHERE business_name = 'CAFE DE CHIAPAS SUC. POLIFORUM' LIMIT 1);

-- Solo se siembra lo MEDIDO. El export del 22 de agosto trae dos formas de pago
-- y nada mas: «Efectivo» (17 pagos) y «Tarjeta de credito» (21 pagos). Cuando
-- aparezca una tercera en un export real se agrega aqui; inventarla ahora seria
-- llenar el catalogo de valores que quiza el POS nunca escribe asi.
INSERT INTO payment_method (name, is_cash, branch_id) VALUES
  ('TARJETA DE CREDITO', 0, @branch_id)
ON DUPLICATE KEY UPDATE is_cash = VALUES(is_cash);


-- ---------------------------------------------------------------------------
--  Andamio fuera
-- ---------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS addColumnIfMissing;
DROP PROCEDURE IF EXISTS addIndexIfMissing;
DROP PROCEDURE IF EXISTS addForeignKeyIfMissing;
