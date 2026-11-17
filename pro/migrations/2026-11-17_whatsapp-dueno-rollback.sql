-- =============================================================================
-- Rollback: Agente de WhatsApp, agente del dueño y automatico por tema (2026-11-17_whatsapp-dueno.sql)
-- BD:        fayxzvov_pos
--
-- Quita wa_recipient.can_ask, wa_proposal.kind, auto_sent y topic, y los
-- indices ix_wa_proposal_created e ix_wa_proposal_sent. Los mensajes que ya salieron se quedan en
-- wa_message. Los temas automaticos se borran de wa_agent.auto_topics (la
-- columna es de F1 y se queda).
-- Correrlo DESPUES de quitar el codigo de F6: la bandeja y el cron leen esas columnas.
-- =============================================================================

UPDATE fayxzvov_pos.wa_agent SET auto_topics = NULL;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME = 'ix_wa_proposal_sent') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP KEY ix_wa_proposal_sent');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME = 'ix_wa_proposal_created') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP KEY ix_wa_proposal_created');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'topic') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN topic');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'auto_sent') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN auto_sent');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'kind') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN kind');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_recipient' AND COLUMN_NAME = 'can_ask') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_recipient DROP COLUMN can_ask');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: ninguna fila --

SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'wa_recipient' AND COLUMN_NAME = 'can_ask')
      OR (TABLE_NAME = 'wa_proposal' AND COLUMN_NAME IN ('kind', 'auto_sent', 'topic')));
