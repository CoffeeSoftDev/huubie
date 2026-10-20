-- =====================================================================
-- Pedidos se separa en dos secciones del menú: Requisiciones y Despacho
-- Fecha: 19/10/2026
-- BD:    fayxzvov_erp
--
-- Antes: una sola sección (code 'ordenes', ordenes.php) con las pestañas
-- «Mis pedidos» (lo que pide mi sucursal) y «Mis entregas» (lo que me
-- piden a mí).
--
-- Ahora:
--   Requisiciones  code 'ordenes' (se queda: así conserva los permisos de
--                  cada rol), ruta requisiciones.php. Quien pide material.
--   Despacho       code 'despacho' (nueva), ruta despacho.php. Quien revisa,
--                  aprueba y surte lo que le piden a su sucursal.
--
-- Despacho nace con las mismas acciones que tenía 'ordenes' y se las da a
-- los mismos roles, MENOS al rol 'solicitante' (solo pide). Después se
-- ajusta por rol en Administrador > Accesos.
--
-- ordenes.php se queda como redirección (enlaces y avisos viejos).
--
-- CORRER ANTES de subir el código: despacho.php pide la sección 'despacho'
-- (Permissions::page) y la campana de avisos ya la usa.
--
-- Idempotente. El -rollback deja todo como estaba.
-- =====================================================================

-- 1. Requisiciones: la sección de siempre con su nombre y ruta nuevos.
UPDATE fayxzvov_erp.sections
   SET name  = 'Requisiciones',
       route = 'operacion/almacen/requisiciones.php',
       icon  = 'clipboard-list'
 WHERE code = 'ordenes';

-- 2. Despacho: sección nueva en el mismo módulo, justo después.
INSERT INTO fayxzvov_erp.sections (name, code, icon, created_at, orden, route, is_active, module_id, submodule_id)
SELECT 'Despacho', 'despacho', 'truck', NOW(), s.orden + 1, 'operacion/almacen/despacho.php', 1, s.module_id, s.submodule_id
  FROM fayxzvov_erp.sections s
 WHERE s.code = 'ordenes'
   AND NOT EXISTS (SELECT 1 FROM fayxzvov_erp.sections x WHERE x.code = 'despacho');

-- 3. Las mismas acciones que tenía 'ordenes' (ver, agregar, editar, cancelar...).
INSERT INTO fayxzvov_erp.permissions (created_at, type_permission_id, section_id, is_active)
SELECT NOW(), p.type_permission_id, d.id, p.is_active
  FROM fayxzvov_erp.permissions p
  JOIN fayxzvov_erp.sections o ON o.id = p.section_id AND o.code = 'ordenes'
  JOIN fayxzvov_erp.sections d ON d.code = 'despacho'
 WHERE NOT EXISTS (
       SELECT 1 FROM fayxzvov_erp.permissions x
        WHERE x.section_id = d.id AND x.type_permission_id = p.type_permission_id
 );

-- 4. Los mismos roles, acción por acción, menos el Solicitante.
INSERT INTO fayxzvov_erp.permissions_roles (permission_id, role_id)
SELECT pd.id, pr.role_id
  FROM fayxzvov_erp.permissions_roles pr
  JOIN fayxzvov_erp.roles       r  ON r.id  = pr.role_id AND r.code <> 'solicitante'
  JOIN fayxzvov_erp.permissions po ON po.id = pr.permission_id
  JOIN fayxzvov_erp.sections    so ON so.id = po.section_id AND so.code = 'ordenes'
  JOIN fayxzvov_erp.sections    sd ON sd.code = 'despacho'
  JOIN fayxzvov_erp.permissions pd ON pd.section_id = sd.id AND pd.type_permission_id = po.type_permission_id
 WHERE NOT EXISTS (
       SELECT 1 FROM fayxzvov_erp.permissions_roles x
        WHERE x.role_id = pr.role_id AND x.permission_id = pd.id
 );

-- VERIFICACIÓN: las dos secciones y, por rol, sus acciones en Despacho.
SELECT id, name, code, route, orden, is_active
  FROM fayxzvov_erp.sections
 WHERE code IN ('ordenes', 'despacho');

SELECT r.name AS rol, GROUP_CONCAT(tp.code ORDER BY tp.code) AS acciones_despacho
  FROM fayxzvov_erp.permissions_roles pr
  JOIN fayxzvov_erp.permissions      p  ON p.id  = pr.permission_id
  JOIN fayxzvov_erp.sections         s  ON s.id  = p.section_id AND s.code = 'despacho'
  JOIN fayxzvov_erp.type_permissions tp ON tp.id = p.type_permission_id
  JOIN fayxzvov_erp.roles            r  ON r.id  = pr.role_id
 GROUP BY r.id, r.name;
