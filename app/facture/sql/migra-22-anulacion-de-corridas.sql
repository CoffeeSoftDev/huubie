-- ============================================================================
--  Migracion 22 — la corrida de generacion se anula, no se borra (punto 29)
--
--  El punto 29 pide que cada ejecucion confirmada deje un registro maestro, y ese
--  registro tiene que responder por lo que paso con el dia. Hasta hoy dos caminos
--  lo desmentian:
--
--    Rehacer el dia   escribia una corrida nueva y dejaba la vieja con active = 1.
--                     El Historial sumaba el dia dos veces y nada decia cual de
--                     las dos era la vigente.
--    Solo eliminar    borraba la corrida con un DELETE. El registro maestro de un
--                     dia que SI se genero desaparecia sin rastro de quien lo
--                     quito ni por que, y su folio GEN quedaba libre para repetirse.
--
--  Ahora la corrida que deja de valer se ANULA: active = 0 mas cinco datos que
--  dicen quien, cuando, por que y quien la sustituyo.
--
--  ── Las cinco columnas ──────────────────────────────────────────────────────
--  cancelled_at         cuando se anulo. NULL = la corrida sigue vigente.
--  cancelled_user_id    quien tecleo su PIN. Sin FK, igual que `user_id`: la
--                       corrida tiene que seguir siendo legible aunque ese usuario
--                       se de de baja.
--  cancelled_user_name  su nombre, copiado en el momento. Es el que se lee.
--  cancel_reason        rehacer | eliminar. Son los dos botones del dia.
--  replaced_by_run_id   la corrida que ocupo su lugar. NULL cuando el dia se
--                       elimino y nadie la sustituyo.
--
--  ── active sigue siendo el interruptor ─────────────────────────────────────
--  Todos los lectores que hoy preguntan `active = 1` —las generaciones del dia,
--  la hora de generacion de Reimpresion, el resumen del periodo— quedan como
--  estan: una corrida anulada ya no cuenta para ellos. Solo el listado y la
--  ficha del Historial la muestran, a proposito, para poder demostrar que existio.
--
--  ── La FK de replaced_by_run_id ─────────────────────────────────────────────
--  Apunta a la propia tabla con ON DELETE SET NULL. "Eliminar todo" de un mes
--  borra TODAS sus corridas en una sola sentencia (deleteGenerationRunByMonth) y
--  una FK RESTRICT dependeria del orden en que el motor las recorre: con SET NULL
--  la sustituta se puede ir antes o despues que la anulada sin que falle el borrado.
--
--  ── Compartida con app/facture ──────────────────────────────────────────────
--  La tabla es la misma que usa el Facturador de Soft Restaurant. Las columnas
--  nacen NULL y ninguna consulta de ese modulo las nombra, asi que no lo afectan.
--
--  ── Las corridas que ya estan guardadas ─────────────────────────────────────
--  No se tocan. Un dia rehecho ANTES de esta migracion pudo dejar dos corridas con
--  active = 1; decir cual se anulo, quien y cuando seria inventarlo, porque ese
--  dato nadie lo registro. Si la base de produccion las trae, se resuelven aparte
--  y a ojo.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-22-anulacion-de-corridas-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

SET NAMES utf8mb4;


-- -- Las cinco columnas ---------------------------------------------------------

DROP PROCEDURE IF EXISTS addGenerationRunCancel;

DELIMITER $$

CREATE PROCEDURE addGenerationRunCancel()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancelled_at'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN cancelled_at DATETIME NULL DEFAULT NULL
                COMMENT 'cuando se anulo · NULL = sigue vigente'
                AFTER active;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancelled_user_id'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN cancelled_user_id INT(11) NULL DEFAULT NULL
                COMMENT 'quien la anulo · sin FK, como user_id'
                AFTER cancelled_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancelled_user_name'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN cancelled_user_name VARCHAR(150) NULL DEFAULT NULL
                COMMENT 'nombre del usuario al momento de anular · copia'
                AFTER cancelled_user_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'cancel_reason'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN cancel_reason VARCHAR(10) NULL DEFAULT NULL
                COMMENT 'rehacer | eliminar · los dos botones del dia'
                AFTER cancelled_user_name;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND COLUMN_NAME  = 'replaced_by_run_id'
    ) THEN
        ALTER TABLE generation_run
            ADD COLUMN replaced_by_run_id INT(11) NULL DEFAULT NULL
                COMMENT 'corrida que ocupo su lugar · NULL si el dia se elimino'
                AFTER cancel_reason;
    END IF;
END$$

DELIMITER ;

CALL addGenerationRunCancel();

DROP PROCEDURE IF EXISTS addGenerationRunCancel;


-- -- La sustituta existe ---------------------------------------------------------
--
-- El indice y la FK van DESPUES de las columnas, cada uno con su propia guarda:
-- una corrida a medio migrar (columna sin FK) se completa al volver a correr.

DROP PROCEDURE IF EXISTS addGenerationRunReplacedKey;

DELIMITER $$

CREATE PROCEDURE addGenerationRunReplacedKey()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'generation_run'
           AND INDEX_NAME   = 'idx_run_replaced'
    ) THEN
        ALTER TABLE generation_run ADD KEY idx_run_replaced (replaced_by_run_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA    = DATABASE()
           AND TABLE_NAME      = 'generation_run'
           AND CONSTRAINT_NAME = 'fk_run_replaced'
           AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ) THEN
        ALTER TABLE generation_run
            ADD CONSTRAINT fk_run_replaced FOREIGN KEY (replaced_by_run_id)
                REFERENCES generation_run (id) ON DELETE SET NULL;
    END IF;
END$$

DELIMITER ;

CALL addGenerationRunReplacedKey();

DROP PROCEDURE IF EXISTS addGenerationRunReplacedKey;
