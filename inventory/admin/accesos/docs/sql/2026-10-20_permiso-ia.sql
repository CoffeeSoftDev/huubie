-- =====================================================================
-- Accesos › Roles: columna «IA» (CoffeeIA por rol y por sección)
-- Fecha: 20/10/2026
-- BD:    fayxzvov_erp
--
-- type_permissions  nueva acción 'ia' (IA), en el orden justo después de
--                   Eliminar: así sale a su lado en la matriz de permisos.
-- permissions       la acción 'ia' en las secciones que tienen CoffeeIA:
--                   Catálogo ('administrador'), Entradas, Salidas,
--                   Requisiciones ('ordenes') y Despacho.
-- permissions_roles se le da a cada rol que hoy VE esa sección: nadie pierde
--                   CoffeeIA al subir esto. Después se quita por rol en la
--                   columna IA. (Pedidos sigue además siendo solo de admins.)
--
-- Sin la casilla IA, la sección no pinta el ícono/botón de CoffeeIA y su ctrl
-- contesta 403 a las preguntas al asistente. El interruptor general sigue en
-- Administrador › CoffeeIA (coffeeia_config.active).
--
-- CORRER DESPUÉS de operacion/almacen/docs/sql/2026-10-19_requisiciones-y-despacho.sql
-- (crea Despacho) y ANTES de subir el código: sin la acción 'ia' nadie más que
-- el Super Admin vería CoffeeIA.
--
-- Idempotente. El -rollback la quita.
-- =====================================================================

-- 1. La acción.
INSERT INTO fayxzvov_erp.type_permissions (name, code, `order`, created_at, is_active)
SELECT 'IA', 'ia', 6, NOW(), 1
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM fayxzvov_erp.type_permissions WHERE code = 'ia');

-- 2. En las secciones con CoffeeIA.
INSERT INTO fayxzvov_erp.permissions (created_at, type_permission_id, section_id, is_active)
SELECT NOW(), tp.id, s.id, 1
  FROM fayxzvov_erp.sections s
  JOIN fayxzvov_erp.type_permissions tp ON tp.code = 'ia'
 WHERE s.code IN ('administrador', 'entradas', 'salidas', 'ordenes', 'despacho')
   AND NOT EXISTS (
       SELECT 1 FROM fayxzvov_erp.permissions x
        WHERE x.section_id = s.id AND x.type_permission_id = tp.id
 );

-- 3. A los roles que ya ven la sección.
INSERT INTO fayxzvov_erp.permissions_roles (permission_id, role_id)
SELECT pia.id, pr.role_id
  FROM fayxzvov_erp.permissions_roles pr
  JOIN fayxzvov_erp.permissions      pv  ON pv.id  = pr.permission_id
  JOIN fayxzvov_erp.type_permissions tv  ON tv.id  = pv.type_permission_id AND tv.code = 'ver'
  JOIN fayxzvov_erp.permissions      pia ON pia.section_id = pv.section_id
  JOIN fayxzvov_erp.type_permissions ti  ON ti.id  = pia.type_permission_id AND ti.code = 'ia'
 WHERE NOT EXISTS (
       SELECT 1 FROM fayxzvov_erp.permissions_roles x
        WHERE x.role_id = pr.role_id AND x.permission_id = pia.id
 );

-- VERIFICACIÓN: por sección, qué roles quedaron con IA.
SELECT s.name AS seccion, GROUP_CONCAT(r.name ORDER BY r.id SEPARATOR ', ') AS roles_con_ia
  FROM fayxzvov_erp.permissions p
  JOIN fayxzvov_erp.type_permissions tp ON tp.id = p.type_permission_id AND tp.code = 'ia'
  JOIN fayxzvov_erp.sections         s  ON s.id  = p.section_id
  LEFT JOIN fayxzvov_erp.permissions_roles pr ON pr.permission_id = p.id
  LEFT JOIN fayxzvov_erp.roles             r  ON r.id = pr.role_id
 GROUP BY s.id, s.name
 ORDER BY s.orden;
