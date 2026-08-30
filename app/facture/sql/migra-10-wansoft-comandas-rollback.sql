-- ============================================================================
--  Rollback de la migracion 10 — la comanda vuelve al ancho de Soft Restaurant
--
--  OJO con `description`: volver a VARCHAR(60) TRUNCA las notas de Wansoft que
--  pasen de 60 caracteres, y eso no se deshace. Por eso el rollback la deja
--  ancha: revertir una columna no debe costar datos. Si de verdad se quiere el
--  ancho original, hay que estrecharla a mano y a sabiendas.
--
--  Los renglones ya cargados NO se borran: siguen ahi, sin su accion ni su
--  grupo. Un renglon anulado queda indistinguible de uno vendido, asi que hay
--  que volver a cargar el archivo despues de reaplicar la migracion.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;


-- -- El renglon de la comanda --------------------------------------------------

DROP PROCEDURE IF EXISTS dropDetailSaleWansoft;

DELIMITER $$

CREATE PROCEDURE dropDetailSaleWansoft()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND INDEX_NAME   = 'idx_detail_sale_pdv'
    ) THEN
        ALTER TABLE detail_sale DROP INDEX idx_detail_sale_pdv;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND INDEX_NAME   = 'idx_detail_sale_action'
    ) THEN
        ALTER TABLE detail_sale DROP INDEX idx_detail_sale_action;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'unit_price'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN unit_price;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'is_modifier'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN is_modifier;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'capture_terminal'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN capture_terminal;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'group_name'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN group_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'group_type'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN group_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'action'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN action;
    END IF;
END$$

DELIMITER ;

CALL dropDetailSaleWansoft();

DROP PROCEDURE IF EXISTS dropDetailSaleWansoft;


-- -- La cabecera de la orden --------------------------------------------------

DROP PROCEDURE IF EXISTS dropSaleOrderTime;

DELIMITER $$

CREATE PROCEDURE dropSaleOrderTime()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'guest_count'
    ) THEN
        ALTER TABLE sale DROP COLUMN guest_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'order_type'
    ) THEN
        ALTER TABLE sale DROP COLUMN order_type;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'service_minutes'
    ) THEN
        ALTER TABLE sale DROP COLUMN service_minutes;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'opened_at'
    ) THEN
        ALTER TABLE sale DROP COLUMN opened_at;
    END IF;
END$$

DELIMITER ;

CALL dropSaleOrderTime();

DROP PROCEDURE IF EXISTS dropSaleOrderTime;
