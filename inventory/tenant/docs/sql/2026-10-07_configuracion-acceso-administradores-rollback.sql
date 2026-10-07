-- =====================================================================
-- ROLLBACK :: Configuración > Accesos para andres@ y andrea@reginas.com
-- Fecha: 07/10/2026
-- BD:    fayxzvov_erp
--
-- Apaga el Acceso a 'configuracion-accesos' de los roles de esos dos
-- usuarios (el Super Admin conserva el suyo). Se apaga y no se borra, como
-- hace el editor de Permisos.
-- =====================================================================

SET @section_id = (SELECT id FROM fayxzvov_erp.sections
                   WHERE code = 'configuracion-accesos' ORDER BY id DESC LIMIT 1);

UPDATE fayxzvov_erp.permissions p
JOIN (SELECT DISTINCT ub.role_id
      FROM fayxzvov_erp.users u
      JOIN fayxzvov_erp.users_braches ub ON ub.user_id = u.id
      WHERE LOWER(u.email) IN ('andres@reginas.com', 'andrea@reginas.com')
        AND ub.role_id IS NOT NULL
        AND ub.role_id <> 1) AS t ON t.role_id = p.role_id
SET p.is_active = 0
WHERE p.section_id = @section_id
  AND p.type_permission_id = 1;
