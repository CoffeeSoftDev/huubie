-- ============================================================================
--  Migracion 17 — el registro maestro de la generacion (punto 29)
--
--  El punto 29 pide que cada ejecucion confirmada deje un registro maestro con
--  su propio identificador —GEN-000123— y once datos. La tabla `generation_run`
--  de la migracion 08 ya guarda siete de ellos; esta migracion agrega los otros
--  cuatro y el identificador.
--
--  ── El folio NO es el id ────────────────────────────────────────────────────
--  `id` es la llave con la que el ticket se cuelga de su corrida y no sale de la
--  base. `folio` es el numero que se lee, se dicta por telefono y se anota en una
--  aclaracion. Se separan a proposito: el id lo reparte MySQL y un borrado deja
--  huecos, mientras que el folio es un consecutivo del modulo y puede cambiar de
--  formato sin tocar una sola FK.
--
--  El consecutivo es GLOBAL, no por sucursal ni por año: «GEN-000123» tiene que
--  identificar una corrida sin preguntar de donde salio, que es justamente para
--  lo que sirve un registro maestro.
--
--  ── Los tickets de $0.00 se cuentan aparte ─────────────────────────────────
--  `count_0` son los papeles al 0% de IVA: llevan importe y renglones puente.
--  `zero_ticket_count` son los del punto 18 —el servicio de mesa y el movimiento
--  que vino en $0.00—, que se imprimen con un solo renglon sin producto. El punto
--  29 los pide como dos cifras porque son dos cosas: una es tasa y la otra es
--  importe.
--
--  ── Por que se congelan los conteos ────────────────────────────────────────
--  Los cuatro se podrian contar despues con un COUNT, pero es el mismo argumento
--  de la migracion 08: el dia se puede recargar, y entonces el Excel de origen,
--  el numero de movimientos y las mudanzas de folio dejan de ser los que la
--  corrida vio. La bitacora tiene que decir lo que paso, no lo que se ve hoy.
--
--  ── Las corridas ya guardadas SI reciben folio ──────────────────────────────
--  Aqui no se inventa nada —a diferencia de la migracion 08, que dejo en NULL los
--  tickets viejos—: el folio se reparte en orden de `id`, que es el orden real en
--  el que esas corridas ocurrieron. Sus cuatro conteos nuevos SI se quedan en
--  cero, porque esos datos nadie los registro.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-17-registro-de-generacion-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- Las columnas del registro ------------------------------------------------

DROP PROCEDURE IF EXISTS addGenerationRunRecord;

DELIMITER $$

CREATE PROCEDURE addGenerationRunRecord()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'folio'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN folio VARCHAR(20) NULL
                COMMENT 'registro maestro visible · GEN-000123 · consecutivo propio, no el id'
                AFTER id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'source_file'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN source_file VARCHAR(255) NULL
                COMMENT 'archivo del que salieron las ventas del dia · nombre congelado'
                AFTER cut_sale_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'movements_count'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN movements_count INT(11) NOT NULL DEFAULT 0
                COMMENT 'movimientos del dia que entraron a la corrida'
                AFTER no_paper;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'reassigned_count'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN reassigned_count INT(11) NOT NULL DEFAULT 0
                COMMENT 'cargos que cambiaron de folio en esta corrida (punto 17)'
                AFTER movements_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'zero_ticket_count'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN zero_ticket_count INT(11) NOT NULL DEFAULT 0
                COMMENT 'papeles de $0.00 · servicio de mesa y movimientos en cero (punto 18)'
                AFTER reassigned_count;
    END IF;
END$$

DELIMITER ;

CALL addGenerationRunRecord();

DROP PROCEDURE IF EXISTS addGenerationRunRecord;


-- -- El folio de las corridas anteriores ---------------------------------------
--
-- Se reparte en orden de id, que es el orden en que se corrieron. Solo alcanza a
-- las que estan sin folio, asi que volver a lanzarlo no renumera nada.

SET @consecutivo = 0;

UPDATE generation_run
   SET folio = CONCAT('GEN-', LPAD((@consecutivo := @consecutivo + 1), 6, '0'))
 WHERE folio IS NULL
 ORDER BY id ASC;


-- -- El folio no se repite -----------------------------------------------------
--
-- El indice va DESPUES de sellar las viejas: con filas duplicadas la creacion
-- fallaria. Es el unico candado del consecutivo —se calcula con un MAX+1 en el
-- controlador—, asi que dos cierres a la misma hora chocan aqui y no escriben dos
-- corridas con el mismo numero.

DROP PROCEDURE IF EXISTS addGenerationRunFolioKey;

DELIMITER $$

CREATE PROCEDURE addGenerationRunFolioKey()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND INDEX_NAME   = 'uq_run_folio'
    ) THEN
        ALTER TABLE generation_run ADD UNIQUE KEY uq_run_folio (folio);
    END IF;
END$$

DELIMITER ;

CALL addGenerationRunFolioKey();

DROP PROCEDURE IF EXISTS addGenerationRunFolioKey;
