-- ============================================================================
--  Rollback de la migracion 21 — el dinero vuelve a DOUBLE
--
--  Regresa las 33 columnas de dinero al tipo aproximado que tenian. Los montos no
--  pierden nada al volver: un DECIMAL de dos decimales cabe entero en un DOUBLE.
--  Lo que se pierde es la garantia de que 0.10 sea exactamente 0.10.
--
--  Cada columna conserva su NULL, su valor por omision y su comentario.
--
--  Idempotente: solo regresa las columnas que siguen en DECIMAL.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS moneyToDouble;

DELIMITER $$

CREATE PROCEDURE moneyToDouble(IN tabla VARCHAR(64), IN columna VARCHAR(64), IN definicion VARCHAR(255))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = tabla
           AND COLUMN_NAME  = columna
           AND DATA_TYPE    = 'decimal'
    ) THEN
        SET @alter = CONCAT('ALTER TABLE `', tabla, '` MODIFY COLUMN `', columna, '` ', definicion);
        PREPARE stmt FROM @alter;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

CALL moneyToDouble('branch', 'adjustment_tolerance', "DOUBLE NOT NULL DEFAULT 10 COMMENT 'tolerancia maxima del ajuste de cuadre, $ · 0 = sin tope'");

CALL moneyToDouble('daily_sale_summary', 'subtotal',           "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('daily_sale_summary', 'tax',                "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('daily_sale_summary', 'total',              "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('daily_sale_summary', 'tip',                "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('daily_sale_summary', 'courtesy_total',     "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('daily_sale_summary', 'cancellation_total', "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('deleted_sale_payment', 'amount', "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('deleted_sale_payment', 'tip',    "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('detail_sale', 'unit_price', "DOUBLE NOT NULL DEFAULT 0 COMMENT 'Wansoft · precio unitario con modificador'");
CALL moneyToDouble('detail_sale', 'amount',     "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('detail_sale_payment', 'amount',        "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('detail_sale_payment', 'tip',           "DOUBLE NOT NULL DEFAULT 0 COMMENT 'Wansoft · Propina del pago'");
CALL moneyToDouble('detail_sale_payment', 'sale_subtotal', "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('detail_sale_payment', 'sale_tax',      "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('detail_sale_payment', 'sale_total',    "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('detail_sale_payment_card', 'amount', "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('detail_virtual_ticket', 'unit_price', "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('detail_virtual_ticket', 'amount',     "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('virtual_ticket', 'subtotal', "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('virtual_ticket', 'discount', "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('virtual_ticket', 'tax',      "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('virtual_ticket', 'total',    "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('generation_run', 'goal_amount',          "DOUBLE NOT NULL DEFAULT 0 COMMENT 'objetivo del 16% en pesos, ya resuelto'");
CALL moneyToDouble('generation_run', 'day_total',            "DOUBLE NOT NULL DEFAULT 0 COMMENT 'monto procesable del dia'");
CALL moneyToDouble('generation_run', 'billed_16',            "DOUBLE NOT NULL DEFAULT 0 COMMENT 'logrado al 16%, incluye lo ya facturado'");
CALL moneyToDouble('generation_run', 'billed_0',             "DOUBLE NOT NULL DEFAULT 0 COMMENT 'lo que cayo al 0%'");
CALL moneyToDouble('generation_run', 'adjustment_tolerance', "DOUBLE NOT NULL DEFAULT 0 COMMENT 'tope del ajuste vigente al generar'");

CALL moneyToDouble('import_batch', 'control_total', "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('product', 'price', "DOUBLE NOT NULL DEFAULT 0");

CALL moneyToDouble('sale', 'subtotal', "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('sale', 'tax',      "DOUBLE NOT NULL DEFAULT 0");
CALL moneyToDouble('sale', 'total',    "DOUBLE NOT NULL DEFAULT 0");

DROP PROCEDURE IF EXISTS moneyToDouble;
