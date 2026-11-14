-- =============================================================================
-- Rollback de 2026-11-14_ruta-pos-historial.sql
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Deja la seccion sin ruta (el menu la oculta) y quita show/print de
-- pos-historial a los roles que venden pero no cancelan en pos-ventas: los
-- que agrego la migracion (en local, 3 y 8). Dueño y Supervisor no se tocan.
-- =============================================================================

UPDATE sections
SET route = NULL
WHERE code = 'pos-historial';

DELETE x
FROM permissions_roles x
JOIN permissions hp       ON hp.id = x.permission_id
JOIN sections hs          ON hs.id = hp.section_id AND hs.code = 'pos-historial'
JOIN type_permissions htp ON htp.id = hp.type_permission_id AND htp.code IN ('show', 'print')
WHERE x.role_id NOT IN (
    SELECT role_id FROM (
        SELECT vr.role_id
        FROM permissions_roles vr
        JOIN permissions vp       ON vp.id = vr.permission_id
        JOIN sections vs          ON vs.id = vp.section_id AND vs.code = 'pos-ventas'
        JOIN type_permissions vtp ON vtp.id = vp.type_permission_id AND vtp.code = 'cancel'
    ) keep
);

-- Comprobacion: sin ruta, y show/print solo con los roles que cancelan.
SELECT id, code, name, route FROM sections WHERE code = 'pos-historial';

SELECT tp.code AS action, GROUP_CONCAT(pr.role_id ORDER BY pr.role_id) AS roles
FROM permissions p
JOIN sections s          ON s.id = p.section_id AND s.code = 'pos-historial'
JOIN type_permissions tp ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr ON pr.permission_id = p.id
GROUP BY tp.code;
