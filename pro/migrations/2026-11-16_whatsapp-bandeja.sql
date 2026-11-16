-- =============================================================================
-- Agente de WhatsApp: bandeja de conversaciones (F2 del plan)
-- Fecha:     16/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app) + fayxzvov_pos
-- Requiere:  2026-11-16_whatsapp-agente.sql y 2026-11-15_ruta-pos-whatsapp.sql
-- Rollback:  2026-11-16_whatsapp-bandeja-rollback.sql
-- Plan:      pro/app/order/docs/plan-agente-whatsapp.html
--
-- 1) Atender la bandeja (contestar, simular, asignar sucursal) = accion 'update'
--    de la seccion `pos-whatsapp`. Se da a los roles que ya tienen 'create' ahi
--    (hoy, los que editan los avisos). root la trae siempre.
-- 2) Dos columnas en wa_chat:
--    menu_at   cuando se le mando al cliente el menu de sucursales. NULL = aun
--              no. Evita mandarlo dos veces.
--    seen_at   la ultima vez que alguien abrio el chat en la bandeja. Lo que
--              llego despues (last_in_at > seen_at) cuenta como sin leer.
--
-- El token de Meta para enviar NO va aqui: vive en pro/core/config/.env
-- (WHATSAPP_META_TOKEN). Sin token todo envio queda como 'simulated'.
--
-- Se puede volver a correr: busca por code y cada columna se agrega solo si falta.
-- IMPORTANTE: correr ANTES de subir el codigo; sin las columnas la bandeja falla.
-- =============================================================================

-- 1) La accion 'update' en la seccion (si no existe).
INSERT INTO permissions (created_at, type_permission_id, section_id, is_active)
SELECT NOW(), tp.id, s.id, 1
FROM sections s
INNER JOIN type_permissions tp ON tp.code = 'update'
WHERE s.code = 'pos-whatsapp'
    AND NOT EXISTS (
        SELECT 1 FROM permissions p
        WHERE p.section_id = s.id AND p.type_permission_id = tp.id
    );

-- A los roles que ya tienen 'create' en la seccion.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT DISTINCT pu.id, pr.role_id
FROM sections s
INNER JOIN type_permissions tu  ON tu.code = 'update'
INNER JOIN permissions pu       ON pu.section_id = s.id AND pu.type_permission_id = tu.id
INNER JOIN type_permissions tc  ON tc.code = 'create'
INNER JOIN permissions pc       ON pc.section_id = s.id AND pc.type_permission_id = tc.id
INNER JOIN permissions_roles pr ON pr.permission_id = pc.id
WHERE s.code = 'pos-whatsapp'
    AND NOT EXISTS (
        SELECT 1 FROM permissions_roles x
        WHERE x.permission_id = pu.id AND x.role_id = pr.role_id
    );

-- 2) Columnas de wa_chat.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'menu_at') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_chat ADD COLUMN menu_at DATETIME NULL DEFAULT NULL COMMENT 'cuando salio el menu de sucursales' AFTER last_message_at");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME = 'seen_at') > 0,
    'DO 0',
    "ALTER TABLE fayxzvov_pos.wa_chat ADD COLUMN seen_at DATETIME NULL DEFAULT NULL COMMENT 'ultima vez que se abrio en la bandeja' AFTER menu_at");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Comprobacion --

SELECT tp.code AS accion, r.id AS role_id, r.name AS rol
FROM sections s
INNER JOIN permissions p        ON p.section_id = s.id
INNER JOIN type_permissions tp  ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr  ON pr.permission_id = p.id
LEFT JOIN roles r               ON r.id = pr.role_id
WHERE s.code = 'pos-whatsapp'
ORDER BY tp.id, r.id;

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'wa_chat' AND COLUMN_NAME IN ('menu_at', 'seen_at');
