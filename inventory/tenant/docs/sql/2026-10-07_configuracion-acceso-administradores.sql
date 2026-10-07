-- =====================================================================
-- Configuración > Accesos para andres@reginas.com y andrea@reginas.com
-- Fecha: 07/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   Los permisos son por rol (permissions.role_id), no por usuario: se da
--   Acceso (1) a la sección 'configuracion-accesos' al rol que esos dos
--   usuarios tienen en sus sucursales (hoy, Administrador). Con eso les
--   aparece la card Configuración en /inventory/modulos/ y la sección en el
--   rail. Lo hereda cualquier usuario con ese mismo rol.
--
-- CORRER DESPUÉS de 2026-10-06_seccion-configuracion-accesos.sql (crea la
-- sección). Nunca toca el rol 1 (Super Admin), que ya tiene el permiso.
-- IDEMPOTENTE: reactiva el permiso si existía apagado y no duplica.
-- El -rollback lo apaga.
-- =====================================================================

SET @section_id = (SELECT id FROM fayxzvov_erp.sections
                   WHERE code = 'configuracion-accesos' ORDER BY id DESC LIMIT 1);


-- 1) Roles de esos usuarios en users_braches ------------------------------
DROP TEMPORARY TABLE IF EXISTS fayxzvov_erp.tmp_roles_config;
CREATE TEMPORARY TABLE fayxzvov_erp.tmp_roles_config AS
SELECT DISTINCT ub.role_id
FROM fayxzvov_erp.users u
JOIN fayxzvov_erp.users_braches ub ON ub.user_id = u.id
WHERE LOWER(u.email) IN ('andres@reginas.com', 'andrea@reginas.com')
  AND ub.role_id IS NOT NULL
  AND ub.role_id <> 1;


-- 2) Reactivar si ya existía apagado --------------------------------------
UPDATE fayxzvov_erp.permissions p
JOIN fayxzvov_erp.tmp_roles_config t ON t.role_id = p.role_id
SET p.is_active = 1
WHERE p.section_id = @section_id
  AND p.type_permission_id = 1;


-- 3) Crear el que falte ---------------------------------------------------
INSERT INTO fayxzvov_erp.permissions
    (role_id, section_id, type_permission_id, is_active, created_at)
SELECT t.role_id, @section_id, 1, 1, NOW()
FROM fayxzvov_erp.tmp_roles_config t
LEFT JOIN (SELECT role_id, section_id, type_permission_id
           FROM fayxzvov_erp.permissions) AS p
       ON p.role_id            = t.role_id
      AND p.section_id         = @section_id
      AND p.type_permission_id = 1
WHERE p.role_id IS NULL
  AND @section_id IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS fayxzvov_erp.tmp_roles_config;


-- 4) VERIFICACIÓN: módulos que verá cada uno (misma cadena que el dashboard)
SELECT u.email, b.name AS sucursal, r.name AS rol,
       GROUP_CONCAT(DISTINCT m.name ORDER BY m.orden SEPARATOR ', ') AS modulos
FROM fayxzvov_erp.users u
JOIN fayxzvov_erp.users_braches ub ON ub.user_id = u.id
JOIN fayxzvov_erp.branches b       ON b.id = ub.branch_id
JOIN fayxzvov_erp.roles r          ON r.id = ub.role_id
JOIN fayxzvov_erp.permissions p    ON p.role_id = ub.role_id AND p.is_active = 1
JOIN fayxzvov_erp.sections s       ON s.id = p.section_id AND s.is_active = 1
JOIN fayxzvov_erp.modules m        ON m.id = s.module_id AND m.is_active = 1
WHERE LOWER(u.email) IN ('andres@reginas.com', 'andrea@reginas.com')
GROUP BY u.email, b.name, r.name
ORDER BY u.email, b.name;
