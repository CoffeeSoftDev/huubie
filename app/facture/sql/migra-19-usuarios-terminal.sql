-- ============================================================================
--  Migracion 19 — usuarios y permisos de la terminal Wansoft (facture2)
--
--  La pantalla de acceso de facture2 pide una contraseña numerica y hasta hoy
--  dejaba pasar cualquiera: no habia a quien compararla. Esta migracion crea
--  los dos usuarios que pide la seccion "Inicio de sesion":
--
--      Administrador   Configurar catalogos · Consultar reportes · Reimprime
--                      · Generar tickets
--      Operador        Generar tickets · Reimprime
--
--  ── Por que tablas propias y no las de Huubie ──────────────────────────────
--  El esquema del Facturador es autonomo (company → branch propias, cero FK
--  cross-schema). Los usuarios de la terminal siguen esa regla: cuelgan de
--  `branch`, no de `usr_users` de otra base.
--
--  ── Los permisos van por ROL, no por usuario ────────────────────────────────
--  El permiso se pregunta por `permission.code` —la llave fija que lee el
--  codigo— y `name` es solo como se lee en pantalla. Cambiar un rotulo no rompe
--  ningun candado.
--
--  ── El PIN ──────────────────────────────────────────────────────────────────
--  Se guarda en bcrypt (password_hash de PHP), igual que inventory. MySQL no
--  sabe generar bcrypt, por eso los dos hashes van ya calculados:
--
--      Administrador   1234
--      Operador        5678
--
--  Son PIN de arranque: en produccion hay que cambiarlos.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-19-usuarios-terminal-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

SET NAMES utf8mb4;


-- -- Catalogo de roles ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS `role` (
    `id`         INT(11)      NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(100) NOT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `active`     TINYINT(4)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -- Catalogo de permisos ------------------------------------------------------

CREATE TABLE IF NOT EXISTS `permission` (
    `id`         INT(11)      NOT NULL AUTO_INCREMENT,
    `code`       VARCHAR(50)  NOT NULL COMMENT 'llave que pregunta el codigo · no cambia',
    `name`       VARCHAR(100) NOT NULL COMMENT 'como se lee en pantalla',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `active`     TINYINT(4)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_permission_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -- Pivote rol ↔ permiso ------------------------------------------------------

CREATE TABLE IF NOT EXISTS `role_permission` (
    `role_id`       INT(11) NOT NULL,
    `permission_id` INT(11) NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    KEY `idx_role_permission_permission` (`permission_id`),
    CONSTRAINT `fk_role_permission_role`       FOREIGN KEY (`role_id`)       REFERENCES `role` (`id`)       ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_role_permission_permission` FOREIGN KEY (`permission_id`) REFERENCES `permission` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -- Usuarios de la terminal ---------------------------------------------------

CREATE TABLE IF NOT EXISTS `user` (
    `id`         INT(11)      NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(100) NOT NULL,
    `pin`        VARCHAR(255) NOT NULL COMMENT 'bcrypt · password_hash de PHP',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `role_id`    INT(11)      DEFAULT NULL,
    `branch_id`  INT(11)      DEFAULT NULL,
    `active`     TINYINT(4)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_name` (`name`, `branch_id`),
    KEY `idx_user_role` (`role_id`),
    KEY `idx_user_branch` (`branch_id`),
    CONSTRAINT `fk_user_role`   FOREIGN KEY (`role_id`)   REFERENCES `role` (`id`)   ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_user_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -- Siembra: roles y permisos -------------------------------------------------

INSERT IGNORE INTO `role` (`name`) VALUES
    ('Administrador'),
    ('Operador');

INSERT IGNORE INTO `permission` (`code`, `name`) VALUES
    ('catalogos',   'Configurar catálogos'),
    ('reportes',    'Consultar reportes'),
    ('reimpresion', 'Reimprime'),
    ('tickets',     'Generar tickets');

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `role` r
  JOIN `permission` p ON p.code IN ('catalogos', 'reportes', 'reimpresion', 'tickets')
 WHERE r.name = 'Administrador';

INSERT IGNORE INTO `role_permission` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `role` r
  JOIN `permission` p ON p.code IN ('tickets', 'reimpresion')
 WHERE r.name = 'Operador';


-- -- Siembra: los dos usuarios -------------------------------------------------
--
-- Cuelgan de la primera sucursal activa, que es la misma que resuelve la
-- terminal (resolveBranch en ctrl-facture2-pos.php). El NOT EXISTS y no el
-- INSERT IGNORE: sin sucursal el branch_id queda NULL y el UNIQUE no frena el
-- duplicado.
--
-- El NOT EXISTS pregunta por el ROL y no por el nombre: el nombre se puede
-- cambiar despues, y volver a correr esto sembraria un segundo usuario.

SET @branch = (SELECT id FROM `branch` WHERE active = 1 ORDER BY id ASC LIMIT 1);

INSERT INTO `user` (`name`, `pin`, `role_id`, `branch_id`)
SELECT 'Administrador', '$2y$10$Wue9jeLZVDbyX4zvQfZupu5NhDzjPmuW9arjyFF419UoVLPQz0/EW', r.id, @branch
  FROM `role` r
 WHERE r.name = 'Administrador'
   AND NOT EXISTS (SELECT 1 FROM `user` u WHERE u.role_id = r.id AND u.branch_id <=> @branch);

INSERT INTO `user` (`name`, `pin`, `role_id`, `branch_id`)
SELECT 'Operador', '$2y$10$H4qaC.NZhvpR6lNJsYtCc.Af03Kp4LwY.V0gG9r259lshXKgFQnxu', r.id, @branch
  FROM `role` r
 WHERE r.name = 'Operador'
   AND NOT EXISTS (SELECT 1 FROM `user` u WHERE u.role_id = r.id AND u.branch_id <=> @branch);
