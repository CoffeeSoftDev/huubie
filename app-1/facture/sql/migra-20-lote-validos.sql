-- ============================================================================
--  Migracion 20 — los movimientos validos del lote (punto 31)
--
--  El punto 31 pide que cada archivo importado deje dicho cuantos movimientos
--  validos traia y cuanto sumaban. `import_batch` guardaba las filas, los
--  duplicados y un total de control, pero ese total es de TODO lo que entro
--  —efectivo incluido—: el lote 33 de julio dice $1,482,682.00 y lo que se reparte
--  es la tarjeta de credito, $955,219.40.
--
--  ── Que es "valido" ─────────────────────────────────────────────────────────
--  La misma regla que usa el modulo Tickets para el Total Tarjeta de Credito:
--  pago de una venta Pagada con TARJETA DE CREDITO, VISA, MASTERCARD o AMERICAN
--  EXPRESS (esTarjetaCredito en mdl-facture2-tickets.php).
--
--  ── NULL no es cero ─────────────────────────────────────────────────────────
--  Las dos columnas quedan en NULL en las hojas a las que no aplican —comandas,
--  terminal bancaria, pagos eliminados— y en los lotes de Soft Restaurant, que
--  escribe el modulo app/facture con el mismo esquema. Cero diria "no trajo
--  tarjeta"; NULL dice "esta hoja no se mide asi".
--
--  ── Los lotes ya cargados ──────────────────────────────────────────────────
--  Se llenan con los pagos que siguen colgados de cada lote: es exactamente lo
--  que ese archivo metio, porque la carga de detalle es incremental y nunca
--  reescribe un movimiento ya guardado.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-20-lote-validos-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;


-- -- Las dos columnas -----------------------------------------------------------

DROP PROCEDURE IF EXISTS addImportBatchValid;

DELIMITER $$

CREATE PROCEDURE addImportBatchValid()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND COLUMN_NAME  = 'valid_count'
    ) THEN
        ALTER TABLE import_batch
            ADD COLUMN valid_count INT(11) NULL DEFAULT NULL
                COMMENT 'pagos con tarjeta de credito de ventas Pagada que entraron (punto 31)'
                AFTER duplicated_rows;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'import_batch'
           AND COLUMN_NAME  = 'valid_total'
    ) THEN
        ALTER TABLE import_batch
            ADD COLUMN valid_total DECIMAL(12,2) NULL DEFAULT NULL
                COMMENT 'suma de esos pagos · el Total Tarjeta de Credito del archivo (punto 31)'
                AFTER valid_count;
    END IF;
END$$

DELIMITER ;

CALL addImportBatchValid();

DROP PROCEDURE IF EXISTS addImportBatchValid;


-- -- Los lotes de detalle ya cargados ------------------------------------------
--
-- Solo los que siguen sin dato: volver a lanzarlo no recalcula nada.

UPDATE import_batch b
   SET b.valid_count = (
           SELECT COUNT(*)
             FROM detail_sale_payment p
             JOIN payment_method pm         ON pm.id = p.payment_method_id
             JOIN sale s                    ON s.id  = p.sale_id
             JOIN sale_operation_status os  ON os.id = s.operation_status_id
            WHERE p.import_batch_id = b.id
              AND p.active = 1
              AND os.name  = 'Pagada'
              AND pm.name IN ('TARJETA DE CREDITO', 'VISA', 'MASTERCARD', 'AMERICAN EXPRESS')
       ),
       b.valid_total = (
           SELECT COALESCE(SUM(p.amount), 0)
             FROM detail_sale_payment p
             JOIN payment_method pm         ON pm.id = p.payment_method_id
             JOIN sale s                    ON s.id  = p.sale_id
             JOIN sale_operation_status os  ON os.id = s.operation_status_id
            WHERE p.import_batch_id = b.id
              AND p.active = 1
              AND os.name  = 'Pagada'
              AND pm.name IN ('TARJETA DE CREDITO', 'VISA', 'MASTERCARD', 'AMERICAN EXPRESS')
       )
 WHERE b.sheet_name  = 'Detalle por forma de pago'
   AND b.valid_count IS NULL;
