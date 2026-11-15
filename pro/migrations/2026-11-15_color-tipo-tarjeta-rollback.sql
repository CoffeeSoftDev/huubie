-- =============================================================================
-- Rollback: Color del tipo de tarjeta de lealtad
-- Fecha:     15/11/2026
-- BD:        fayxzvov_pos
-- Deshace:   2026-11-15_color-tipo-tarjeta.sql
--
-- Quita card_type.color (se pierden los colores elegidos).
-- Bajar ANTES el codigo que la lee, o falla la pagina Puntos.
-- Se puede volver a correr: la columna se quita solo si existe.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'color') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card_type DROP COLUMN color');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
