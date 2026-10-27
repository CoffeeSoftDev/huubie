-- ============================================================================
--  Migracion 11 — el catalogo aprende de que POS es, y el grupo se muda
--
--  Dos correcciones sobre migra-10, las dos salidas de medir el archivo real.
--
--  ── 1. `group_type` y `group_name` se mudan a `product` ────────────────────
--  En migra-10 quedaron en `detail_sale`, y estaba mal. Al medir el archivo el
--  grupo resulto ESTABLE por producto: las 174 claves traen siempre el mismo
--  par, sin una sola excepcion en 8 719 filas.
--
--      ERI ROLL   ->  ALIMENTOS / SUSHI BAR ROLLS   siempre
--
--  Un dato que nunca cambia para el mismo producto describe al PRODUCTO, no al
--  renglon. Guardado en el renglon, la palabra «ALIMENTOS» se escribiria 8 719
--  veces en vez de 174, y reclasificar un platillo obligaria a corregir miles de
--  filas en lugar de una.
--
--  Se mueven vacias: la carga de comandas todavia no ha corrido, asi que no hay
--  dato que migrar.
--
--  ── 2. `product.pos_id` ────────────────────────────────────────────────────
--  Hoy nada dice de que sistema salio un producto. Los 379 que hubo eran de Soft
--  Restaurant y solo se sabia por el formato de la clave —«01036» contra
--  «SBR022»—, que es deducir, no saber.
--
--  La sucursal no alcanza como respuesta: `branch.pos_id` dice que POS opera HOY,
--  y una sucursal que migra de sistema conserva el catalogo viejo mientras el
--  nuevo entra. Esa convivencia es justo lo que hay que poder representar.
--
--  Entra en `uk_product_code` porque los dos POS pueden usar la misma clave para
--  cosas distintas: sin el, el segundo sistema chocaria contra el catalogo del
--  primero en la primera carga.
--
--  ── 3. `detail_sale.parent_product_code` ───────────────────────────────────
--  El modificador —«CON HUEVO», «AL VAPOR»— es un renglon de la comanda que
--  acompana a un platillo, y sin esta columna queda suelto: el papel no sabria
--  bajo que platillo imprimirlo.
--
--  Se guarda el CODIGO y no un id de renglon porque el archivo declara al padre
--  por nombre, no por posicion. Se probaron las dos: por posicion falla en 238 de
--  1 008 casos —el POS intercala renglones de otra terminal— y por nombre acierta
--  en los 1 008, con cero padres huerfanos.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-11-catalogo-multi-pos-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- El catalogo: de que POS es y a que grupo pertenece ------------------------

DROP PROCEDURE IF EXISTS addProductPosGroup;

DELIMITER $$

CREATE PROCEDURE addProductPosGroup()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND COLUMN_NAME  = 'group_type'
    ) THEN
        ALTER TABLE product
            ADD COLUMN group_type VARCHAR(30) NULL
                COMMENT 'ALIMENTOS / BEBIDAS / DESECHABLES · estable por producto'
                AFTER is_bridge;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND COLUMN_NAME  = 'group_name'
    ) THEN
        ALTER TABLE product
            ADD COLUMN group_name VARCHAR(60) NULL
                COMMENT 'grupo fino: SUSHI BAR ROLLS, RAMEN-YA SOPAS...'
                AFTER group_type;

        ALTER TABLE product ADD KEY idx_product_group (group_type, group_name);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND COLUMN_NAME  = 'pos_id'
    ) THEN
        ALTER TABLE product
            ADD COLUMN pos_id INT NULL
                COMMENT 'de que punto de venta salio este producto'
                AFTER branch_id;

        ALTER TABLE product
            ADD CONSTRAINT fk_product_pos
                FOREIGN KEY (pos_id) REFERENCES pos (id)
                ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- La clave del producto solo es unica DENTRO de su POS: dos sistemas pueden
    -- llamar «01036» a cosas distintas y los dos tienen razon.
    IF EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND INDEX_NAME   = 'uk_product_code'
           AND COLUMN_NAME  = 'branch_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'product'
           AND INDEX_NAME   = 'uk_product_code'
           AND COLUMN_NAME  = 'pos_id'
    ) THEN
        ALTER TABLE product DROP INDEX uk_product_code;
        ALTER TABLE product ADD UNIQUE KEY uk_product_code (code, branch_id, pos_id);
    END IF;
END$$

DELIMITER ;

CALL addProductPosGroup();

DROP PROCEDURE IF EXISTS addProductPosGroup;


-- -- El renglon: el grupo se va, el padre del modificador llega ----------------

DROP PROCEDURE IF EXISTS fixDetailSaleColumns;

DELIMITER $$

CREATE PROCEDURE fixDetailSaleColumns()
BEGIN
    -- La guarda mira las DOS columnas, no solo la suya.
    --
    -- migra-12 renombra esta columna a `parent_product_name`. Preguntando solo
    -- por `parent_product_code`, volver a correr la tanda entera la recrea —ya no
    -- esta, la 12 se la llevo— y entonces la 12 choca contra el nombre nuevo con
    -- «Duplicate column». La tabla acaba con las dos.
    --
    -- Una migracion tiene que reconocer tambien el estado que dejan las que
    -- vienen despues, o la secuencia completa deja de poder repetirse.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME IN ('parent_product_code', 'parent_product_name')
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN parent_product_code VARCHAR(10) NULL
                COMMENT 'platillo al que acompana el modificador · NULL si el renglon se cobra solo'
                AFTER product_code;

        ALTER TABLE detail_sale ADD KEY idx_detail_sale_parent (parent_product_code);
    END IF;

    -- Se van a `product`, donde debieron quedar. Sin dato que perder: la carga de
    -- comandas no ha corrido.
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
END$$

DELIMITER ;

CALL fixDetailSaleColumns();

DROP PROCEDURE IF EXISTS fixDetailSaleColumns;
