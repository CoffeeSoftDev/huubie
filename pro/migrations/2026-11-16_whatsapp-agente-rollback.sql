-- =============================================================================
-- Rollback: Agente de WhatsApp, entrada de mensajes (2026-11-16_whatsapp-agente.sql)
-- BD:        fayxzvov_pos
--
-- Borra las cinco tablas con lo que tengan: numeros dados de alta, catalogo del
-- agente, conversaciones, mensajes y propuestas.
-- Correrlo DESPUES de quitar el codigo y de quitar la suscripcion del webhook en
-- Meta: sin las tablas el webhook contesta 500 y Meta reintenta hasta 7 dias.
-- Las tablas de avisos (wa_notice, wa_recipient, wa_log) no se tocan.
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.wa_proposal;
DROP TABLE IF EXISTS fayxzvov_pos.wa_message;
DROP TABLE IF EXISTS fayxzvov_pos.wa_chat;
DROP TABLE IF EXISTS fayxzvov_pos.wa_agent_product;
DROP TABLE IF EXISTS fayxzvov_pos.wa_agent;

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('wa_agent', 'wa_agent_product', 'wa_chat', 'wa_message', 'wa_proposal');
