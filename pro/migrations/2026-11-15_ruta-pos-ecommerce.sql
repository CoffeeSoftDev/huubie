-- =============================================================================
-- Ruta de Tienda en linea (Ventas › Tienda en linea) — fase V8 del plan de Ventas
-- Fecha:     15/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-15_tienda-en-linea.sql (las tablas)
-- Rollback:  2026-11-15_ruta-pos-ecommerce-rollback.sql
--
-- La seccion `pos-ecommerce` nacio SIN ruta y con el nombre «Ecommerce»; el
-- menu oculta toda seccion sin ruta. La pagina ya existe: app/order/tienda.php.
--
-- No se tocan permisos. pos-ecommerce (show, update) hoy la tienen los roles
-- 2 y 6. Con show se ve la tienda y la bandeja; con update se configura, se
-- eligen productos y se aceptan o cancelan los pedidos que llegan.
-- Sin cambios de estructura. Se puede volver a correr.
-- =============================================================================

UPDATE sections
SET route = 'app/order/tienda.php',
    name  = 'Tienda en línea'
WHERE code = 'pos-ecommerce';

-- Comprobacion: la ruta nueva y quien entra a la pagina.
SELECT id, code, name, route FROM sections WHERE code = 'pos-ecommerce';

SELECT tp.code AS action, GROUP_CONCAT(pr.role_id ORDER BY pr.role_id) AS roles
FROM permissions p
JOIN sections s          ON s.id = p.section_id AND s.code = 'pos-ecommerce'
JOIN type_permissions tp ON tp.id = p.type_permission_id
LEFT JOIN permissions_roles pr ON pr.permission_id = p.id
GROUP BY tp.code
ORDER BY tp.code;
