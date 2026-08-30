-- ============================================================================
--  Migracion 10 — la comanda de Wansoft
--
--  `detail_sale` se escribio como replica literal de comandas.xls, el export de
--  comandas de Soft Restaurant. Wansoft reporta lo mismo —que se consumio, en
--  que mesa, quien lo capturo— pero trae seis datos que Soft no tiene, y una de
--  sus columnas no cabe en el ancho que se le dio a la equivalente.
--
--  Se extiende la tabla en lugar de crear una segunda: las dos hojas describen
--  el mismo hecho de negocio —el renglon de una cuenta— y partirlo en dos
--  tablas obligaria a unir por UNION en cada consulta del modulo para siempre.
--  Es el mismo criterio con el que migra-05 extendio `sale` en vez de crear
--  `sale_wansoft`.
--
--  ── description: de 60 a 150 ────────────────────────────────────────────────
--  En Soft, `description` era el nombre del platillo. En Wansoft la columna
--  homonima es texto libre del capturista y llega a 123 caracteres:
--
--      TONKOTSU GYUU RAMEN, 1 CON HUEVO
--      OCEAN ROLL TEMPURA,** PARA LLEVAR **,
--      PEDIDO DEL ING LUIS AUTORIZO EL CHEF
--
--  Con VARCHAR(60) se truncaria y se perderia justo la parte que explica por
--  que ese renglon salio de cortesia. El nombre del producto NO sale de aqui:
--  sale de `Platillo / Articulo`, o de `Modificador` cuando la fila es un
--  modificador (ver contrato-comandas-wansoft.md §2.1).
--
--  ── action: de que bloque de montos se lee el importe ───────────────────────
--  La hoja trae CUATRO bloques Subtotal/IVA/IEPS/Total y solo uno viene lleno
--  por fila. Cual, lo decide esta columna:
--
--      Venta                    8672 filas  ->  bloque «Detalles de venta»
--      Anulacion de platillo      34        ->  bloque «Anulaciones»
--      Cancelacion de platillo     9        ->  bloque «Cortesias y cancelaciones»
--      Cortesia de platillo        3        ->  ambos
--      Cortesia de orden           1        ->  ambos
--
--  Sin guardarla, un renglon anulado y uno vendido quedan indistinguibles y las
--  43 filas que el POS no cobro se sumarian como venta.
--
--  ── is_modifier: el renglon que no se cobra ────────────────────────────────
--  1008 de las 8719 filas son modificadores («CON HUEVO», «AL VAPOR»): describen
--  al platillo de arriba y su importe es CERO en las 1008, sin excepcion. Van a
--  la misma tabla porque el POS los emitio como renglon de la comanda y el papel
--  los imprime, pero cualquier suma tiene que poder excluirlos.
--
--  ── unit_price ─────────────────────────────────────────────────────────────
--  `amount` guarda el importe del renglon; el precio de lista se perdia. Se
--  toma de «Precio unitario con modificador», que en las 8719 filas medidas es
--  identica a «Precio unitario»: cuando difieran, la buena es la del modificador.
--
--  ── idx_detail_sale_pdv ────────────────────────────────────────────────────
--  El indice del re-enlace. La comanda se carga aunque su venta todavia no
--  exista —723 de 759 tickets del primer archivo llegaron asi— y se engancha
--  despues por (sale_folio, sale_id IS NULL). Sin este indice ese UPDATE
--  recorre la tabla entera cada vez que se cierra una carga de ventas.
--
--  ── sale: la cabecera «Tiempo de orden» ────────────────────────────────────
--  La segunda hoja del libro es una fila por orden, no una entidad nueva: sus
--  13 columnas son atributos del ticket. `Subtotal`, `IVA`, `Total` y `Mesero`
--  ya llegan por la hoja de pagos y NO se reescriben desde aqui —se contrastan—;
--  lo que solo existe en esta hoja es el tiempo de servicio.
--
--  Ninguna columna rompe la carga de Soft Restaurant: todas entran NULL o con
--  default, y `description` solo se ensancha.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-10-wansoft-comandas-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- El renglon de la comanda --------------------------------------------------

