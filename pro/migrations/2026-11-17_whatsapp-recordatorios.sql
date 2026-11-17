-- =============================================================================
-- Agente de WhatsApp: recordatorios de adeudo, plantillas y BAJA (F5 del plan)
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-16_whatsapp-agente.sql (y las de bandeja, propuestas y pedidos)
-- Rollback:  2026-11-17_whatsapp-recordatorios-rollback.sql
-- Plan:      pro/app/order/docs/plan-agente-whatsapp.html
--
-- wa_agent
--   reminders    1 = el cron manda solo los recordatorios de adeudo de la
--                empresa (en horario del agente, uno por semana por cliente).
--                0 = apagado (de fabrica): la lista se ve y se manda a mano.
-- wa_chat
--   opt_out_at   cuando el cliente escribio BAJA. opt_out = 1 apaga lo que
--                inicia la empresa (recordatorios y plantillas); contestarle lo
--                que escriba sigue funcionando. ALTA lo vuelve a 0.
-- wa_reminder    un renglon por recordatorio que salio (o se intento).
--   status       sending (apartado, saliendo) · sent · simulated · failed.
--                El tope de uno por semana cuenta todo menos failed.
--   user_id      quien pulso «Mandar los de hoy»; NULL = el cron.
--
-- Se puede volver a correr: cada columna, la tabla y los indices se agregan
-- solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las columnas, la bandeja falla.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_agent' AND COLUMN_NAME = 'reminders') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_agent ADD COLUMN reminders TINYINT(4) NOT NULL DEFAULT 0 COMMENT '1 = recordatorios de adeudo automaticos' AFTER hourly_cap");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'opt_out_at') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_chat ADD COLUMN opt_out_at DATETIME NULL DEFAULT NULL COMMENT 'cuando escribio BAJA' AFTER opt_out");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.wa_reminder (
    id          INT(11)       NOT NULL AUTO_INCREMENT,
    company_id  INT(11)       NOT NULL,
    branch_id   INT(11)       NOT NULL,
    customer_id INT(11)       NOT NULL,
    chat_id     INT(11)       NULL DEFAULT NULL,
    phone       VARCHAR(20)   NOT NULL,
    amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
    message_id  INT(11)       NULL DEFAULT NULL,
    status      VARCHAR(10)   NOT NULL DEFAULT 'sending',
    error       VARCHAR(255)  NULL DEFAULT NULL,
    user_id     INT(11)       NULL DEFAULT NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY ix_wa_reminder_phone (company_id, phone, created_at),
    KEY ix_wa_reminder_customer (customer_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -- Comprobacion: 3 filas --

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos'
    AND ((TABLE_NAME = 'wa_agent' AND COLUMN_NAME = 'reminders')
      OR (TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'opt_out_at')
      OR (TABLE_NAME = 'wa_reminder' AND COLUMN_NAME = 'status'));
