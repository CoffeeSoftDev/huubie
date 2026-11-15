-- =============================================================================
-- Portal del cliente con comprobantes
-- Fecha:     15/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-15_tienda-en-linea.sql (el portal lee online_store para
--            el color, el WhatsApp y los datos bancarios de la tienda)
-- Rollback:  2026-11-15_portal-clientes-rollback.sql
--
-- Dos tablas nuevas. No toca ninguna existente.
--
-- customer_portal   el enlace de UN cliente en UNA sucursal.
--   token             lo que va en el enlace publico: app/order/portal.php?t=<token>.
--                     32 caracteres hexadecimales. «Nuevo enlace» lo cambia y el
--                     anterior deja de abrir.
--   La fila nace la primera vez que alguien pide el enlace en Clientes.
--
-- customer_receipt  cada comprobante que sube el cliente.
--   sale_id           el folio al que dice que corresponde. NULL = «a lo que
--                     debo»: se reparte del mas viejo al mas nuevo.
--   amount            lo que el cliente dice que transfirio.
--   file              ruta dentro de pro/storage/receipts: <branch_id>/<32 hex>.<ext>.
--                     La carpeta no se sirve por web: el archivo solo sale por
--                     app/order/ctrl/comprobante.php, con sesion y permiso.
--   status            pending  en revision
--                     applied  abonado: hay pagos con «Comprobante C<id>» en su
--                              descripcion; applied_amount, payment_method_id y
--                              turn_id dicen cuanto, con que y en que turno.
--                     rejected rechazado: reject_reason lo ve el cliente.
--   ip                la conexion que lo subio (limite de 10 por hora).
--
-- Fechas: created_at, updated_at y reviewed_at las escribe PHP, con la misma
-- hora que usa el resto del modulo.
--
-- Se puede volver a correr: cada tabla se crea solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las tablas fallan el enlace
-- publico y el boton «Comprobantes» de Clientes. Pedidos, Vender e Historial
-- no las leen.
-- Ademas: la carpeta pro/storage/receipts debe existir y PHP debe poder
-- escribir en ella (viaja en el repo con su .htaccess, sin los archivos).
-- =============================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_pos.customer_portal (
    id            INT(11)      NOT NULL AUTO_INCREMENT,
    customer_id   INT(11)      NOT NULL,
    branch_id     INT(11)      NOT NULL,
    token         CHAR(32)     NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_portal (customer_id, branch_id),
    UNIQUE KEY uq_customer_portal_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.customer_receipt (
    id                 INT(11)        NOT NULL AUTO_INCREMENT,
    customer_id        INT(11)        NOT NULL,
    branch_id          INT(11)        NOT NULL,
    sale_id            INT(11)        NULL,
    amount             DECIMAL(12,2)  NOT NULL,
    note               VARCHAR(255)   NULL,
    file               VARCHAR(64)    NOT NULL,
    file_name          VARCHAR(150)   NOT NULL DEFAULT '',
    mime               VARCHAR(40)    NOT NULL,
    size               INT(11)        NOT NULL DEFAULT 0,
    status             VARCHAR(10)    NOT NULL DEFAULT 'pending',
    reject_reason      VARCHAR(255)   NULL,
    applied_amount     DECIMAL(12,2)  NULL,
    payment_method_id  INT(11)        NULL,
    turn_id            INT(11)        NULL,
    reviewed_user_id   INT(11)        NULL,
    reviewed_at        DATETIME       NULL,
    ip                 VARCHAR(45)    NOT NULL DEFAULT '',
    created_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_customer_receipt_branch (branch_id, status, created_at),
    KEY ix_customer_receipt_customer (customer_id, branch_id, status),
    KEY ix_customer_receipt_ip (ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -- Comprobacion --

SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('customer_portal', 'customer_receipt');
