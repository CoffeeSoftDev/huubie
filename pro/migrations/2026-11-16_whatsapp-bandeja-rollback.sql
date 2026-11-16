-- =============================================================================
-- Rollback: Agente de WhatsApp, bandeja de conversaciones (2026-11-16_whatsapp-bandeja.sql)
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app) + fayxzvov_pos
--
-- Quita la accion 'update' de `pos-whatsapp` (y a quien la tenia) y las columnas
-- menu_at y seen_at de wa_chat. Las conversaciones y mensajes se quedan.
-- Correrlo DESPUES de quitar el codigo de F2: la bandeja lee esas columnas.
-- =============================================================================

DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p        ON p.id = pr.permission_id
INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id AND tp.code = 'update'
INNER JOIN sections s           ON s.id = p.section_id AND s.code = 'pos-whatsapp';

DELETE p
FROM permissions p
INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id AND tp.code = 'update'
INNER JOIN sections s           ON s.id = p.section_id AND s.code = 'pos-whatsapp';

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'seen_at') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_chat DROP COLUMN seen_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'menu_at') = 0,
    'DO 0',
    'ALTER TABLE fayxzvov_pos.wa_chat DROP COLUMN menu_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion: ninguna fila --

SELECT p.id
FROM permissions p
INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id AND tp.code = 'update'
INNER JOIN sections s           ON s.id = p.section_id AND s.code = 'pos-whatsapp';

SELECT COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME IN ('menu_at', 'seen_at');
