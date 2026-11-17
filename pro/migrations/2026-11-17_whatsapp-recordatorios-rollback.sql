-- =============================================================================
-- Rollback: Agente de WhatsApp, recordatorios y plantillas (2026-11-17_whatsapp-recordatorios.sql)
-- BD:        fayxzvov_pos
--
-- Quita wa_agent.reminders, wa_chat.opt_out_at y la tabla wa_reminder (con su
-- historial de recordatorios). Los mensajes que ya salieron se quedan en
-- wa_message. Las BAJA siguen en wa_chat.opt_out (esa columna es de F1).
-- Correrlo DESPUES de quitar el codigo de F5: la bandeja lee esas columnas.
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.wa_reminder;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'opt_out_at') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_chat DROP COLUMN opt_out_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_agent' AND COLUMN_NAME = 'reminders') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_agent DROP COLUMN reminders');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: ninguna fila --

SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'wa_agent' AND COLUMN_NAME = 'reminders')
      OR (TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'opt_out_at')
      OR TABLE_NAME = 'wa_reminder');
