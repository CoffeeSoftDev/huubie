-- ============================================================================
--  Migracion 06 — la bitacora de carga completa su ficha de auditoria
--
--  `import_batch` nacio identificando el archivo y su sucursal, y con eso bastaba
--  mientras cada carga REEMPLAZABA el periodo: lo que quedaba en base era siempre
--  el ultimo archivo entero, asi que sus filas y las del Excel eran el mismo
--  numero y no habia duplicados que contar.
--
--  La carga incremental rompe esa equivalencia. Un archivo de 36 movimientos del
--  que ya se procesaron 18 deja un lote de 18: el resto no se perdio ni fallo, se
--  omitio por duplicidad. Sin registrarlo, la bitacora dice "18" y nadie puede
--  reconstruir que el archivo traia 36.
--
--  Las tres columnas nuevas responden a las tres preguntas que una auditoria hace
--  de una carga: que traia el archivo, que entro, y que se descarto por repetido.
--
--  `user_id` va SIN foreign key a proposito: el usuario vive en otro esquema y el
--  DDL de este modulo es autonomo por diseno (ver ddl-facturacion.sql, "CERO FK
--  cross-schema"). Se guarda ademas su nombre como copia congelada: una bitacora
--  de auditoria tiene que poder leerse dentro de diez anios aunque ese usuario ya
--  no exista o le hayan cambiado el nombre.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-06-bitacora-carga-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS addBatchColumnIfMissing;

DELIMITER $$

CREATE PROCEDURE addBatchColumnIfMissing(
    IN columnName VARCHAR(64),
    IN definition VARCHAR(500)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND COLUMN_NAME  = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `import_batch` ADD COLUMN `', columnName, '` ', definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- -- Que traia el archivo -----------------------------------------------------
--
-- Las filas de datos que el Excel tenia, antes de descartar nada. Es el numero
-- que el usuario ve al abrir su archivo y contra el que va a comparar.

CALL addBatchColumnIfMissing('source_rows',
    "INT NOT NULL DEFAULT 0 COMMENT 'filas de datos que traia el archivo' AFTER period_month");


-- -- Que se descarto por repetido ---------------------------------------------
--
-- Movimientos que ya estaban en base y no se volvieron a cargar. La resta
-- source_rows - row_count no lo explica sola: una fila tambien puede quedarse
-- fuera porque el motor la rechazo, y son dos cosas distintas.

CALL addBatchColumnIfMissing('duplicated_rows',
    "INT NOT NULL DEFAULT 0 COMMENT 'movimientos omitidos por estar ya procesados' AFTER row_count");


-- -- Quien la hizo ------------------------------------------------------------
--
-- El nombre va junto al id y no en su lugar: el id sirve para cruzar contra el
-- esquema de usuarios mientras ese usuario exista, y el nombre para que la
-- bitacora siga siendo legible cuando ya no.

CALL addBatchColumnIfMissing('user_name',
    "VARCHAR(150) NULL COMMENT 'nombre del usuario al momento de la carga' AFTER duplicated_rows");

CALL addBatchColumnIfMissing('user_id',
    "INT NULL COMMENT 'usuario que subio el archivo · sin FK, vive en otro esquema' AFTER updated_at");


-- -- Indice de auditoria -------------------------------------------------------
--
-- La pregunta frecuente de una auditoria es "que cargo esta persona", no "que
-- paso el martes": el usuario encabeza el indice y la fecha lo ordena dentro.

DROP PROCEDURE IF EXISTS addBatchIndexIfMissing;

DELIMITER $$

CREATE PROCEDURE addBatchIndexIfMissing()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND INDEX_NAME   = 'idx_import_user'
    ) THEN
        ALTER TABLE import_batch ADD KEY idx_import_user (user_id, created_at);
    END IF;
END$$

DELIMITER ;

CALL addBatchIndexIfMissing();

DROP PROCEDURE IF EXISTS addBatchIndexIfMissing;


-- -- Lo ya cargado -------------------------------------------------------------
--
-- Los lotes anteriores a esta migracion no tienen de donde sacar sus filas de
-- origen, y dejarlas en 0 haria ver como si el archivo hubiera venido vacio. Se
-- igualan a las que entraron, que es exactamente lo que ocurria entonces: sin
-- carga incremental, todas las filas del archivo se guardaban.

UPDATE import_batch SET source_rows = row_count WHERE source_rows = 0;


DROP PROCEDURE IF EXISTS addBatchColumnIfMissing;
