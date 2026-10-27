-- ============================================================================
--  Migracion 08 — la corrida de generacion queda registrada
--
--  El punto 14 abre pidiendo que "cada proceso de generacion quede relacionado
--  con los movimientos de Excel que originaron el calculo". Hoy ese proceso no
--  existe en base: `generateDay` calcula el reparto, arma los papeles y se
--  olvida de como los armo. Lo unico que sobrevive es la tasa de cada ticket.
--
--  Eso deja el 70/30 sin auditar. La meta no es fija: `metaDelDia` la lee de la
--  barra en cada peticion y solo cae al 70% cuando no viene nada. Un dia que se
--  cerro al 70% se ve al 65% si alguien abre la pantalla con otro valor puesto,
--  y la linea de corte aparece en un renglon distinto al que de verdad se
--  aplico. No hay como demostrar cual fue.
--
--  `generation_run` congela la corrida: con que meta se pidio, que objetivo
--  salio de ella, cuanto quedo de cada lado, en que venta corto el dia, que
--  tolerancia de ajuste regia entonces, quien la corrio y cuando. El resultado
--  deja de depender de lo que la pantalla recalcule despues.
--
--  `virtual_ticket.generation_run_id` cierra la cadena hacia los movimientos:
--
--      corrida -> ticket virtual -> venta -> lote de importacion -> archivo
--
--  Los tickets anteriores a esta migracion se quedan sin corrida (NULL). No se
--  les inventa una: decir que salieron de un reparto cuyos numeros nadie
--  registro seria escribir en la bitacora algo que no consta.
--
--  `user_id` va SIN foreign key, igual que en `import_batch`: el usuario vive en
--  otro esquema y el DDL de este modulo es autonomo por diseno. El nombre se
--  guarda como copia congelada, para que la bitacora siga siendo legible cuando
--  ese usuario ya no exista.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-08-corrida-generacion-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- La corrida ---------------------------------------------------------------
--
-- `kind` separa los tres caminos por los que hoy nace un papel, porque solo uno
-- reparte el dia:
--
--   dia    el cierre completo, el unico que aplica la meta del 70/30.
--   cero   la pasada que completa los papeles del 0% que faltaban.
--   folio  un ticket suelto, regenerado a mano desde el panel.
--
-- Las columnas del reparto quedan en NULL o en cero para los dos ultimos: no
-- hubo objetivo que aplicar, y ponerles el 70% de algo seria inventarlo.

CREATE TABLE IF NOT EXISTS generation_run (
    id                   INT(11)      NOT NULL AUTO_INCREMENT,
    kind                 VARCHAR(10)  NOT NULL                COMMENT 'dia | cero | folio',
    issue_date           DATE         NOT NULL                COMMENT 'dia que se genero',
    goal_mode            VARCHAR(10)  NULL                    COMMENT 'pct | monto · lo que se eligio en la barra',
    goal_value           DOUBLE       NULL                    COMMENT 'el valor capturado: 70, o el monto en pesos',
    goal_amount          DOUBLE       NOT NULL DEFAULT 0      COMMENT 'objetivo del 16% en pesos, ya resuelto',
    day_total            DOUBLE       NOT NULL DEFAULT 0      COMMENT 'monto procesable del dia',
    billed_16            DOUBLE       NOT NULL DEFAULT 0      COMMENT 'logrado al 16%, incluye lo ya facturado',
    billed_0             DOUBLE       NOT NULL DEFAULT 0      COMMENT 'lo que cayo al 0%',
    count_16             INT(11)      NOT NULL DEFAULT 0,
    count_0              INT(11)      NOT NULL DEFAULT 0,
    no_paper             INT(11)      NOT NULL DEFAULT 0      COMMENT 'ventas que no pudieron recibir papel',
    adjustment_tolerance DOUBLE       NOT NULL DEFAULT 0      COMMENT 'tope del ajuste vigente al generar',
    user_name            VARCHAR(150) NULL                    COMMENT 'nombre del usuario al momento de la corrida',
    user_id              INT(11)      NULL                    COMMENT 'quien la corrio · sin FK, vive en otro esquema',
    cut_sale_id          INT(11)      NULL                    COMMENT 'venta donde el dia cambio de tasa',
    branch_id            INT(11)      NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active               TINYINT(4)   NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY idx_run_day (branch_id, issue_date),
    KEY idx_run_cut (cut_sale_id),
    CONSTRAINT fk_run_branch FOREIGN KEY (branch_id)   REFERENCES branch (id),
    CONSTRAINT fk_run_cut    FOREIGN KEY (cut_sale_id) REFERENCES sale (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- -- El papel sabe de que corrida salio -----------------------------------------

DROP PROCEDURE IF EXISTS addTicketRunColumn;

DELIMITER $$

CREATE PROCEDURE addTicketRunColumn()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND COLUMN_NAME  = 'generation_run_id'
    ) THEN
        ALTER TABLE virtual_ticket
            ADD COLUMN generation_run_id INT(11) NULL
                COMMENT 'corrida que lo genero · NULL en los anteriores a la migracion 08'
                AFTER sale_id;

        ALTER TABLE virtual_ticket ADD KEY idx_vt_run (generation_run_id);

        ALTER TABLE virtual_ticket
            ADD CONSTRAINT fk_vt_run FOREIGN KEY (generation_run_id) REFERENCES generation_run (id);
    END IF;
END$$

DELIMITER ;

CALL addTicketRunColumn();

DROP PROCEDURE IF EXISTS addTicketRunColumn;
