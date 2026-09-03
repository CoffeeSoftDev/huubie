-- ============================================================================
--  Migracion 16 — la corrida guarda con que combinacion armo los papeles (punto 20)
--
--  El punto 20 mete una vista previa antes de escribir el dia, y con ella un boton
--  que hasta hoy no existia: REGENERAR. Vuelve a armar los papeles con otra mezcla
--  de productos, para el caso en que la combinacion propuesta no convenza.
--
--  Eso choca de frente con una regla vieja del modulo. Los renglones del papel
--  inventado no salen al azar: `armarPapel` recibe `semillaFolio($folio)`, que es
--  el crc32 del folio, justamente para que «el ticket 174291 muestre hoy y en un
--  año las mismas personas y la misma orden». Un rand() daria un papel distinto en
--  cada impresion.
--
--  La salida es que la semilla deje de ser solo el folio y pase a ser
--  folio + offset de corrida:
--
--      offset 0   crc32(folio)            <- lo mismo que se venia armando
--      offset 3   crc32(folio . '#3')     <- otra mezcla, el mismo folio
--
--  El offset vive en la propuesta mientras nadie la guarda —cada Regenerar lo
--  incrementa— y se escribe aqui al confirmar. Con eso la corrida puede decir con
--  que combinacion se armo, y rehacer el dia con la misma semilla reproduce los
--  mismos papeles.
--
--  ── Por que DEFAULT 0 ──────────────────────────────────────────────────────
--  El 0 es «la combinacion de siempre»: `semillaFolio($folio, 0)` devuelve
--  exactamente el crc32 de antes. Las corridas ya guardadas quedan marcadas con la
--  semilla que de hecho usaron, sin tener que tocarlas.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-16-semilla-de-papel-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


DROP PROCEDURE IF EXISTS addGenerationRunSeed;

DELIMITER $$

CREATE PROCEDURE addGenerationRunSeed()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'paper_seed'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN paper_seed INT(11) NOT NULL DEFAULT 0
                COMMENT 'offset de la combinacion de productos · 0 = la de siempre (punto 20)'
                AFTER adjustment_tolerance;
    END IF;
END$$

DELIMITER ;

CALL addGenerationRunSeed();

DROP PROCEDURE IF EXISTS addGenerationRunSeed;
