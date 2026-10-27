-- ============================================================================
--  Migracion 24 — el sello de los tickets impresos (Modulo de tickets, punto 1)
--
--  Un ticket que ya salio por la impresora es un documento entregado. Desde ese
--  momento el dia no se puede cancelar ni rehacer: ni "Rehacer reparto", ni "Solo
--  eliminar", ni regenerar un folio, ni el reset de un mes que lo contenga.
--
--  El sello es del DIA, no de la corrida: un dia puede tener varias corridas
--  vigentes (cierre, pasada de ceros, folios sueltos) y lo que se imprime es la
--  hoja del dia entera. Una fila por (sucursal, dia); el indice unico hace que
--  imprimir otra vez no selle dos veces.
--
--  ── Columnas ────────────────────────────────────────────────────────────────
--  issue_date    dia sellado (el del ticket, no el de la impresion).
--  sealed_at     cuando se imprimio por primera vez.
--  user_id       quien tecleo su PIN. Sin FK, igual que generation_run.user_id.
--  user_name     copia del nombre al momento de sellar.
--  ticket_count  cuantos papeles tenia el dia al sellarse.
--  branch_id     sucursal. FK a branch.
--
--  Reimprimir NO pasa por aqui: la Reimpresion solo lee. Un dia sellado se puede
--  imprimir cuantas veces haga falta.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-24-sello-de-tickets-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS ticket_seal (
    id            INT(11)      NOT NULL AUTO_INCREMENT,
    issue_date    DATE         NOT NULL COMMENT 'dia sellado',
    sealed_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'primera impresion del dia',
    user_id       INT(11)      NULL     COMMENT 'quien tecleo su PIN · sin FK',
    user_name     VARCHAR(150) NULL     COMMENT 'copia del nombre',
    ticket_count  INT(11)      NOT NULL DEFAULT 0 COMMENT 'papeles del dia al sellarse',
    branch_id     INT(11)      NULL,
    active        TINYINT(4)   NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_seal_day (branch_id, issue_date),
    CONSTRAINT fk_seal_branch FOREIGN KEY (branch_id) REFERENCES branch (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
