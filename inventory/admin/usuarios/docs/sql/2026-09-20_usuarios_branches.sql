-- ============================================================================
--  2026-09-20 · admin/usuarios · Sucursales asignadas al usuario (N:N)
-- ----------------------------------------------------------------------------
--  La tabla legacy `usuarios` solo tiene pertenencia unica (`usr_udn`). Este
--  pivote permite asignar VARIAS sucursales a un mismo usuario, igual que el
--  selector multiple de `app/admin`. `usr_udn` se deja intacta.
--
--  Aplicada en LOCAL el 20/09/2026. PENDIENTE en produccion.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `fayxzvov_erp`.`usuarios_branches` (
    `id`        INT(11) NOT NULL AUTO_INCREMENT,
    `idUser`    INT(11) NOT NULL,
    `branch_id` INT(11) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_usuario_branch` (`idUser`, `branch_id`),
    KEY `idx_ub_branch` (`branch_id`),
    CONSTRAINT `fk_ub_usuario` FOREIGN KEY (`idUser`)
        REFERENCES `fayxzvov_erp`.`usuarios` (`idUser`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_ub_branch` FOREIGN KEY (`branch_id`)
        REFERENCES `fayxzvov_erp`.`branches` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
