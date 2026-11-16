-- =============================================================================
-- Agente de WhatsApp: entrada de mensajes (F1 del plan)
-- Fecha:     16/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  nada. Las tablas de avisos (wa_notice, wa_recipient, wa_log) no se tocan.
-- Rollback:  2026-11-16_whatsapp-agente-rollback.sql
-- Plan:      pro/app/order/docs/plan-agente-whatsapp.html
--
-- Cinco tablas nuevas. No toca ninguna existente.
-- El secreto de la app y el token de verificacion de Meta NO van aqui: viven en
-- pro/core/config/.env (WHATSAPP_META_APP_SECRET, WHATSAPP_META_VERIFY_TOKEN).
--
-- wa_agent          el numero de WhatsApp de cada empresa (uno por empresa).
--   phone_number_id   el id que Meta manda en cada mensaje (metadata.phone_number_id).
--                     Es lo unico que dice de que empresa es el mensaje: un numero
--                     sin fila aqui se ignora (el webhook contesta 200 y lo apunta
--                     en core/helpers/whatsapp.log).
--   display_phone     el numero como se ve; solo para mostrarlo.
--   enabled           0 = el agente no contesta nada. Los mensajes se guardan igual.
--   hours             JSON por dia, 0 = domingo ... 6 = sabado, con tramos:
--                     {"1":[["09:00","20:00"]], ...}. NULL o un dia sin tramos =
--                     ese dia no atiende: fuera de horario no sale nada.
--   catalog_mode      store = el catalogo de Tienda en linea (in_catalog) ·
--                     own = la lista de wa_agent_product.
--   auto_topics       temas que salen sin pasar por la bandeja, separados por coma
--                     (F6). NULL = todo va a la bandeja como propuesta.
--   hourly_cap        tope de respuestas del agente por chat por hora.
--
-- wa_agent_product  el catalogo propio del agente (catalog_mode = own).
--   product_id        fayxzvov_pos.product.
--
-- wa_chat           una conversacion por empresa y telefono.
--   branch_id         la sucursal que eligio el cliente en el menu (F2). NULL = aun no.
--   phone             10 digitos si es de Mexico (Meta manda 521 + 10); de otro
--                     pais, el numero completo.
--   wa_id             el numero tal como lo manda Meta.
--   name              el nombre del perfil de WhatsApp del cliente.
--   customer_id       el cliente de Huubie, cuando se ligue (F3).
--   mode              agent = contesta el agente · human = atiende una persona.
--   human_until       hasta cuando atiende la persona; despues vuelve el agente.
--   opt_out           1 = el cliente pidio BAJA: no se le manda nada.
--   last_in_at        el ultimo mensaje DEL CLIENTE: abre la ventana de 24 h de Meta.
--   last_message_at   el ultimo mensaje de cualquiera de los dos: ordena la bandeja.
--
-- wa_message        cada mensaje que entra o sale.
--   direction         in = del cliente · out = de Huubie.
--   provider_id       el wamid de Meta. UNICO: un mensaje que Meta reintenta se
--                     guarda una sola vez. Compara exacto (utf8mb4_bin) porque el
--                     wamid distingue mayusculas.
--   type              text, image, audio, video, document, sticker, location,
--                     interactive, button, reaction, contacts...
--   body              el texto; en foto, video o documento, su pie (caption).
--   media_id          el id del archivo en Meta. Se baja a media_path en F2.
--   status            in: received · out: sent, delivered, read, failed, simulated.
--   user_id           quien lo mando desde la bandeja (out). NULL = el agente.
--   sent_at           cuando lo mando el cliente (la hora de Meta) o cuando salio.
--   raw               el mensaje como llego de Meta, en JSON.
--
-- wa_proposal       la respuesta que propone el agente (F3).
--   tools_used        JSON con las herramientas que consulto.
--   status            pending · sent · edited · discarded.
--   sent_message_id   el wa_message que salio, si se mando.
--
-- Fechas: created_at y updated_at las escribe PHP.
--
-- Se puede volver a correr: cada tabla se crea solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las tablas el webhook contesta
-- 500 y Meta reintenta el aviso hasta 7 dias.
-- Despues: dar de alta el numero de cada empresa ANTES de suscribir el webhook
-- en Meta (hasta que exista la pantalla, F2):
--   INSERT INTO fayxzvov_pos.wa_agent (company_id, phone_number_id, display_phone)
--   VALUES (<id de la empresa>, '<phone_number_id de Meta>', '<numero visible>');
-- =============================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_agent (
    id               INT(11)      NOT NULL AUTO_INCREMENT,
    company_id       INT(11)      NOT NULL,
    phone_number_id  VARCHAR(32)  NOT NULL,
    display_phone    VARCHAR(30)  NULL,
    enabled          TINYINT(4)   NOT NULL DEFAULT 0,
    hours            TEXT         NULL,
    catalog_mode     VARCHAR(10)  NOT NULL DEFAULT 'store',
    auto_topics      VARCHAR(255) NULL,
    hourly_cap       INT(11)      NOT NULL DEFAULT 20,
    updated_user_id  INT(11)      NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wa_agent_company (company_id),
    UNIQUE KEY uq_wa_agent_number (phone_number_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_agent_product (
    id          INT(11)   NOT NULL AUTO_INCREMENT,
    company_id  INT(11)   NOT NULL,
    product_id  INT(11)   NOT NULL,
    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wa_agent_product (company_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_chat (
    id               INT(11)      NOT NULL AUTO_INCREMENT,
    company_id       INT(11)      NOT NULL,
    branch_id        INT(11)      NULL,
    phone            VARCHAR(20)  NOT NULL,
    wa_id            VARCHAR(64)  NOT NULL,
    name             VARCHAR(120) NOT NULL DEFAULT '',
    customer_id      INT(11)      NULL,
    mode             VARCHAR(10)  NOT NULL DEFAULT 'agent',
    human_until      DATETIME     NULL,
    opt_out          TINYINT(4)   NOT NULL DEFAULT 0,
    last_in_at       DATETIME     NULL,
    last_message_at  DATETIME     NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wa_chat (company_id, phone),
    KEY ix_wa_chat_recent (company_id, last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_message (
    id           INT(11)      NOT NULL AUTO_INCREMENT,
    chat_id      INT(11)      NOT NULL,
    direction    VARCHAR(3)   NOT NULL,
    provider_id  VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
    type         VARCHAR(20)  NOT NULL DEFAULT 'text',
    body         TEXT         NULL,
    media_id     VARCHAR(64)  NULL,
    media_type   VARCHAR(80)  NULL,
    media_path   VARCHAR(255) NULL,
    status       VARCHAR(12)  NOT NULL,
    error        VARCHAR(255) NULL,
    user_id      INT(11)      NULL,
    sent_at      DATETIME     NOT NULL,
    raw          TEXT         NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wa_message_provider (provider_id),
    KEY ix_wa_message_chat (chat_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_proposal (
    id               INT(11)      NOT NULL AUTO_INCREMENT,
    chat_id          INT(11)      NOT NULL,
    message_id       INT(11)      NOT NULL,
    body             TEXT         NOT NULL,
    tools_used       TEXT         NULL,
    status           VARCHAR(10)  NOT NULL DEFAULT 'pending',
    sent_message_id  INT(11)      NULL,
    decided_by       INT(11)      NULL,
    decided_at       DATETIME     NULL,
    model            VARCHAR(60)  NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_wa_proposal_chat (chat_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -- Comprobacion --

SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('wa_agent', 'wa_agent_product', 'wa_chat', 'wa_message', 'wa_proposal');
