-- =============================================================================
-- Rollback: Avisos de WhatsApp (2026-11-15_whatsapp-avisos.sql)
-- BD:        fayxzvov_pos
--
-- Borra las tres tablas con lo que tengan: plantillas editadas, destinatarios e
-- historial de envios. Correrlo DESPUES de quitar el codigo (la pagina WhatsApp
-- falla sin ellas; los cierres y el cobro no).
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.wa_log;
DROP TABLE IF EXISTS fayxzvov_pos.wa_recipient;
DROP TABLE IF EXISTS fayxzvov_pos.wa_notice;

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('wa_notice', 'wa_recipient', 'wa_log');
