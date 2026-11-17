-- =============================================================================
-- Rollback: Sellos en las tarjetas de lealtad
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Deshace:   2026-11-17_sellos.sql
--
-- Borra la tabla card_stamp (se pierden todos los sellos juntados y canjeados)
-- y las 5 columnas de card_type (los tipos de sellos quedan sin beneficio).
-- Las ventas que canjearon un premio conservan su descuento.
-- Bajar ANTES el codigo que las lee (Lealtad, Vender e Historial), o fallan.
-- Se puede volver a correr: todo se quita solo si existe.
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.card_stamp;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'stamp_icon') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card_type DROP COLUMN stamp_icon');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'stamp_amount') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.card_type DROP COLUMN stamp_amount, DROP COLUMN stamp_goal, DROP COLUMN reward_name, DROP COLUMN reward_value');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
