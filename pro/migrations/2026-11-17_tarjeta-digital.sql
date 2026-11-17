-- =============================================================================
-- Tarjeta digital de lealtad (enlace con QR)
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-15_lealtad-modulo-propio.sql
-- Rollback:  2026-11-17_tarjeta-digital-rollback.sql
--
-- Antes:  la tarjeta solo existia en plastico.
-- Despues card.token  32 caracteres hex (random_bytes) del enlace publico
--                     app/lealtad/tarjeta.php?t=<token>, que abre la tarjeta
--                     en el telefono del cliente con su QR. NULL = sin enlace.
--         Indice unico uq_card_token: dos tarjetas nunca comparten enlace.
--
-- No toca ningun dato: todas las tarjetas quedan sin enlace (NULL). El enlace
-- nace la primera vez que alguien con permiso lo pide en Lealtad › Tarjetas.
-- Cambiar el enlace = token nuevo: el anterior deja de abrir.
--
-- Se puede volver a correr: columna e indice se agregan solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo. Sin la columna, el boton
-- «Tarjeta digital» falla; la lista, los tipos y Vender no la leen.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card' AND COLUMN_NAME = 'token') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.card ADD COLUMN token CHAR(32) NULL DEFAULT NULL COMMENT 'enlace de la tarjeta digital; NULL = sin enlace' AFTER number");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card' AND INDEX_NAME = 'uq_card_token') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card ADD UNIQUE INDEX uq_card_token (token)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion --

SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card' AND COLUMN_NAME = 'token';
