-- =====================================================================
-- Módulo "Permisos" como card del dashboard  (/inventory/modulos/)
-- Fecha: 20/09/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   Da de alta SOLO registros. No crea ni mueve archivos: la card apunta
--   al editor de permisos que ya existe en /inventory/tenant/.
--
-- POR QUÉ SON TRES INSERTS
--   El dashboard no lista todos los módulos: lista los que el rol del
--   usuario puede abrir. La cadena que exige qAccessibleModules()
--   (inventory/modulos/mdl/mdl-modulos.php) es:
--       modules -> sections -> permissions -> users_braches
--   Un módulo sin sección con permiso NO aparece como card.
--
-- IDEMPOTENTE: se puede correr dos veces sin duplicar.
--   (Los LEFT JOIN contra tablas derivadas son para esquivar el error
--    1093 de MySQL: no se puede subconsultar la misma tabla del INSERT.)
-- =====================================================================


-- 1) MÓDULO --------------------------------------------------------------
-- orden 4 = después de Configuracion(1), Root(2) e Inventario(3).
-- route 'tenant/' = a dónde navega la card al dar clic.
INSERT INTO fayxzvov_erp.modules
    (name, code, icon, description, created_at, orden, route, is_active)
SELECT 'Permisos', 'permisos', 'shield-check',
       'Roles, secciones y tipos de permiso.',
       NOW(), 4, 'tenant/', 1
FROM (SELECT 1) AS d
LEFT JOIN (SELECT code FROM fayxzvov_erp.modules) AS m
       ON m.code = 'permisos'
WHERE m.code IS NULL;

SET @module_id = (SELECT id FROM fayxzvov_erp.modules
                  WHERE code = 'permisos' ORDER BY id DESC LIMIT 1);


-- 2) SECCIÓN -------------------------------------------------------------
-- Es la que hace visible la card y, de paso, el item del rail lateral
-- dentro de /inventory/tenant/.
INSERT INTO fayxzvov_erp.sections
    (name, code, icon, created_at, orden, route, is_active, module_id, submodule_id)
SELECT 'Permisos', 'permisos-editor', 'shield-check',
       NOW(), 1, 'tenant/', 1, @module_id, NULL
FROM (SELECT 1) AS d
LEFT JOIN (SELECT code FROM fayxzvov_erp.sections) AS s
       ON s.code = 'permisos-editor'
WHERE s.code IS NULL;

SET @section_id = (SELECT id FROM fayxzvov_erp.sections
                   WHERE code = 'permisos-editor' ORDER BY id DESC LIMIT 1);


-- 3) PERMISOS ------------------------------------------------------------
-- Quién ve la card: Super Admin (1) y Administrador (2).
-- Con qué tipo:     Acceso (1) y Editar (2).
INSERT INTO fayxzvov_erp.permissions
    (role_id, section_id, type_permission_id, is_active, created_at)
SELECT r.id, @section_id, t.id, 1, NOW()
FROM fayxzvov_erp.roles AS r
CROSS JOIN fayxzvov_erp.type_permissions AS t
LEFT JOIN (SELECT role_id, section_id, type_permission_id
           FROM fayxzvov_erp.permissions) AS p
       ON p.role_id            = r.id
      AND p.section_id         = @section_id
      AND p.type_permission_id = t.id
WHERE r.id IN (1, 2)
  AND t.id IN (1, 2)
  AND p.role_id IS NULL;


-- 4) VERIFICACIÓN --------------------------------------------------------
SELECT m.id AS module_id, m.name AS modulo, m.route AS ruta_card,
       s.id AS section_id, s.name AS seccion,
       GROUP_CONCAT(DISTINCT r.name ORDER BY r.id SEPARATOR ', ') AS roles_con_acceso
FROM fayxzvov_erp.modules m
JOIN fayxzvov_erp.sections s     ON s.module_id  = m.id
JOIN fayxzvov_erp.permissions p  ON p.section_id = s.id AND p.is_active = 1
JOIN fayxzvov_erp.roles r        ON r.id         = p.role_id
WHERE m.code = 'permisos'
GROUP BY m.id, m.name, m.route, s.id, s.name;
