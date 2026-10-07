-- =====================================================================
-- Sección "Reportes" del Almacén
-- Fecha: 07/10/2026
-- BD:    fayxzvov_erp
--
-- sections     alta de Reportes (operacion/almacen/reportes.php) en el
--              módulo 1, orden 9, ícono Lucide file-bar-chart.
-- permissions  los mismos roles que ven Stock (section_id 4: roles 1-4,
--              type_permission_id 1) ven Reportes.
--
-- Idempotente: se puede correr dos veces sin duplicar la sección ni los
-- permisos (NOT EXISTS por route y por rol).
-- El -rollback borra los permisos y la sección por route.
-- =====================================================================

INSERT INTO fayxzvov_erp.sections (name, code, icon, created_at, orden, route, is_active, module_id, submodule_id)
SELECT 'Reportes', 'reportes', 'file-bar-chart', NOW(), 9, 'operacion/almacen/reportes.php', 1, 1, NULL
  FROM DUAL
 WHERE NOT EXISTS (
       SELECT 1
         FROM fayxzvov_erp.sections
        WHERE route = 'operacion/almacen/reportes.php'
 );

INSERT INTO fayxzvov_erp.permissions (created_at, type_permission_id, role_id, section_id, is_active)
SELECT NOW(), 1, stock.role_id, s.id, 1
  FROM fayxzvov_erp.permissions stock
  JOIN fayxzvov_erp.sections s ON s.route = 'operacion/almacen/reportes.php'
 WHERE stock.section_id = 4
   AND stock.type_permission_id = 1
   AND stock.is_active = 1
   AND stock.role_id IN (1, 2, 3, 4)
   AND NOT EXISTS (
       SELECT 1
         FROM fayxzvov_erp.permissions p
        WHERE p.section_id = s.id
          AND p.role_id = stock.role_id
          AND p.type_permission_id = 1
   );

-- Verificación: una sección y cuatro permisos.
-- SELECT s.id, s.name, s.route, p.role_id, p.type_permission_id, p.is_active
--   FROM fayxzvov_erp.sections s
--   LEFT JOIN fayxzvov_erp.permissions p ON p.section_id = s.id
--  WHERE s.route = 'operacion/almacen/reportes.php';
