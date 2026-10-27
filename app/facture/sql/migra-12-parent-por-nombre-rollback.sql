-- ============================================================================
--  Rollback de la migracion 12
--
--  Devuelve la columna a `parent_product_code VARCHAR(10)`. OJO: eso TRUNCA los
--  nombres a diez caracteres y el dato no se recupera —«YAKIMESHI DE CAMARON
--  AGRIDULCE» vuelve a ser «YAKIMESHI »—. Hay que recargar el archivo de
--  comandas despues de reaplicar la 12.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS undoParentProduct;

DELIMITER $$

CREATE PROCEDURE undoParentProduct()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'parent_product_name'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'detail_sale'
               AND INDEX_NAME   = 'idx_detail_sale_parent'
        ) THEN
            ALTER TABLE detail_sale DROP INDEX idx_detail_sale_parent;
        END IF;

        ALTER TABLE detail_sale
            CHANGE COLUMN parent_product_name parent_product_code VARCHAR(10) NULL
                COMMENT 'platillo al que acompana el modificador';

        ALTER TABLE detail_sale ADD KEY idx_detail_sale_parent (parent_product_code);
    END IF;
END$$

DELIMITER ;

CALL undoParentProduct();

DROP PROCEDURE IF EXISTS undoParentProduct;
