-- ============================================================================
--  Migracion 09 — el cargo de tarjeta puede cambiar de folio
--
--  Wansoft exporta un renglon de pago por cada voucher, asi que una cuenta que
--  se partio entre dos tarjetas deja DOS cargos con el mismo folio:
--
--      6275  TARJETA DE CREDITO    236.00
--      6275  TARJETA DE CREDITO  1,070.00
--
--  Hoy el modulo los suma y emite un solo ticket de 1,306.00 con el folio 6275.
--  Eso no sirve para facturar: cada voucher es de un cliente distinto y cada uno
--  pide su comprobante, pero el folio es uno solo y no se puede entregar dos
--  veces. La regla de la casa es que el folio conserva UN cargo —el primero que
--  se capturo— y los demas se mudan a un folio que ese dia se cobro sin tarjeta
--  (efectivo, transferencia, debito), que es el que no va a pedir factura.
--
--      6275 TC 1,070  ->  6279, que se habia cobrado en EFECTIVO
--
--  `assigned_folio` es esa mudanza. NULL —lo normal— significa que el cargo se
--  queda en su folio; con valor, el cargo cuenta para el folio de destino y deja
--  de contar para el suyo. El dato original NO se toca: `sale_folio` sigue
--  diciendo donde lo cobro el POS, que es lo que el Excel reporto y lo que la
--  conciliacion bancaria va a buscar.
--
--  Toda la aritmetica del modulo cuelga de un solo predicado en el modelo
--  (`folioDelPago`, un COALESCE de las dos columnas), asi que la mudanza se
--  refleja sola en el listado, en las cifras del dia, en el reparto 16%/0% y en
--  el papel, sin que ninguno de los cuatro tenga que enterarse.
--
--  `reassignment_run_id` dice en que cierre se movio, igual que
--  `virtual_ticket.generation_run_id` dice de que cierre salio cada papel: la
--  reasignacion es el primer paso de `generateDay` y tiene que poder auditarse
--  con el mismo hilo. Va con ON DELETE SET NULL —y no RESTRICT como la del
--  ticket— porque deshacer el dia borra la corrida y devuelve los cargos a su
--  folio en la misma pasada: la FK no debe ser lo que impida el rollback.
--
--  Solo aplica a Wansoft. Soft Restaurant no desglosa vouchers y su universo se
--  arma con otro criterio (ver ventaElegible), asi que ahi la columna se queda
--  en NULL para siempre.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-09-reasignacion-cargos-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- El cargo mudado ----------------------------------------------------------

DROP PROCEDURE IF EXISTS addPaymentAssignedFolio;

DELIMITER $$

CREATE PROCEDURE addPaymentAssignedFolio()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale_payment'
           AND COLUMN_NAME  = 'assigned_folio'
    ) THEN
        ALTER TABLE detail_sale_payment
            ADD COLUMN assigned_folio VARCHAR(10) NULL
                COMMENT 'folio al que se mudo el cargo · NULL = se queda en sale_folio'
                AFTER sale_folio;

        ALTER TABLE detail_sale_payment ADD KEY idx_payment_assigned (assigned_folio);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'detail_sale_payment'
           AND COLUMN_NAME  = 'reassignment_run_id'
    ) THEN
        ALTER TABLE detail_sale_payment
            ADD COLUMN reassignment_run_id INT(11) NULL
                COMMENT 'corrida que lo mudo · NULL en los que nunca se movieron'
                AFTER assigned_folio;

        ALTER TABLE detail_sale_payment ADD KEY idx_payment_reassign_run (reassignment_run_id);

        ALTER TABLE detail_sale_payment
            ADD CONSTRAINT fk_payment_reassign_run
                FOREIGN KEY (reassignment_run_id) REFERENCES generation_run (id)
                ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$

DELIMITER ;

CALL addPaymentAssignedFolio();

DROP PROCEDURE IF EXISTS addPaymentAssignedFolio;
