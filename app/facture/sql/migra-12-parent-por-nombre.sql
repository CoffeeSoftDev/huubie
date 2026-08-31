-- ============================================================================
--  Migracion 12 — el modificador nombra a su platillo, no lo codifica
--
--  `parent_product_code VARCHAR(10)` de migra-11 partia de un supuesto que la
--  primera carga real desmintio: que el archivo identificaba al platillo padre
--  con su clave. No lo hace. Lo identifica por NOMBRE, y los nombres no caben en
--  diez caracteres:
--
--      guardado   «YAKIMESHI »
--      real       «YAKIMESHI DE CAMARON AGRIDULCE»
--
--  Se renombra a `parent_product_name` y se ensancha a 60 —el mismo ancho de
--  `product.name`, que es de donde sale el valor—. El nombre de la columna deja
--  de mentir: lo que guarda es un nombre.
--
--  Resolverlo a codigo durante la carga no es opcion: el archivo intercala
--  renglones de varias terminales y en 238 de 1 008 casos el modificador aparece
--  ANTES que el platillo al que acompana, asi que su clave todavia no existe
--  cuando hay que escribirla. Quien necesite el codigo lo alcanza por
--  `product.name`, que ya tiene su indice.
--
--  Los datos existentes se pierden porque estaban truncados y no se pueden
--  reconstruir: hay que volver a cargar el archivo de comandas. Como la carga es
--  incremental, primero hay que borrar su lote desde el modulo.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-12-parent-por-nombre-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS fixParentProduct;

DELIMITER $$

CREATE PROCEDURE fixParentProduct()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'parent_product_code'
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
            CHANGE COLUMN parent_product_code parent_product_name VARCHAR(60) NULL
                COMMENT 'platillo al que acompana el modificador, por nombre · NULL si el renglon se cobra solo';

        ALTER TABLE detail_sale ADD KEY idx_detail_sale_parent (parent_product_name);
    END IF;

    -- Por si la 11 nunca corrio en este servidor.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'parent_product_name'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN parent_product_name VARCHAR(60) NULL
                COMMENT 'platillo al que acompana el modificador, por nombre'
                AFTER product_code;

        ALTER TABLE detail_sale ADD KEY idx_detail_sale_parent (parent_product_name);
    END IF;
END$$

DELIMITER ;

CALL fixParentProduct();

DROP PROCEDURE IF EXISTS fixParentProduct;
