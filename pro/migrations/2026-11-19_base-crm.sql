-- =============================================================================
-- Base propia para Lealtad y WhatsApp: fayxzvov_crm
-- Fecha:     19/11/2026
-- BD:        fayxzvov_pos  ->  fayxzvov_crm
-- Requiere:  TODAS las migras de lealtad y WhatsApp hasta el 18/11/2026
--            (whatsapp-avisos, whatsapp-agente, whatsapp-bandeja,
--            whatsapp-propuestas, whatsapp-pedidos, whatsapp-recordatorios,
--            whatsapp-dueno, color-tipo-tarjeta, tarjeta-digital, sellos,
--            lealtad-crecimiento). Esas crean las tablas en fayxzvov_pos;
--            esta las mueve.
-- Rollback:  2026-11-19_base-crm-rollback.sql
--
-- Antes:   las 17 tablas de lealtad y WhatsApp vivian en fayxzvov_pos,
--          junto con las del POS.
-- Despues: viven en fayxzvov_crm. El POS se queda con ventas, clientes,
--          turnos y portal (customer, customer_portal y customer_receipt
--          NO se mueven).
--
--   Lealtad (8):  card, card_type, card_stamp, card_level_log,
--                 loyalty_setting, loyalty_signup, loyalty_signup_log,
--                 loyalty_notice
--   WhatsApp (9): wa_agent, wa_agent_product, wa_chat, wa_message,
--                 wa_proposal, wa_reminder, wa_notice, wa_recipient, wa_log
--
-- RENAME TABLE mueve cada tabla con sus datos, indices, AUTO_INCREMENT y
-- llaves foraneas. Es todo o nada: si falta una tabla, o ya existe en
-- fayxzvov_crm, no se mueve ninguna.
-- Llaves que cruzan de base y siguen vivas despues:
--   fayxzvov_pos.sale.card_id            -> fayxzvov_crm.card.id
--   fayxzvov_crm.card.customer_id        -> fayxzvov_pos.customer.id
--   fayxzvov_crm.card.branch_id          -> fayxzvov_app.branches.id
--   fayxzvov_crm.card_type.branch_id     -> fayxzvov_app.branches.id
-- Una venta y su tarjeta se siguen guardando en UNA transaccion: las dos
-- bases estan en el mismo servidor y usan la misma conexion.
--
-- cPanel (prod): crear ANTES la base «fayxzvov_crm» en «Bases de datos MySQL»
-- y darle TODOS los privilegios al usuario del .env (DB_USER). Sin eso el
-- CREATE DATABASE falla y el codigo no puede leer las tablas.
-- IMPORTANTE: correr y subir el codigo enseguida. El codigo viejo busca estas
-- tablas en fayxzvov_pos; el nuevo, en fayxzvov_crm.
-- Despues de esta, las migras viejas de lealtad y WhatsApp YA NO se corren:
-- crearian tablas vacias en fayxzvov_pos. Las nuevas van contra fayxzvov_crm.
-- =============================================================================

-- 1. Revision previa: debe salir en_pos = 17 y en_crm = 0.
SELECT SUM(TABLE_SCHEMA = 'fayxzvov_pos') AS en_pos,
       SUM(TABLE_SCHEMA = 'fayxzvov_crm') AS en_crm
FROM information_schema.TABLES
WHERE TABLE_SCHEMA IN ('fayxzvov_pos', 'fayxzvov_crm')
  AND TABLE_NAME IN ('card', 'card_type', 'card_stamp', 'card_level_log',
                     'loyalty_setting', 'loyalty_signup', 'loyalty_signup_log', 'loyalty_notice',
                     'wa_agent', 'wa_agent_product', 'wa_chat', 'wa_message', 'wa_proposal',
                     'wa_reminder', 'wa_notice', 'wa_recipient', 'wa_log');

-- 2. La base. Mismo juego de caracteres que fayxzvov_pos: los JOIN entre las
--    dos comparan texto sin choque de collation.
CREATE DATABASE IF NOT EXISTS fayxzvov_crm
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_general_ci;

-- 3. La mudanza (una sola sentencia: todo o nada).
RENAME TABLE
    fayxzvov_pos.card_type          TO fayxzvov_crm.card_type,
    fayxzvov_pos.card               TO fayxzvov_crm.card,
    fayxzvov_pos.card_stamp         TO fayxzvov_crm.card_stamp,
    fayxzvov_pos.card_level_log     TO fayxzvov_crm.card_level_log,
    fayxzvov_pos.loyalty_setting    TO fayxzvov_crm.loyalty_setting,
    fayxzvov_pos.loyalty_signup     TO fayxzvov_crm.loyalty_signup,
    fayxzvov_pos.loyalty_signup_log TO fayxzvov_crm.loyalty_signup_log,
    fayxzvov_pos.loyalty_notice     TO fayxzvov_crm.loyalty_notice,
    fayxzvov_pos.wa_agent           TO fayxzvov_crm.wa_agent,
    fayxzvov_pos.wa_agent_product   TO fayxzvov_crm.wa_agent_product,
    fayxzvov_pos.wa_chat            TO fayxzvov_crm.wa_chat,
    fayxzvov_pos.wa_message         TO fayxzvov_crm.wa_message,
    fayxzvov_pos.wa_proposal        TO fayxzvov_crm.wa_proposal,
    fayxzvov_pos.wa_reminder        TO fayxzvov_crm.wa_reminder,
    fayxzvov_pos.wa_notice          TO fayxzvov_crm.wa_notice,
    fayxzvov_pos.wa_recipient       TO fayxzvov_crm.wa_recipient,
    fayxzvov_pos.wa_log             TO fayxzvov_crm.wa_log;

-- 4. Comprobacion: 17 tablas en fayxzvov_crm y las 5 llaves de arriba.
SELECT COUNT(*) AS tablas_en_crm
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_crm';

SELECT k.TABLE_SCHEMA, k.TABLE_NAME, k.COLUMN_NAME,
       k.REFERENCED_TABLE_SCHEMA, k.REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE k
WHERE k.REFERENCED_TABLE_NAME IS NOT NULL
  AND (k.TABLE_SCHEMA = 'fayxzvov_crm' OR k.REFERENCED_TABLE_SCHEMA = 'fayxzvov_crm')
ORDER BY k.TABLE_SCHEMA, k.TABLE_NAME, k.COLUMN_NAME;
