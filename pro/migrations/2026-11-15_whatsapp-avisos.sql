-- =============================================================================
-- Avisos de WhatsApp (pedido nuevo, cierre de turno, cierre del dia)
-- Fecha:     15/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada
-- Rollback:  2026-11-15_whatsapp-avisos-rollback.sql
--
-- Tres tablas nuevas. No toca ninguna existente.
-- El proveedor (Green API o UltraMsg) y su token NO van aqui: viven en
-- pro/core/config/.env (WHATSAPP_PROVEEDOR, GREENAPI_*, ULTRAMSG_*).
--
-- wa_notice     la plantilla de cada aviso, una por empresa y tipo.
--   type          order = pedido nuevo · turn = cierre de turno · day = cierre del dia.
--   body          el texto con {variables}. Sin fila = la plantilla de fabrica
--                 (mdl-whatsapp.php :: waDefaults) y el aviso encendido.
--   active        0 = pausado: no sale a nadie.
--
-- wa_recipient  a quien le llega.
--   branch_id     NULL = de todas las sucursales de la empresa.
--   phone         10 digitos, o un grupo (…@g.us).
--   notify_*      que avisos recibe.
--
-- wa_log        cada envio, salga o no.
--   reference     «Pedido P123», «Turno T-0042», «Día 15/11/2026»: el aviso de un
--                 pedido sale una sola vez por referencia.
--   status        sent · failed · simulated (sin proveedor en el .env).
--   error         lo que contesto el proveedor (nunca el token).
--
-- Fechas: created_at y updated_at las escribe PHP.
--
-- Se puede volver a correr: cada tabla se crea solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las tablas falla la pagina
-- WhatsApp. El cierre de turno, el cierre del dia y el cobro NO fallan: el aviso
-- atrapa su error y lo deja en el log.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_notice (
    id               INT(11)      NOT NULL AUTO_INCREMENT,
    company_id       INT(11)      NOT NULL,
    type             VARCHAR(10)  NOT NULL,
    body             TEXT         NOT NULL,
    active           TINYINT(4)   NOT NULL DEFAULT 1,
    updated_user_id  INT(11)      NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wa_notice (company_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_recipient (
    id            INT(11)      NOT NULL AUTO_INCREMENT,
    company_id    INT(11)      NOT NULL,
    branch_id     INT(11)      NULL,
    name          VARCHAR(80)  NOT NULL,
    phone         VARCHAR(40)  NOT NULL,
    notify_order  TINYINT(4)   NOT NULL DEFAULT 1,
    notify_turn   TINYINT(4)   NOT NULL DEFAULT 1,
    notify_day    TINYINT(4)   NOT NULL DEFAULT 1,
    active        TINYINT(4)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_wa_recipient_company (company_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_log (
    id            INT(11)      NOT NULL AUTO_INCREMENT,
    company_id    INT(11)      NOT NULL,
    branch_id     INT(11)      NULL,
    type          VARCHAR(10)  NOT NULL,
    reference     VARCHAR(80)  NOT NULL DEFAULT '',
    recipient_id  INT(11)      NULL,
    phone         VARCHAR(60)  NOT NULL DEFAULT '',
    provider      VARCHAR(12)  NOT NULL DEFAULT '',
    status        VARCHAR(10)  NOT NULL,
    error         VARCHAR(255) NULL,
    body          TEXT         NULL,
    user_id       INT(11)      NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_wa_log_company (company_id, created_at),
    KEY ix_wa_log_reference (company_id, type, reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -- Comprobacion --

SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('wa_notice', 'wa_recipient', 'wa_log');
