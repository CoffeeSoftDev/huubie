-- =============================================================================
-- Rollback: Icono y color de los metodos de pago
-- Fecha:     13/11/2026
-- BD:        fayxzvov_pos
-- Deshace:   2026-11-13_icono-color-metodos-pago.sql
--
-- Quita payment_method.icon y payment_method.color (se pierden los elegidos).
-- Bajar ANTES el codigo que los lee, o la pestana Metodos de pago falla.
-- Se puede volver a correr: cada columna se quita solo si existe.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND COLUMN_NAME = 'color') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.payment_method DROP COLUMN color');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND COLUMN_NAME = 'icon') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.payment_method DROP COLUMN icon');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
