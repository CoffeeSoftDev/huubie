-- =============================================================================
-- Ruta y acceso de Historial (Pedidos › Historial) — fase V2 del plan de Ventas
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (las secciones `pos-historial` y `pos-ventas`)
--            2026-11-14_ruta-pos-ventas.sql (V1)
-- Rollback:  2026-11-14_ruta-pos-historial-rollback.sql
--
-- 1. La seccion nacio SIN ruta y el menu oculta toda seccion sin ruta
--    (auth/ctrl/ctrl-nav.php). La pagina ya existe: app/order/historial.php.
-- 2. Decision A9: la Cajera SI ve el historial (solo sus ventas del turno
--    abierto; eso lo filtra ctrl-historial.php). Hoy solo Dueño y Supervisor
--    tienen show/print en pos-historial. Se les da a los roles que venden
--    (create en pos-ventas) y aun no los tienen: en local, 3 y 8 (Cajera).
--    Cancelar sigue siendo `cancel` de pos-ventas: no cambia.
-- Sin cambios de estructura. Se puede volver a correr (NOT EXISTS).
-- =============================================================================

UPDATE sections
SET route = 'app/order/historial.php'
WHERE code = 'pos-historial';

INSERT INTO permissions_roles (permission_id, role_id)
SELECT DISTINCT hp.id, vr.role_id
FROM permissions hp
JOIN sections hs          ON hs.id = hp.section_id AND hs.code = 'pos-historial'
JOIN type_permissions htp ON htp.id = hp.type_permission_id AND htp.code IN ('show', 'print')
JOIN sections vs          ON vs.code = 'pos-ventas'
JOIN permissions vp       ON vp.section_id = vs.id
JOIN type_permissions vtp ON vtp.id = vp.type_permission_id AND vtp.code = 'create'
JOIN permissions_roles vr ON vr.permission_id = vp.id
WHERE NOT EXISTS (
    SELECT 1 FROM permissions_roles x
    WHERE x.permission_id = hp.id AND x.role_id = vr.role_id
);

-- Comprobacion: la ruta nueva, y show/print con los mismos roles que create de pos-ventas.
SELECT id, code, name, route FROM sections WHERE code = 'pos-historial';

SELECT s.code AS section, tp.code AS action, GROUP_CONCAT(pr.role_id ORDER BY pr.role_id) AS roles
FROM permissions p
JOIN sections s          ON s.id = p.section_id
JOIN type_permissions tp ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr ON pr.permission_id = p.id
WHERE s.code IN ('pos-historial', 'pos-ventas')
GROUP BY s.code, tp.code
ORDER BY s.code, tp.code;
