-- ---------------------------------------------------------------------------
--  Catalogo de puntos de venta (POS) y su enlace con la sucursal
--  Esquema: fayxzvov_facturacion
--
--  Cada sucursal opera con un solo software de punto de venta (Soft Restaurant
--  o Wansoft). De ese dato dependen el layout del reporte que se importa en
--  Cargas y el formato del ticket, asi que vive en la sucursal y no en la
--  sesion: cambiar de sucursal cambia el software que esta operando.
-- ---------------------------------------------------------------------------

USE fayxzvov_facturacion;

-- `code` es la llave estable con la que el codigo pregunta por el sistema
-- ('soft-restaurant' / 'wansoft'); `name` es solo lo que se muestra y se puede
-- reetiquetar sin romper nada.
--
-- `color` es el hex con el que se distingue cada sistema en pantalla. Vive en el
-- catalogo y no en el CSS porque un sistema nuevo debe traer su color con el
-- renglon: la interfaz lo lee, no lo decide.
CREATE TABLE IF NOT EXISTS `pos` (
  `id`         int         NOT NULL AUTO_INCREMENT,
  `name`       varchar(60) NOT NULL,
  `code`       varchar(30) NOT NULL,
  `color`      varchar(7)  NOT NULL DEFAULT '#6B7280',
  `created_at` datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`     tinyint     NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE KEY `uk_pos_code` (`code`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=DYNAMIC;

-- Los dos colores son los que ya usa la terminal: el naranja y el azul salen de
-- wansoft-theme.css (--ws-orange / --ws-blue), no de una paleta inventada aqui.
INSERT INTO `pos` (`name`, `code`, `color`) VALUES
    ('Soft Restaurant', 'soft-restaurant', '#F4511E'),
    ('Wansoft',         'wansoft',         '#2B4FD8')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `color` = VALUES(`color`);

-- pos_id admite NULL: una sucursal dada de alta antes de este catalogo queda
-- "sin definir" hasta que alguien la capture, en vez de arrancar mintiendo con
-- un sistema que quiza no es el suyo.
ALTER TABLE `branch`
    ADD COLUMN `pos_id` int DEFAULT NULL AFTER `company_id`,
    ADD KEY `idx_branch_pos` (`pos_id`) USING BTREE,
    ADD CONSTRAINT `fk_branch_pos` FOREIGN KEY (`pos_id`) REFERENCES `pos` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
--  Solo para bases donde `pos` ya se creo sin la columna `color`. En una base
--  limpia este bloque sobra: el CREATE de arriba ya la trae.
-- ---------------------------------------------------------------------------
-- ALTER TABLE `pos` ADD COLUMN `color` varchar(7) NOT NULL DEFAULT '#6B7280' AFTER `code`;
-- UPDATE `pos` SET `color` = '#F4511E' WHERE `code` = 'soft-restaurant';
-- UPDATE `pos` SET `color` = '#2B4FD8' WHERE `code` = 'wansoft';