DROP PROCEDURE IF EXISTS addDetailSaleWansoft;

DELIMITER $$

CREATE PROCEDURE addDetailSaleWansoft()
BEGIN
    -- La nota del capturista, que en Wansoft no es el nombre del producto.
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA        = DATABASE()
           AND TABLE_NAME          = 'detail_sale'
           AND COLUMN_NAME         = 'description'
           AND CHARACTER_MAXIMUM_LENGTH < 150
    ) THEN
        ALTER TABLE detail_sale
            MODIFY COLUMN description VARCHAR(150) NULL
                COMMENT 'Soft: nombre del platillo · Wansoft: nota libre, hasta 123 car.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'action'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN action VARCHAR(30) NULL
                COMMENT 'Wansoft · Venta/Cortesia/Cancelacion/Anulacion · decide el bloque de montos'
                AFTER description;

        ALTER TABLE detail_sale ADD KEY idx_detail_sale_action (action);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'group_type'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN group_type VARCHAR(30) NULL
                COMMENT 'Wansoft · ALIMENTOS / BEBIDAS / DESECHABLES'
                AFTER action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'group_name'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN group_name VARCHAR(60) NULL
                COMMENT 'Wansoft · grupo del platillo · 23 valores'
                AFTER group_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'capture_terminal'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN capture_terminal VARCHAR(30) NULL
                COMMENT 'Wansoft · terminal que capturo el renglon'
                AFTER group_name;
    END IF;

    -- El renglon que acompana a otro y nunca suma.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'is_modifier'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN is_modifier TINYINT NOT NULL DEFAULT 0
                COMMENT 'Wansoft · 1 = describe al platillo de arriba, importe siempre 0'
                AFTER capture_terminal;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND COLUMN_NAME  = 'unit_price'
    ) THEN
        ALTER TABLE detail_sale
            ADD COLUMN unit_price DOUBLE NOT NULL DEFAULT 0
                COMMENT 'Wansoft · precio unitario con modificador'
                AFTER quantity;
    END IF;

    -- El indice del re-enlace de huerfanos.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale'
           AND INDEX_NAME   = 'idx_detail_sale_pdv'
    ) THEN
        ALTER TABLE detail_sale ADD KEY idx_detail_sale_pdv (sale_folio, sale_id);
    END IF;
END$$

DELIMITER ;

CALL addDetailSaleWansoft();

DROP PROCEDURE IF EXISTS addDetailSaleWansoft;


-- -- La cabecera de la orden --------------------------------------------------

DROP PROCEDURE IF EXISTS addSaleOrderTime;

DELIMITER $$

CREATE PROCEDURE addSaleOrderTime()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'opened_at'
    ) THEN
        ALTER TABLE sale
            ADD COLUMN opened_at DATETIME NULL
                COMMENT 'Wansoft · Hora inicio · apertura de la mesa'
                AFTER operation_date;
    END IF;

    -- Wansoft ya la calcula; recalcularla desde opened_at/operation_date daria
    -- otro numero porque el POS redondea a minutos enteros.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'service_minutes'
    ) THEN
        ALTER TABLE sale
            ADD COLUMN service_minutes INT NULL
                COMMENT 'Wansoft · Tiempo total en minutos, tal como lo reporta el POS'
                AFTER opened_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'order_type'
    ) THEN
        ALTER TABLE sale
            ADD COLUMN order_type VARCHAR(30) NULL
                COMMENT 'Wansoft · Restaurant / Para llevar'
                AFTER order_number;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'sale'
           AND COLUMN_NAME  = 'guest_count'
    ) THEN
        ALTER TABLE sale
            ADD COLUMN guest_count INT NULL
                COMMENT 'Wansoft · No. Personas en la mesa'
                AFTER order_type;
    END IF;
END$$

DELIMITER ;

CALL addSaleOrderTime();

DROP PROCEDURE IF EXISTS addSaleOrderTime;
