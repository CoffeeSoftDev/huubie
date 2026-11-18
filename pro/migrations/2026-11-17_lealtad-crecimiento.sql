-- =============================================================================
-- Lealtad: registro solo, recuperación, niveles y cumpleaños
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-17_sellos.sql
-- Rollback:  2026-11-17_lealtad-crecimiento-rollback.sql
-- Plan:      pro/app/lealtad/docs/plan-crecimiento.html
--
-- Antes:  la tarjeta la daba de alta el personal; nada salia solo.
-- Despues:
--   customer.birthday           cumpleaños del cliente (NULL = no se sabe)
--   customer.whatsapp_optin_at  cuando acepto recibir mensajes de la tienda
--                               (registro solo, o al mandarle su tarjeta)
--   card_type.level_min_spend   gasto minimo en 12 meses para ese nivel;
--                               NULL = el tipo no es nivel
--   loyalty_setting             ajustes de lealtad, uno por empresa
--   loyalty_signup              el enlace de registro de cada sucursal
--   loyalty_signup_log          cada intento de registro (tope por conexion)
--   loyalty_notice              cada mensaje de lealtad que salio (bienvenida,
--                               regreso, cumple, nivel): de ahi los limites
--   card_level_log              cada cambio de nivel de una tarjeta
--   card_stamp.kind             suma 'regalo' (sellos de cumpleaños); la
--                               columna ya es texto: no cambia
--
-- No toca ningun dato: todo nace apagado y vacio.
-- Se puede volver a correr: columnas, tablas e indices se agregan solo si faltan.
-- customer.birthday guarda el año 2000 (bisiesto, para el 29/02): el año no se pide.
-- IMPORTANTE: correr ANTES de subir el codigo.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'birthday') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.customer
                   ADD COLUMN birthday DATE NULL DEFAULT NULL COMMENT 'cumpleaños; NULL = no se sabe',
                   ADD COLUMN whatsapp_optin_at DATETIME NULL DEFAULT NULL COMMENT 'cuando acepto mensajes de la tienda'");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'level_min_spend') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.card_type ADD COLUMN level_min_spend DECIMAL(12,2) NULL DEFAULT NULL COMMENT 'gasto minimo en 12 meses para este nivel; NULL = no es nivel' AFTER stamp_icon");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.loyalty_setting (
    company_id         INT NOT NULL,
    signup_enabled     TINYINT NOT NULL DEFAULT 0,
    signup_type_id     INT NULL DEFAULT NULL COMMENT 'el tipo de bienvenida',
    winback_enabled    TINYINT NOT NULL DEFAULT 0 COMMENT 'te extrañamos automatico',
    winback_days       INT NOT NULL DEFAULT 30,
    winback_daily_cap  INT NOT NULL DEFAULT 50,
    birthday_enabled   TINYINT NOT NULL DEFAULT 0,
    birthday_stamps    INT NOT NULL DEFAULT 0 COMMENT 'sellos de regalo (tarjeta de sellos)',
    birthday_points    DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '$ de regalo al monedero (tarjeta de puntos)',
    levels_enabled     TINYINT NOT NULL DEFAULT 0,
    levels_reviewed_at DATETIME NULL DEFAULT NULL COMMENT 'ultima revision mensual de niveles',
    updated_user_id    INT NULL DEFAULT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (company_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.loyalty_signup (
    id          INT NOT NULL AUTO_INCREMENT,
    branch_id   INT NOT NULL,
    token       CHAR(32) NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_loyalty_signup_branch (branch_id),
    UNIQUE KEY uq_loyalty_signup_token (token)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.loyalty_signup_log (
    id           INT NOT NULL AUTO_INCREMENT,
    branch_id    INT NOT NULL,
    ip           VARCHAR(45) NOT NULL,
    phone        CHAR(10) NULL DEFAULT NULL,
    customer_id  INT NULL DEFAULT NULL,
    card_id      INT NULL DEFAULT NULL,
    result       VARCHAR(20) NOT NULL COMMENT 'nueva | reenviada | tope | mal',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_loyalty_signup_log_ip (ip, created_at),
    KEY idx_loyalty_signup_log_phone (phone, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.loyalty_notice (
    id           INT NOT NULL AUTO_INCREMENT,
    company_id   INT NOT NULL,
    branch_id    INT NULL DEFAULT NULL,
    customer_id  INT NULL DEFAULT NULL,
    card_id      INT NULL DEFAULT NULL,
    phone        CHAR(10) NOT NULL,
    kind         VARCHAR(12) NOT NULL COMMENT 'bienvenida | regreso | cumple | nivel',
    status       VARCHAR(12) NOT NULL COMMENT 'sent | simulated | failed | skip',
    detail       VARCHAR(255) NULL DEFAULT NULL,
    user_id      INT NULL DEFAULT NULL COMMENT 'NULL = la tarea diaria',
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_loyalty_notice_kind (company_id, kind, created_at),
    KEY idx_loyalty_notice_customer (customer_id, kind)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.card_level_log (
    id            INT NOT NULL AUTO_INCREMENT,
    card_id       INT NOT NULL,
    from_type_id  INT NULL DEFAULT NULL,
    to_type_id    INT NOT NULL,
    spend         DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'gasto de 12 meses al cambiar',
    direction     VARCHAR(6) NOT NULL COMMENT 'sube | baja',
    user_id       INT NULL DEFAULT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_card_level_log_card (card_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- -- Comprobacion --

SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'customer' AND COLUMN_NAME IN ('birthday', 'whatsapp_optin_at'))
      OR (TABLE_NAME = 'card_type' AND COLUMN_NAME = 'level_min_spend'))
ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('loyalty_setting', 'loyalty_signup', 'loyalty_signup_log', 'loyalty_notice', 'card_level_log')
ORDER BY TABLE_NAME;
