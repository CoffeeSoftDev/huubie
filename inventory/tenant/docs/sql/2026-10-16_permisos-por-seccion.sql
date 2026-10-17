-- =====================================================================
-- Permisos por sección: permissions = acciones de la sección,
-- permissions_roles = acciones que tiene cada rol
-- Fecha: 16/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   Antes cada fila de permissions era "este rol tiene este tipo de permiso
--   en esta sección" (role_id + section_id + type_permission_id). Ahora:
--     permissions       = catálogo de acciones de cada sección (sin role_id).
--     permissions_roles = acciones de ese catálogo que tiene cada rol.
--
--   1) Respaldo de permissions en permissions_bk_20261016 (lo usa el -rollback).
--   2) Tipos nuevos: Subir comprobante, Agregar conteo, Cancelar conteo, Imprimir.
--   3) Sección Dashboard en Inventario: la página operacion/almacen/dashboard.php
--      ya existía pero no tenía sección, y el Dashboard lleva su permiso "Ver".
--   4) permissions sin role_id y sin las filas viejas (eran permisos por rol).
--      UNIQUE (section_id, type_permission_id) y UNIQUE (role_id, permission_id).
--   5) Catálogo de acciones por sección.
--   6) Roles: Administrador -> Dueño, Operador -> Almacenista,
--      Consulta -> Supervisor/Auditor, y se crea Solicitante. Se renombran en
--      lugar de crearse para que cada usuario conserve su rol en sus sucursales.
--   7) Acciones de cada rol. El Super Admin no lleva filas: tiene acceso total
--      por código (acceso/mdl/mdl-access.php::userIsSuperAdmin).
--
-- Compras y Programadas quedan sin acciones (pendientes): solo las ve el
-- Super Admin hasta que se les definan en la pestaña Permisos del tenant.
-- Solicitante queda sin acciones por lo mismo (su módulo es Compras).
--
-- Se puede volver a correr: cada paso revisa si ya se hizo. Las acciones de un
-- rol solo se siembran si ese rol todavía no tiene ninguna, para no regresarle
-- lo que se le haya quitado desde el tenant. El -rollback lo deshace.
-- =====================================================================

-- ¿permissions todavía tiene role_id? Solo entonces hay algo que respaldar.
SET @has_role_id = (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                      AND TABLE_NAME   = 'permissions'
                      AND COLUMN_NAME  = 'role_id');


-- 1) Respaldo -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fayxzvov_erp.permissions_bk_20261016 AS
SELECT * FROM fayxzvov_erp.permissions WHERE @has_role_id > 0;


-- 2) Tipos nuevos, al final del orden actual ------------------------------
SET @max_order = (SELECT COALESCE(MAX(`order`), 0) FROM fayxzvov_erp.type_permissions);

INSERT INTO fayxzvov_erp.type_permissions (name, `order`, is_active, created_at)
SELECT n.name, @max_order + n.pos, 1, NOW()
FROM (
              SELECT 'Subir comprobante' AS name, 1 AS pos
    UNION ALL SELECT 'Agregar conteo',  2
    UNION ALL SELECT 'Cancelar conteo', 3
    UNION ALL SELECT 'Imprimir',        4
) AS n
LEFT JOIN (SELECT id, name FROM fayxzvov_erp.type_permissions) AS tp ON tp.name = n.name
WHERE tp.id IS NULL;


-- 3) Sección Dashboard de Inventario (primera del rail) -------------------
SET @inventario = (SELECT id FROM fayxzvov_erp.modules WHERE code = 'inventario' ORDER BY id LIMIT 1);

INSERT INTO fayxzvov_erp.sections (name, code, icon, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Dashboard', 'dashboard', 'layout-dashboard', 'operacion/almacen/dashboard.php', 0, @inventario, NULL, 1, NOW()
FROM DUAL
WHERE @inventario IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM fayxzvov_erp.sections
                                 WHERE module_id = @inventario AND code = 'dashboard') AS d);


