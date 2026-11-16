-- =============================================================================
-- Rollback: Agente de WhatsApp, propuestas (2026-11-16_whatsapp-propuestas.sql)
-- BD:        fayxzvov_pos
--
-- Quita requested_by, elapsed_ms, error y el indice ix_wa_proposal_message de
-- wa_proposal. Las propuestas se quedan. Las que esten en 'working' o 'failed'
-- pasan a 'discarded' (el codigo de F1/F2 no conoce esos estados).
-- Correrlo DESPUES de quitar el codigo de F3: proponer escribe esas columnas.
-- =============================================================================

UPDATE fayxzvov_pos.wa_proposal SET status = 'discarded' WHERE status IN ('working', 'failed');

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME = 'ix_wa_proposal_message') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP KEY ix_wa_proposal_message');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'error') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN error');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'elapsed_ms') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN elapsed_ms');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'requested_by') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN requested_by');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: ninguna fila --

SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME IN ('requested_by', 'elapsed_ms', 'error');
