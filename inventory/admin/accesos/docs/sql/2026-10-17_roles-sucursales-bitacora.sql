-- =====================================================================
-- Configuración > Accesos: roles de la empresa, datos de sucursal y bitácora
-- Fecha: 17/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   1. audit_log: la bitácora de accesos. Un renglón por movimiento: alta,
--      edición, baja y contraseña de usuarios; alta, edición, permisos y
--      eliminación de roles; alta, edición y baja de sucursales; inicio y
--      cierre de sesión, y el Super Admin entrando a una empresa.
--      SOLO INSERT: la escribe conf/_Auditoria.php DESPUÉS de que la acción
--      salió bien. Sin FK: entity/entity_id apuntan con un valor porque un
--      rol eliminado se sigue contando, y por lo mismo `label` (el nombre del
--      elemento) y `user_name` (quién lo hizo) son copias. `detail` (JSON)
--      lleva el antes y el después. Mismo diseño que la bitácora del
--      facturador (app/facture/sql/migra-23-bitacora-de-auditoria.sql).
--   2. branches: teléfono, correo y responsable (users.id) de la sucursal.
--   3. roles: descripción del rol (la tarjeta del rol en Configuración).
--   4. La acción "Eliminar" en Configuración > Accesos (borrar roles), y se
--      le da al rol Dueño. Hasta hoy la sección solo tenía Ver, Agregar,
--      Editar y Cancelar.
--
-- CORRER ANTES de subir el código: Configuración lee y escribe estas
-- columnas y la tabla. Pide MySQL 5.7.8 o mayor (columna JSON).
-- Se puede volver a correr. El -rollback la deshace (y BORRA la bitácora).
-- =====================================================================

-- -- 1. La bitácora -----------------------------------------------------
--
-- Los índices salen de las preguntas de la pantalla: qué pasó en la
-- empresa en un periodo (company_id, created_at), qué le pasó a tal
-- elemento (entity, entity_id) y qué hizo tal usuario (user_id).

CREATE TABLE IF NOT EXISTS fayxzvov_erp.audit_log (
    id          INT(11)      NOT NULL AUTO_INCREMENT,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action      VARCHAR(30)  NOT NULL COMMENT 'crear · editar · eliminar · activar · desactivar · permisos · contrasena · iniciar-sesion · cerrar-sesion · entrar-empresa',
    entity      VARCHAR(40)  NOT NULL COMMENT 'users · roles · branches · sesion',
    entity_id   INT(11)      NULL     COMMENT 'id de la fila afectada · sin FK',
    label       VARCHAR(120) NOT NULL COMMENT 'lo que se lee en la lista: el nombre del usuario, rol o sucursal',
    detail      JSON         NULL     COMMENT 'antes y después, o el resumen de la acción',
    user_id     INT(11)      NULL     COMMENT 'quién lo hizo (users.id) · sin FK',
    user_name   VARCHAR(100) NULL     COMMENT 'copia del nombre',
    company_id  INT(11)      NULL,
    branch_id   INT(11)      NULL,
    ip          VARCHAR(45)  NULL,
    PRIMARY KEY (id),
    KEY idx_audit_company_fecha (company_id, created_at),
    KEY idx_audit_entidad       (entity, entity_id),
    KEY idx_audit_usuario       (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- -- 2. Datos de sucursal -----------------------------------------------

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'phone') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches ADD COLUMN phone VARCHAR(20) NULL DEFAULT NULL AFTER ubication');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'email') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches ADD COLUMN email VARCHAR(120) NULL DEFAULT NULL AFTER phone');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'manager_id') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.branches ADD COLUMN manager_id INT(11) NULL DEFAULT NULL COMMENT ''responsable (users.id)'' AFTER email');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- 3. Descripción del rol ---------------------------------------------

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'description') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_erp.roles ADD COLUMN description VARCHAR(255) NULL DEFAULT NULL AFTER name');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- 4. "Eliminar" en Configuración > Accesos, para el Dueño --------------

INSERT INTO fayxzvov_erp.permissions (section_id, type_permission_id, is_active, created_at)
SELECT s.id, tp.id, 1, NOW()
  FROM fayxzvov_erp.sections s
  JOIN fayxzvov_erp.type_permissions tp ON tp.code = 'eliminar'
 WHERE s.code = 'configuracion-accesos'
   AND NOT EXISTS (
        SELECT 1 FROM fayxzvov_erp.permissions p
         WHERE p.section_id = s.id AND p.type_permission_id = tp.id
   );

INSERT INTO fayxzvov_erp.permissions_roles (role_id, permission_id)
SELECT r.id, p.id
  FROM fayxzvov_erp.roles r
  JOIN fayxzvov_erp.sections s          ON s.code = 'configuracion-accesos'
  JOIN fayxzvov_erp.type_permissions tp ON tp.code = 'eliminar'
  JOIN fayxzvov_erp.permissions p       ON p.section_id = s.id AND p.type_permission_id = tp.id
 WHERE r.code = 'dueno'
   AND NOT EXISTS (
        SELECT 1 FROM fayxzvov_erp.permissions_roles pr
         WHERE pr.role_id = r.id AND pr.permission_id = p.id
   );
