-- =============================================================================
-- Rollback de 2026-11-19_base-crm.sql
-- Fecha:     19/11/2026
-- BD:        fayxzvov_crm  ->  fayxzvov_pos
--
-- Regresa las 17 tablas de lealtad y WhatsApp a fayxzvov_pos, con sus datos,
-- indices y llaves. Todo o nada, igual que la ida.
-- IMPORTANTE: regresar tambien el codigo anterior (busca en fayxzvov_pos).
-- La base fayxzvov_crm queda vacia y NO se borra: si ya tiene otras tablas,
-- un DROP DATABASE se las llevaria. Borrarla a mano (en cPanel) si sobra.
-- =============================================================================

RENAME TABLE
    fayxzvov_crm.card_type          TO fayxzvov_pos.card_type,
    fayxzvov_crm.card               TO fayxzvov_pos.card,
    fayxzvov_crm.card_stamp         TO fayxzvov_pos.card_stamp,
    fayxzvov_crm.card_level_log     TO fayxzvov_pos.card_level_log,
    fayxzvov_crm.loyalty_setting    TO fayxzvov_pos.loyalty_setting,
    fayxzvov_crm.loyalty_signup     TO fayxzvov_pos.loyalty_signup,
    fayxzvov_crm.loyalty_signup_log TO fayxzvov_pos.loyalty_signup_log,
    fayxzvov_crm.loyalty_notice     TO fayxzvov_pos.loyalty_notice,
    fayxzvov_crm.wa_agent           TO fayxzvov_pos.wa_agent,
    fayxzvov_crm.wa_agent_product   TO fayxzvov_pos.wa_agent_product,
    fayxzvov_crm.wa_chat            TO fayxzvov_pos.wa_chat,
    fayxzvov_crm.wa_message         TO fayxzvov_pos.wa_message,
    fayxzvov_crm.wa_proposal        TO fayxzvov_pos.wa_proposal,
    fayxzvov_crm.wa_reminder        TO fayxzvov_pos.wa_reminder,
    fayxzvov_crm.wa_notice          TO fayxzvov_pos.wa_notice,
    fayxzvov_crm.wa_recipient       TO fayxzvov_pos.wa_recipient,
    fayxzvov_crm.wa_log             TO fayxzvov_pos.wa_log;

-- Comprobacion: debe salir 0.
SELECT COUNT(*) AS tablas_en_crm
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_crm';
