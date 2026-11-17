-- =============================================================================
-- Rollback: Tarjeta digital de lealtad (enlace con QR)
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Deshace:   2026-11-17_tarjeta-digital.sql
--
-- Quita card.token y su indice: todos los enlaces de tarjeta digital dejan de
-- abrir y no se recuperan (un enlace nuevo trae otro token).
-- Bajar ANTES el codigo que la lee, o falla el boton «Tarjeta digital».
-- Se puede volver a correr: indice y columna se quitan solo si existen.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card' AND INDEX_NAME = 'uq_card_token') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card DROP INDEX uq_card_token');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card' AND COLUMN_NAME = 'token') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card DROP COLUMN token');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
