-- =============================================================================
-- Sellos en las tarjetas de lealtad («junta N sellos y llévate un premio»)
-- Fecha:     17/11/2026
-- BD:        fayxzvov_pos
-- Requiere:  2026-11-17_tarjeta-digital.sql
-- Rollback:  2026-11-17_sellos-rollback.sql
-- Plan:      pro/app/lealtad/docs/plan-sellos.html
--
-- Antes:  un tipo de tarjeta daba descuento O puntos.
-- Despues tambien puede dar sellos (uno solo de los tres):
--   card_type.stamp_amount  $ pagados por cada sello (1 sello por cada $X)
--   card_type.stamp_goal    sellos que hacen falta para el premio; > 0 = tipo de sellos
--   card_type.reward_name   el premio, p. ej. «Café gratis»
--   card_type.reward_value  lo mas que descuenta el premio al canjearlo
--   card_type.stamp_icon    el icono del sello (nombre de Lucide, p. ej. «coffee»);
--                           NULL = un circulo liso
--   card_stamp              cada movimiento de sellos de una tarjeta:
--                             kind 'sello'  qty +n (los que dio una venta)
--                             kind 'canje'  qty -meta y amount = lo descontado
--                           Los sellos de hoy = SUM(qty) de las filas vivas
--                           (active = 1 y deleted_at NULL). Cancelar la venta
--                           anula sus filas: borrado logico.
--
-- No toca ningun dato: los tipos que existen quedan sin sellos (NULL).
-- Se puede volver a correr: columnas, tabla e indices se agregan solo si faltan.
-- IMPORTANTE: correr ANTES de subir el codigo. mdl-lealtad.php lee estas
-- columnas en todas las consultas de tarjetas, tambien las de Vender e Historial.
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'stamp_amount') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.card_type
                   ADD COLUMN stamp_amount DECIMAL(10,2) NULL DEFAULT NULL COMMENT '$ por cada sello' AFTER points_percent,
                   ADD COLUMN stamp_goal INT NULL DEFAULT NULL COMMENT 'sellos para el premio; > 0 = tipo de sellos' AFTER stamp_amount,
                   ADD COLUMN reward_name VARCHAR(80) NULL DEFAULT NULL COMMENT 'el premio' AFTER stamp_goal,
                   ADD COLUMN reward_value DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'lo mas que descuenta el premio' AFTER reward_name");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME = 'stamp_icon') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.card_type ADD COLUMN stamp_icon VARCHAR(40) NULL DEFAULT NULL COMMENT 'icono Lucide del sello; NULL = circulo' AFTER reward_value");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS fayxzvov_pos.card_stamp (
    id               INT NOT NULL AUTO_INCREMENT,
    card_id          INT NOT NULL,
    sale_id          INT NULL DEFAULT NULL,
    kind             VARCHAR(10) NOT NULL COMMENT 'sello | canje',
    qty              INT NOT NULL COMMENT '+n sellos; -meta al canjear',
    amount           DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'canje: lo descontado',
    branch_id        INT NULL DEFAULT NULL,
    user_id          INT NULL DEFAULT NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active           TINYINT NOT NULL DEFAULT 1,
    deleted_at       DATETIME NULL DEFAULT NULL,
    deleted_user_id  INT NULL DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_card_stamp_card (card_id, active),
    KEY idx_card_stamp_sale (sale_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- -- Comprobacion --

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'card_type' AND COLUMN_NAME IN ('stamp_amount', 'stamp_goal', 'reward_name', 'reward_value', 'stamp_icon')
ORDER BY ORDINAL_POSITION;

SELECT COUNT(*) AS card_stamp_rows FROM fayxzvov_pos.card_stamp;