-- 4) permissions sin role_id ----------------------------------------------
SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
           WHERE TABLE_SCHEMA = 'fayxzvov_erp'
             AND TABLE_NAME   = 'permissions'
             AND COLUMN_NAME  = 'role_id'
             AND REFERENCED_TABLE_NAME = 'roles'
           LIMIT 1);
SET @sql = IF(@fk IS NULL, 'DO 0',
              CONCAT('ALTER TABLE fayxzvov_erp.permissions DROP FOREIGN KEY `', @fk, '`'));
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Al borrar la columna MySQL borra también su índice.
SET @sql = IF(@has_role_id = 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.permissions DROP COLUMN role_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Las filas viejas son las del respaldo (las del catálogo nuevo nacen con id
-- mayor). Su borrado arrastra lo que tuvieran en permissions_roles (CASCADE).
DELETE FROM fayxzvov_erp.permissions
WHERE id IN (SELECT id FROM fayxzvov_erp.permissions_bk_20261016);

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'permissions'
                 AND INDEX_NAME   = 'uq_permissions_section_type') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.permissions ADD UNIQUE KEY uq_permissions_section_type (section_id, type_permission_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp'
                 AND TABLE_NAME   = 'permissions_roles'
                 AND INDEX_NAME   = 'uq_permissions_roles_role_permission') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.permissions_roles ADD UNIQUE KEY uq_permissions_roles_role_permission (role_id, permission_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 5) Catálogo de acciones por sección -------------------------------------
-- Ojo: el code de la sección Catálogo es 'administrador'.
INSERT IGNORE INTO fayxzvov_erp.permissions (section_id, type_permission_id, is_active, created_at)
SELECT s.id, tp.id, 1, NOW()
FROM (
              SELECT 'inventario' AS module_code, 'dashboard' AS section_code, 'Ver' AS type_name
    UNION ALL SELECT 'inventario',    'administrador',         'Ver'
    UNION ALL SELECT 'inventario',    'administrador',         'Agregar'
    UNION ALL SELECT 'inventario',    'administrador',         'Editar'
    UNION ALL SELECT 'inventario',    'administrador',         'Cancelar'
    UNION ALL SELECT 'inventario',    'administrador',         'Eliminar'
    UNION ALL SELECT 'inventario',    'entradas',              'Ver'
    UNION ALL SELECT 'inventario',    'entradas',              'Agregar'
    UNION ALL SELECT 'inventario',    'entradas',              'Editar'
    UNION ALL SELECT 'inventario',    'entradas',              'Cancelar'
    UNION ALL SELECT 'inventario',    'entradas',              'Subir comprobante'
    UNION ALL SELECT 'inventario',    'salidas',               'Ver'
    UNION ALL SELECT 'inventario',    'salidas',               'Agregar'
    UNION ALL SELECT 'inventario',    'salidas',               'Editar'
    UNION ALL SELECT 'inventario',    'salidas',               'Cancelar'
    UNION ALL SELECT 'inventario',    'salidas',               'Subir comprobante'
    UNION ALL SELECT 'inventario',    'stock',                 'Ver'
    UNION ALL SELECT 'inventario',    'stock',                 'Agregar conteo'
    UNION ALL SELECT 'inventario',    'stock',                 'Cancelar conteo'
    UNION ALL SELECT 'inventario',    'reportes',              'Ver'
    UNION ALL SELECT 'inventario',    'reportes',              'Imprimir'
    UNION ALL SELECT 'configuracion', 'configuracion-accesos', 'Ver'
    UNION ALL SELECT 'configuracion', 'configuracion-accesos', 'Agregar'
    UNION ALL SELECT 'configuracion', 'configuracion-accesos', 'Editar'
    UNION ALL SELECT 'configuracion', 'configuracion-accesos', 'Cancelar'
) AS c
JOIN fayxzvov_erp.modules m           ON m.code = c.module_code
JOIN fayxzvov_erp.sections s          ON s.module_id = m.id AND s.code = c.section_code
JOIN fayxzvov_erp.type_permissions tp ON tp.name = c.type_name;


