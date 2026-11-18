-- =============================================================================
-- Rollback: Lealtad: registro solo, recuperación, niveles y cumpleaños
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Deshace:   2026-11-17_lealtad-crecimiento.sql
--
-- Borra los ajustes, los enlaces de registro, la bitacora de mensajes y la de
-- niveles, y las columnas nuevas (se pierden los cumpleaños y los consentimientos).
-- Las tarjetas creadas por el registro y sus clientes se quedan. Los sellos de
-- regalo ('regalo') se quedan en card_stamp.
-- Bajar ANTES el codigo que las lee.
-- Se puede volver a correr: todo se quita solo si existe.
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.card_level_log;
DROP TABLE IF EXISTS fayxzvov_pos.loyalty_notice;
DROP TABLE IF EXISTS fayxzvov_pos.loyalty_signup_log;
DROP TABLE IF EXISTS fayxzvov_pos.loyalty_signup;
DROP TABLE IF EXISTS fayxzvov_pos.loyalty_setting;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'level_min_spend') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card_type DROP COLUMN level_min_spend');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'customer' AND COLUMN_NAME = 'birthday') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.customer DROP COLUMN birthday, DROP COLUMN whatsapp_optin_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
