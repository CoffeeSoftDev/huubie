-- =============================================================================
-- Agente de WhatsApp: pedidos y comprobantes por chat (F4 del plan)
-- Fecha:     16/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-16_whatsapp-agente.sql, 2026-11-16_whatsapp-propuestas.sql
-- Rollback:  2026-11-16_whatsapp-pedidos-rollback.sql
-- Plan:      pro/app/order/docs/plan-agente-whatsapp.html
--
-- wa_proposal
--   action       lo que pasa al mandar la propuesta, ademas del texto:
--                  'order'    crea el pedido web (Tienda en linea › Nuevos)
--                  'handoff'  ya paso el chat a una persona (al proponer)
--                NULL = solo texto, como en F3.
--   action_data  el borrador en JSON (productos, entrega, fecha, pago...) o el
--                resumen para la persona.
--   sale_id      el pedido que se creo al mandar (action 'order').
-- wa_message
--   receipt_id   el comprobante (customer_receipt) que salio de esa foto o PDF.
--                Una foto da un solo comprobante.
-- wa_chat
--   handoff_note por que el agente paso el chat a una persona. Se borra al
--                «Devolver al agente».
--
-- wa_agent.catalog_mode ('store' / 'own') y wa_agent_product ya existen desde
-- 2026-11-16_whatsapp-agente.sql: aqui no se tocan.
--
-- Se puede volver a correr: cada columna y el indice se agregan solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las columnas, proponer falla.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'action') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN action VARCHAR(10) NULL DEFAULT NULL COMMENT 'order / handoff; NULL = solo texto' AFTER tools_used");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'action_data') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN action_data TEXT NULL COMMENT 'borrador del pedido o resumen, en JSON' AFTER action");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'sale_id') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN sale_id INT(11) NULL DEFAULT NULL COMMENT 'pedido creado al mandar' AFTER action_data");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_message' AND COLUMN_NAME = 'receipt_id') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_message ADD COLUMN receipt_id INT(11) NULL DEFAULT NULL COMMENT 'customer_receipt que salio de esta foto' AFTER media_path");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'handoff_note') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_chat ADD COLUMN handoff_note VARCHAR(500) NULL DEFAULT NULL COMMENT 'por que lo atiende una persona' AFTER human_until");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_message' AND INDEX_NAME = 'ix_wa_message_receipt') > 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_message ADD KEY ix_wa_message_receipt (receipt_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: 5 filas --

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'wa_proposal' AND COLUMN_NAME IN ('action', 'action_data', 'sale_id'))
      OR (TABLE_NAME = 'wa_message' AND COLUMN_NAME = 'receipt_id')
      OR (TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'handoff_note'));
