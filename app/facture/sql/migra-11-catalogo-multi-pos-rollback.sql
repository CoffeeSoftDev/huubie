-- ============================================================================
--  Rollback de la migracion 11
--
--  Devuelve `group_type` y `group_name` a `detail_sale`, que es donde los dejo
--  migra-10, y quita del catalogo lo que esta migracion le agrego.
--
--  El UNIQUE vuelve a (code, branch_id). OJO: si para entonces conviven dos POS
--  con la misma clave en la misma sucursal, el indice NO se puede recrear y el
--  ALTER falla — que es lo correcto, porque restaurarlo a la fuerza significaria
--  borrar productos. En ese caso hay que decidir a mano que catalogo se queda.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;


-- -- El renglon recupera el grupo ---------------------------------------------

DROP PROCEDURE IF EXISTS undoDetailSaleColumns;

DELIMITER $$

CREATE PROCEDURE undoDetailSaleColumns()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND INDEX_NAME   = 'idx_detail_sale_parent'
    ) THEN
        ALTER TABLE detail_sale DROP INDEX idx_detail_sale_parent;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'parent_product_code'
    ) THEN
        ALTER TABLE detail_sale DROP COLUMN parent_product_code;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'group_type'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN group_type VARCHAR(30) NULL AFTER action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'group_name'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN group_name VARCHAR(60) NULL AFTER group_type;
    END IF;
END$$

DELIMITER ;

CALL undoDetailSaleColumns();

DROP PROCEDURE IF EXISTS undoDetailSaleColumns;


-- -- El catalogo vuelve a no saber de POS -------------------------------------

DROP PROCEDURE IF EXISTS undoProductPosGroup;

DELIMITER $$

CREATE PROCEDURE undoProductPosGroup()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND INDEX_NAME   = 'uk_product_code'
           AND COLUMN_NAME  = 'pos_id'
    ) THEN
        ALTER TABLE product DROP INDEX uk_product_code;
        ALTER TABLE product ADD UNIQUE KEY uk_product_code (code, branch_id);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA    = DATABASE()
           AND TABLE_NAME      = 'product'
           AND CONSTRAINT_NAME = 'fk_product_pos'
    ) THEN
        ALTER TABLE product DROP FOREIGN KEY fk_product_pos;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND COLUMN_NAME  = 'pos_id'
    ) THEN
        ALTER TABLE product DROP COLUMN pos_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND INDEX_NAME   = 'idx_product_group'
    ) THEN
        ALTER TABLE product DROP INDEX idx_product_group;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND COLUMN_NAME  = 'group_name'
    ) THEN
        ALTER TABLE product DROP COLUMN group_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND COLUMN_NAME  = 'group_type'
    ) THEN
        ALTER TABLE product DROP COLUMN group_type;
    END IF;
END$$

DELIMITER ;

CALL undoProductPosGroup();

DROP PROCEDURE IF EXISTS undoProductPosGroup;
