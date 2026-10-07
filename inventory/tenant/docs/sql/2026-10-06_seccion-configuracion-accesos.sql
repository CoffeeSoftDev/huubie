-- =====================================================================
-- Sección "Accesos" del módulo Configuración  (/inventory/admin/accesos/)
-- Fecha: 06/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   El módulo Configuración (route 'admin/accesos') no tenía secciones: el
--   rail lateral salía vacío al abrirlo y la card no aparecía en el
--   dashboard, que solo lista módulos con alguna sección con permiso
--   (modules -> sections -> permissions -> users_braches).
--
-- PRIMERA SECCIÓN SELECCIONADA
--   La card navega a modules.route ('admin/accesos'). La sección va con
--   orden 1 y esa misma ruta: es la primera del rail y sidebar.js
--   (highlightCurrentRoute) la marca activa al entrar.
--
-- PERMISOS
--   Solo Super Admin (1) con Acceso (1), como el resto de secciones. A los
--   demás roles se les da desde el editor de Permisos.
--
-- El módulo se busca por su ruta: hay tres con code 'configuracion' (dos
-- inactivos). IDEMPOTENTE: se puede correr dos veces sin duplicar.
-- El -rollback quita la sección y sus permisos.
-- =====================================================================

SET @module_id = (SELECT id FROM fayxzvov_erp.modules
                  WHERE route = 'admin/accesos' AND is_active = 1
                  ORDER BY id DESC LIMIT 1);


-- 1) SECCIÓN -------------------------------------------------------------
INSERT INTO fayxzvov_erp.sections
    (name, code, icon, created_at, orden, route, is_active, module_id, submodule_id)
SELECT 'Accesos', 'configuracion-accesos', 'shield-user',
       NOW(), 1, 'admin/accesos/', 1, @module_id, NULL
FROM (SELECT 1) AS d
LEFT JOIN (SELECT code FROM fayxzvov_erp.sections) AS s
       ON s.code = 'configuracion-accesos'
WHERE s.code IS NULL
  AND @module_id IS NOT NULL;

SET @section_id = (SELECT id FROM fayxzvov_erp.sections
                   WHERE code = 'configuracion-accesos' ORDER BY id DESC LIMIT 1);


-- 2) PERMISOS ------------------------------------------------------------
INSERT INTO fayxzvov_erp.permissions
    (role_id, section_id, type_permission_id, is_active, created_at)
SELECT 1, @section_id, 1, 1, NOW()
FROM (SELECT 1) AS d
LEFT JOIN (SELECT role_id, section_id, type_permission_id
           FROM fayxzvov_erp.permissions) AS p
       ON p.role_id            = 1
      AND p.section_id         = @section_id
      AND p.type_permission_id = 1
WHERE p.role_id IS NULL
  AND @section_id IS NOT NULL;


-- 3) VERIFICACIÓN --------------------------------------------------------
SELECT m.id AS module_id, m.name AS modulo, m.route AS ruta_card,
       s.id AS section_id, s.name AS seccion, s.route AS ruta_seccion, s.orden,
       GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR ', ') AS roles_con_acceso
FROM fayxzvov_erp.modules m
JOIN fayxzvov_erp.sections s     ON s.module_id  = m.id
LEFT JOIN fayxzvov_erp.permissions p ON p.section_id = s.id AND p.is_active = 1
LEFT JOIN fayxzvov_erp.roles r       ON r.id         = p.role_id
WHERE m.id = @module_id
GROUP BY m.id, m.name, m.route, s.id, s.name, s.route, s.orden;
