-- ============================================================================
--  Migracion 15 — el ticket guarda sus dos folios (punto 22.1)
--
--  El papel se imprime con el folio de su venta y hasta hoy no guardaba ninguno:
--  se lo pedia prestado a `sale` por `sale_id` cada vez que alguien lo abria. Con
--  eso el ticket no puede responder por si mismo dos preguntas que el punto 22.1
--  le hace:
--
--      Folio visible   el que salio impreso en el papel que se entrego
--      Folio original  el movimiento PDV del que salio el cargo que ampara
--
--  Los dos coinciden en el 99% de los papeles. Se separan cuando el punto 17 muda
--  un cargo: el folio 6275 cobro dos vouchers, conserva uno y el otro se va al
--  6279 —que se habia cobrado en efectivo—. El papel del 6279 se imprime con SU
--  folio, pero el dinero que ampara nacio en el 6275:
--
--      visible_folio = 6279     origin_folio = 6275
--
--  ── Por que no basta con la mudanza que ya existe ──────────────────────────
--  El par origen/destino vive en `detail_sale_payment` (sale_folio +
--  assigned_folio, ver migra-09) y ahi seguira: es el dato de la conciliacion
--  bancaria. Pero es un dato VIVO, y el cierre lo reescribe: `reasignarCargos`
--  devuelve todos los cargos a su folio antes de repartir otra vez, y deshacer el
--  dia hace lo mismo. Un papel impreso ayer se quedaba sin poder decir de donde
--  vino su cargo en cuanto el dia se rehiciera.
--
--  Estas dos columnas son la FOTO al momento de emitir, no un enlace. Mismo
--  espiritu que `detail_virtual_ticket.description`, que guarda el nombre del
--  producto en vez de leerlo del catalogo: lo que se entrego no cambia porque
--  cambie lo que hay detras.
--
--  ── Por que NULL y no NOT NULL ─────────────────────────────────────────────
--  Los papeles ya emitidos se rellenan aqui abajo, asi que en la practica van
--  siempre con valor. Se dejan NULL para que la migracion no reviente en una base
--  con papeles huerfanos (`sale_id` en NULL por el ON DELETE de la FK).
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-15-identidad-ticket-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- Los dos folios del papel ------------------------------------------------

DROP PROCEDURE IF EXISTS addVirtualTicketFolios;

DELIMITER $$

CREATE PROCEDURE addVirtualTicketFolios()
BEGIN
    DECLARE hayMudanza INT DEFAULT 0;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND COLUMN_NAME  = 'visible_folio'
    ) THEN
        ALTER TABLE virtual_ticket
            ADD COLUMN visible_folio VARCHAR(10) NULL
                COMMENT 'folio impreso · foto de sale.folio al emitir'
                AFTER note_number;

        ALTER TABLE virtual_ticket ADD KEY idx_vt_visible (visible_folio, branch_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'virtual_ticket'
           AND COLUMN_NAME  = 'origin_folio'
    ) THEN
        ALTER TABLE virtual_ticket
            ADD COLUMN origin_folio VARCHAR(10) NULL
                COMMENT 'movimiento PDV que origino el cargo · = visible_folio sin reasignacion'
                AFTER visible_folio;

        ALTER TABLE virtual_ticket ADD KEY idx_vt_origin (origin_folio);
    END IF;

    -- -- Los papeles que ya estaban emitidos ---------------------------------
    --
    -- El visible es el de su venta, siempre. El original se busca entre los
    -- cargos mudados: si algun pago se asigno a este folio, el papel nacio en el
    -- folio de ese pago. Si no, los dos son el mismo, que es lo que el punto 22.1
    -- pide cuando no hubo reasignacion.
    --
    -- MIN() y no GROUP_CONCAT: `receptorProximo` se lleva el folio libre de la
    -- lista al usarlo, asi que un receptor recibe UN cargo y el MIN es ese cargo.

    SELECT COUNT(*) INTO hayMudanza
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'detail_sale_payment'
       AND COLUMN_NAME  = 'assigned_folio';

    IF hayMudanza > 0 THEN
        UPDATE virtual_ticket v
          JOIN sale s ON s.id = v.sale_id
           SET v.visible_folio = s.folio,
               v.origin_folio  = COALESCE((
                    SELECT MIN(p.sale_folio)
                      FROM detail_sale_payment p
                     WHERE p.active = 1
                       AND p.assigned_folio = s.folio
               ), s.folio)
         WHERE v.visible_folio IS NULL;
    ELSE
        UPDATE virtual_ticket v
          JOIN sale s ON s.id = v.sale_id
           SET v.visible_folio = s.folio,
               v.origin_folio  = s.folio
         WHERE v.visible_folio IS NULL;
    END IF;
END$$

DELIMITER ;

CALL addVirtualTicketFolios();

DROP PROCEDURE IF EXISTS addVirtualTicketFolios;
