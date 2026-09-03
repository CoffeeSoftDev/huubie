-- ============================================================================
--  Migracion 13 — el logo que encabeza el ticket
--
--  El papel empieza con el nombre del negocio escrito en letra grande, que es lo
--  unico que la termica podia imprimir mientras el membrete fuera texto. Los
--  tickets reales de Wansoft no encabezan asi: arriba llevan el logo del
--  restaurante, y el nombre solo aparece dentro de esa imagen.
--
--  De ahi que el logo sustituya a la razon social en vez de sumarse a ella: son
--  el mismo renglon del papel dicho de dos maneras, y con los dos impresos el
--  ticket sale con el nombre repetido.
--
--  Vive en `branch` y no en `company` porque el logo es del negocio que imprime,
--  no del contribuyente: hoy conviven en el mismo esquema un restaurante japones
--  y una cafeteria bajo la misma empresa (ver contrato-comandas-wansoft §7), y
--  cada sucursal entrega su propio papel.
--
--  Guarda la ruta publica del archivo, no la imagen: el binario vive en
--  /app/facture/src/img/logos, que es de donde lo sirve el navegador. Un logo
--  borrado a mano deja la columna apuntando a un archivo que no esta, y el papel
--  se encabeza con la razon social otra vez — que es el comportamiento de antes,
--  no un error.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-13-logo-emisor-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS addBranchColumnIfMissing;

DELIMITER $$

CREATE PROCEDURE addBranchColumnIfMissing(
    IN columnName VARCHAR(64),
    IN definition VARCHAR(500)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'branch'
           AND COLUMN_NAME  = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `branch` ADD COLUMN `', columnName, '` ', definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- -- La ruta del logo -----------------------------------------------------------
--
-- NULL es "sin logo" y es el estado con el que arrancan todas las sucursales: el
-- papel se sigue encabezando con la razon social hasta que alguien suba uno.
-- Va junto a `business_name` porque es su reemplazo en el papel, no un adjunto.

CALL addBranchColumnIfMissing('logo',
    "VARCHAR(255) NULL COMMENT 'ruta publica del logo que encabeza el ticket · NULL = se imprime la razon social' AFTER business_name");


DROP PROCEDURE IF EXISTS addBranchColumnIfMissing;
