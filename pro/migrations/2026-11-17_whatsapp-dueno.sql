-- =============================================================================
-- Agente de WhatsApp: agente del dueño, respuestas automaticas por tema y
-- metricas (F6 del plan)
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-16_whatsapp-agente.sql (y las de bandeja, propuestas,
--            pedidos y recordatorios)
-- Rollback:  2026-11-17_whatsapp-dueno-rollback.sql
-- Plan:      pro/app/order/docs/plan-agente-whatsapp.html
--
-- wa_recipient
--   can_ask      1 = ese numero puede escribirle al numero del agente y
--                preguntar ventas del dia, turno, pedidos pendientes y
--                cartera (agente del dueño). Le contesta directo, sin
--                bandeja, en el horario del agente. Con sucursal, solo ve esa
--                sucursal; sin sucursal, todas las de la empresa.
-- wa_proposal
--   kind         customer = agente de clientes · owner = agente del dueño.
--   auto_sent    1 = salio sola, sin que una persona la mandara (tema en
--                automatico o agente del dueño).
--   topic        de que trato, segun lo que consulto: negocio · catalogo ·
--                pedidos · saldo · persona · comprobante · charla · dueno.
--                Sale en Metricas y decide si un tema sale solo.
-- wa_agent.auto_topics ya existe desde F1 (VARCHAR 255): ahora guarda los
--   temas que salen solos, separados por coma (negocio, catalogo). NULL =
--   todo va a la bandeja como propuesta.
--
-- Se puede volver a correr: cada columna y el indice se agregan solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las columnas, la bandeja y
-- el cron fallan.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_recipient' AND COLUMN_NAME = 'can_ask') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_recipient ADD COLUMN can_ask TINYINT(4) NOT NULL DEFAULT 0 COMMENT '1 = puede preguntarle al agente del dueño' AFTER notify_day");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'kind') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'customer' COMMENT 'customer · owner' AFTER message_id");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'auto_sent') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN auto_sent TINYINT(4) NOT NULL DEFAULT 0 COMMENT '1 = salio sola' AFTER status");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'topic') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN topic VARCHAR(20) NULL DEFAULT NULL COMMENT 'tema segun lo que consulto' AFTER auto_sent");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME = 'ix_wa_proposal_created') > 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal ADD KEY ix_wa_proposal_created (created_at)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- La bandeja y Metricas buscan que propuesta salio en cada mensaje.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME = 'ix_wa_proposal_sent') > 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal ADD KEY ix_wa_proposal_sent (sent_message_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: 4 columnas y 2 indices --

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'wa_recipient' AND COLUMN_NAME = 'can_ask')
      OR (TABLE_NAME = 'wa_proposal' AND COLUMN_NAME IN ('kind', 'auto_sent', 'topic')));

SELECT INDEX_NAME, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME IN ('ix_wa_proposal_created', 'ix_wa_proposal_sent');
