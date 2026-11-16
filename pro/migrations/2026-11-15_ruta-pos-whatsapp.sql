-- =============================================================================
-- Ruta de WhatsApp
-- Fecha:     15/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-15_whatsapp-avisos.sql (fayxzvov_pos)
-- Rollback:  2026-11-15_ruta-pos-whatsapp-rollback.sql
--
-- La seccion pos-whatsapp ya existia sin ruta (el menu la ocultaba). Ahora abre
-- app/order/whatsapp.php: avisos, destinatarios, historial y conexion.
-- Sus permisos ya estan dados de alta (show y create); no se tocan.
--   show   ver la pagina, el historial y el estado de la conexion.
--   create cambiar plantillas y destinatarios, comprobar y mandar la prueba.
-- =============================================================================

UPDATE sections
SET route = 'app/order/whatsapp.php',
    name  = 'WhatsApp'
WHERE code = 'pos-whatsapp';

-- -- Comprobacion --

SELECT id, code, name, route FROM sections WHERE code = 'pos-whatsapp';

SELECT tp.code AS action, COUNT(pr.role_id) AS roles
FROM sections s
INNER JOIN permissions p            ON p.section_id = s.id
INNER JOIN type_permissions tp      ON tp.id = p.type_permission_id
LEFT  JOIN permissions_roles pr     ON pr.permission_id = p.id
WHERE s.code = 'pos-whatsapp'
GROUP BY tp.code;
