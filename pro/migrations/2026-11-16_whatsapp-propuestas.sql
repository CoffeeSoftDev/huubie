-- =============================================================================
-- Agente de WhatsApp: propuestas del agente de clientes (F3 del plan)
-- Fecha:     16/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-16_whatsapp-agente.sql (crea wa_proposal)
-- Rollback:  2026-11-16_whatsapp-propuestas-rollback.sql
-- Plan:      pro/app/order/docs/plan-agente-whatsapp.html
--
-- Tres columnas y un indice en wa_proposal:
--   requested_by  quien pidio la propuesta con «Proponer». NULL = la pidio el
--                 agente solo (al llegar el mensaje o al abrir). Solo las
--                 automaticas cuentan para wa_agent.hourly_cap.
--   elapsed_ms    lo que tardo el modelo, de la pregunta a la propuesta.
--   error         por que no hubo propuesta (status 'failed').
--   ix_wa_proposal_message  buscar la propuesta del ultimo mensaje del cliente.
--
-- wa_proposal.status ahora puede ser:
--   working    el agente la esta armando (si se queda asi mas de 3 min, se da por perdida)
--   pending    lista, esperando a una persona
--   sent       la persona la mando tal cual
--   edited     la persona la cambio y la mando
--   discarded  descartada (a mano, o porque llego otra mas nueva)
--   failed     el modelo no contesto; error dice por que
--
-- La llave de Ollama NO va aqui: vive en el .env (OLLAMA_API_KEY).
--
-- Se puede volver a correr: cada columna y el indice se agregan solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las columnas, proponer falla.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'requested_by') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN requested_by INT(11) NULL DEFAULT NULL COMMENT 'quien pidio Proponer; NULL = automatica' AFTER model");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'elapsed_ms') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN elapsed_ms INT(11) NULL DEFAULT NULL COMMENT 'lo que tardo el modelo' AFTER requested_by");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME = 'error') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_proposal ADD COLUMN error VARCHAR(255) NULL DEFAULT NULL COMMENT 'por que fallo' AFTER elapsed_ms");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND INDEX_NAME = 'ix_wa_proposal_message') > 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_proposal ADD KEY ix_wa_proposal_message (message_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion --

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal' AND COLUMN_NAME IN ('requested_by', 'elapsed_ms', 'error');

SELECT DISTINCT INDEX_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_proposal';
