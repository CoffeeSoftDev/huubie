-- =============================================================================
-- Ruta de Puntos (Ventas › Puntos) — fase V4 del plan de Ventas
-- Fecha:     14/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (la seccion `pos-puntos`)
-- Rollback:  2026-11-14_ruta-pos-puntos-rollback.sql
--
-- La seccion nacio SIN ruta y el menu oculta toda seccion sin ruta
-- (auth/ctrl/ctrl-nav.php). La pagina ya existe: app/order/puntos.php.
--
-- No se tocan permisos. pos-puntos (show, create, update) hoy solo la tiene el
-- Dueño: el administra tipos de tarjeta y tarjetas. Leer la tarjeta al cobrar
-- NO pasa por esta seccion: lo hace ctrl-ventas.php con el `create` de
-- pos-ventas, que ya tienen Cajera y Supervisor.
-- Sin cambios de estructura. Se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/puntos.php'
WHERE code = 'pos-puntos';

-- Comprobacion: la ruta nueva y quien entra a la pagina.
SELECT id, code, name, route FROM sections WHERE code = 'pos-puntos';

SELECT tp.code AS action, GROUP_CONCAT(pr.role_id ORDER BY pr.role_id) AS roles
FROM permissions p
JOIN sections s          ON s.id = p.section_id AND s.code = 'pos-puntos'
JOIN type_permissions tp ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr ON pr.permission_id = p.id
GROUP BY tp.code
ORDER BY tp.code;