-- 6) Roles ----------------------------------------------------------------
UPDATE fayxzvov_erp.roles SET code = 'dueno',       name = 'Dueño'              WHERE code = 'admin';
UPDATE fayxzvov_erp.roles SET code = 'almacenista', name = 'Almacenista'        WHERE code = 'operador';
UPDATE fayxzvov_erp.roles SET code = 'supervisor',  name = 'Supervisor/Auditor' WHERE code = 'consulta';

-- Misma empresa que el resto de los roles, para que salga en Configuración > Accesos.
INSERT INTO fayxzvov_erp.roles (code, name, is_system, is_active, company_id, created_at)
SELECT 'solicitante', 'Solicitante', 0, 1, d.company_id, NOW()
FROM (SELECT company_id FROM fayxzvov_erp.roles WHERE code = 'dueno' ORDER BY id LIMIT 1) AS d
WHERE NOT EXISTS (SELECT 1 FROM (SELECT id FROM fayxzvov_erp.roles WHERE code = 'solicitante') AS x);


-- 7) Acciones de cada rol (solo a los que todavía no tienen ninguna) ------
-- Dueño y Almacenista: todo el catálogo.
INSERT IGNORE INTO fayxzvov_erp.permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM fayxzvov_erp.roles r
JOIN fayxzvov_erp.permissions p ON p.is_active = 1
WHERE r.code IN ('dueno', 'almacenista')
  AND NOT EXISTS (SELECT 1 FROM (SELECT role_id FROM fayxzvov_erp.permissions_roles) AS x
                  WHERE x.role_id = r.id);

-- Supervisor/Auditor: ver todo, cancelar entradas y salidas, conteos e impresión de reportes.
INSERT IGNORE INTO fayxzvov_erp.permissions_roles (permission_id, role_id)
SELECT p.id, r.id
FROM (
              SELECT 'inventario' AS module_code, 'dashboard' AS section_code, 'Ver' AS type_name
    UNION ALL SELECT 'inventario', 'administrador', 'Ver'
    UNION ALL SELECT 'inventario', 'entradas',      'Ver'
    UNION ALL SELECT 'inventario', 'entradas',      'Cancelar'
    UNION ALL SELECT 'inventario', 'salidas',       'Ver'
    UNION ALL SELECT 'inventario', 'salidas',       'Cancelar'
    UNION ALL SELECT 'inventario', 'stock',         'Ver'
    UNION ALL SELECT 'inventario', 'stock',         'Agregar conteo'
    UNION ALL SELECT 'inventario', 'stock',         'Cancelar conteo'
    UNION ALL SELECT 'inventario', 'reportes',      'Ver'
    UNION ALL SELECT 'inventario', 'reportes',      'Imprimir'
) AS c
JOIN fayxzvov_erp.modules m           ON m.code = c.module_code
JOIN fayxzvov_erp.sections s          ON s.module_id = m.id AND s.code = c.section_code
JOIN fayxzvov_erp.type_permissions tp ON tp.name = c.type_name
JOIN fayxzvov_erp.permissions p       ON p.section_id = s.id AND p.type_permission_id = tp.id
JOIN fayxzvov_erp.roles r             ON r.code = 'supervisor'
WHERE NOT EXISTS (SELECT 1 FROM (SELECT role_id FROM fayxzvov_erp.permissions_roles) AS x
                  WHERE x.role_id = r.id);


-- 8) VERIFICACIÓN: acciones de cada rol por sección ------------------------
SELECT r.name AS rol, m.name AS modulo, s.name AS seccion,
       GROUP_CONCAT(tp.name ORDER BY tp.`order` SEPARATOR ', ') AS acciones
FROM fayxzvov_erp.roles r
JOIN fayxzvov_erp.permissions_roles pr ON pr.role_id = r.id
JOIN fayxzvov_erp.permissions p        ON p.id = pr.permission_id
JOIN fayxzvov_erp.sections s           ON s.id = p.section_id
JOIN fayxzvov_erp.modules m            ON m.id = s.module_id
JOIN fayxzvov_erp.type_permissions tp  ON tp.id = p.type_permission_id
GROUP BY r.id, m.id, s.id
ORDER BY r.id, m.orden, s.orden;
