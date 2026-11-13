-- =============================================================================
-- Modulo Catalogo
-- Fecha:     09/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  fayxzvov_pos creada (2026-11-06_crear-fayxzvov-pos.sql)
-- Que hace:  registra el modulo, su seccion y los permisos del rol Dueño.
--            Se puede correr dos veces: cada INSERT revisa que no exista.
-- Rollback:  2026-11-09_modulo-catalogo-rollback.sql
-- =============================================================================

-- 1) Modulo. El rail lo encuentra por modules.route, que es prefijo de la pagina.
INSERT INTO modules (name, code, icon, description, route, orden, is_active, created_at)
SELECT 'Catálogo', 'catalogo', 'book-open',
       'Productos, categorías, modificadores, paquetes, métodos de pago y descuentos del POS',
       'app/catalogo', 6, 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'catalogo');

-- 2) Seccion. Permission::page('catalogo') y los ctrl validan contra este code.
INSERT INTO sections (name, code, icon, route, orden, is_active, module_id, created_at)
SELECT 'Catálogo', 'catalogo', 'book-open', 'app/catalogo/catalogo.php', 1, 1, m.id, NOW()
FROM modules m
WHERE m.code = 'catalogo'
  AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.code = 'catalogo');

-- 3) Permisos de la seccion: ver, agregar, editar y eliminar.
INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM sections s
INNER JOIN type_permissions tp ON tp.code IN ('show', 'create', 'update', 'delete')
WHERE s.code = 'catalogo'
  AND NOT EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.section_id = s.id AND p.type_permission_id = tp.id
  );

-- 4) Se los damos al Dueño. Los demas roles se asignan en Accesos.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM permissions p
INNER JOIN sections s ON s.id = p.section_id AND s.code = 'catalogo'
INNER JOIN roles r ON r.code IN ('dueno', 'owner') AND r.is_active = 1
WHERE NOT EXISTS (
    SELECT 1 FROM permissions_roles pr
    WHERE pr.permission_id = p.id AND pr.role_id = r.id
);
