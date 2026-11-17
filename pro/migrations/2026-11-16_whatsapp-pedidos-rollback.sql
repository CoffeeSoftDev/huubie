-- =============================================================================
-- Rollback: Agente de WhatsApp, pedidos y comprobantes (2026-11-16_whatsapp-pedidos.sql)
-- BD:        fayxzvov_pos
--
-- Quita wa_proposal.action / action_data / sale_id, wa_message.receipt_id (y su
-- indice) y wa_chat.handoff_note. Los pedidos (sale) y los comprobantes
-- (customer_receipt) que ya se crearon se quedan: son ventas y pagos reales.
-- Las propuestas de pedido que sigan en 'pending' pasan a 'discarded' (sin la
-- columna action ya no crearian el pedido al mandarse).
-- Correrlo DESPUES de quitar el codigo de F4: proponer escribe esas columnas.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'action') = 0,
    'DO 0',
    "UPDATE fayxzvov_pos.wa_proposal SET status = 'discarded' WHERE status = 'pending' AND action = 'order'");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_message' AND INDEX_NAME = 'ix_wa_message_receipt') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_message DROP KEY ix_wa_message_receipt');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_message' AND COLUMN_NAME = 'receipt_id') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_message DROP COLUMN receipt_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'handoff_note') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_chat DROP COLUMN handoff_note');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'sale_id') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN sale_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'action_data') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN action_data');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'action') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal DROP COLUMN action');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: ninguna fila --

SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'wa_proposal' AND COLUMN_NAME IN ('action', 'action_data', 'sale_id'))
      OR (TABLE_NAME = 'wa_message' AND COLUMN_NAME = 'receipt_id')
      OR (TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'handoff_note'));
