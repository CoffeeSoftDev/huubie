-- ============================================================================
--  Migracion 21 — el dinero se guarda con dos decimales exactos (punto 33)
--
--  El punto 33 pide que los importes se manejen "con precision decimal adecuada
--  para dinero" y sin el punto flotante que mueve centavos. Todo el esquema
--  guardaba los pesos en DOUBLE: un numero aproximado, que no sabe escribir 0.10
--  exacto y por eso 0.1 + 0.2 da 0.30000000000000004.
--
--  DECIMAL(12,2) guarda el monto tal cual, con dos decimales: 99.30 es 99.30.
--  Hasta 9,999,999,999.99 por columna, de sobra para un mes de cualquier
--  sucursal (julio 2026: $1,482,682.00 en todas las formas de pago).
--
--  ── Que columnas ────────────────────────────────────────────────────────────
--  Solo las de DINERO. Se quedan en DOUBLE las que no son pesos:
--    quantity           cantidades con decimales (0.096061 de una comanda)
--    discount_percent   porcentajes
--    tax_rate           la tasa (0.16)
--    exchange_rate      tipo de cambio
--    tip_commission_rate comision en %
--    goal_value         lo que se capturo: 70 (%) o pesos, segun el modo
--
--  ── Los datos no cambian ────────────────────────────────────────────────────
--  Antes de escribir esta migracion se reviso la base local: ninguna columna de
--  dinero trae mas de dos decimales (ROUND(col, 2) = col en todas las filas), asi
--  que convertir no redondea un solo importe guardado.
--
--  ── Lo que cambia para el codigo ────────────────────────────────────────────
--  PDO ya entregaba los numeros como texto ("906"); ahora llegan con sus dos
--  decimales ("906.00"). Todo el modulo los convierte con (float) o los pinta con
--  money(), asi que no hay que tocar consultas.
--
--  ── Esquema compartido ──────────────────────────────────────────────────────
--  app/facture (Soft Restaurant) y app/wansoft (Wansoft) usan estas mismas
--  tablas: el cambio vale para los dos modulos.
--
--  Cada columna conserva su NULL, su valor por omision y su comentario.
--
--  Idempotente: solo convierte las columnas que siguen en DOUBLE.
--  Rollback en migra-21-dinero-decimal-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS moneyToDecimal;

DELIMITER $$

CREATE PROCEDURE moneyToDecimal(IN tabla VARCHAR(64), IN columna VARCHAR(64), IN definicion VARCHAR(255))
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = tabla
           AND COLUMN_NAME  = columna
           AND DATA_TYPE    = 'double'
    ) THEN
        SET @alter = CONCAT('ALTER TABLE `', tabla, '` MODIFY COLUMN `', columna, '` ', definicion);
        PREPARE stmt FROM @alter;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- -- Sucursal ---------------------------------------------------------------------
--
-- NOT NULL, como la creo migra-07: tolerancia() lee un NULL como 0, y 0 es "sin
-- tope". La base local la traia sin el NOT NULL; esta linea no la debe aflojar.

CALL moneyToDecimal('branch', 'adjustment_tolerance', "DECIMAL(12,2) NOT NULL DEFAULT 10.00 COMMENT 'tolerancia maxima del ajuste de cuadre, $ · 0 = sin tope'");

-- -- Resumen del dia -------------------------------------------------------------

CALL moneyToDecimal('daily_sale_summary', 'subtotal',           "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('daily_sale_summary', 'tax',                "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('daily_sale_summary', 'total',              "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('daily_sale_summary', 'tip',                "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('daily_sale_summary', 'courtesy_total',     "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('daily_sale_summary', 'cancellation_total', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

-- -- Pagos eliminados ------------------------------------------------------------

CALL moneyToDecimal('deleted_sale_payment', 'amount', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('deleted_sale_payment', 'tip',    "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

-- -- Comandas --------------------------------------------------------------------

CALL moneyToDecimal('detail_sale', 'unit_price', "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Wansoft · precio unitario con modificador'");
CALL moneyToDecimal('detail_sale', 'amount',     "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

-- -- Pagos -----------------------------------------------------------------------

CALL moneyToDecimal('detail_sale_payment', 'amount',        "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('detail_sale_payment', 'tip',           "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Wansoft · Propina del pago'");
CALL moneyToDecimal('detail_sale_payment', 'sale_subtotal', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('detail_sale_payment', 'sale_tax',      "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('detail_sale_payment', 'sale_total',    "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

CALL moneyToDecimal('detail_sale_payment_card', 'amount', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

-- -- Ticket virtual ---------------------------------------------------------------

CALL moneyToDecimal('detail_virtual_ticket', 'unit_price', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('detail_virtual_ticket', 'amount',     "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

CALL moneyToDecimal('virtual_ticket', 'subtotal', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('virtual_ticket', 'discount', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('virtual_ticket', 'tax',      "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('virtual_ticket', 'total',    "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

-- -- Corrida de generacion ------------------------------------------------------

CALL moneyToDecimal('generation_run', 'goal_amount',          "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'objetivo del 16% en pesos, ya resuelto'");
CALL moneyToDecimal('generation_run', 'day_total',            "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'monto procesable del dia'");
CALL moneyToDecimal('generation_run', 'billed_16',            "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'logrado al 16%, incluye lo ya facturado'");
CALL moneyToDecimal('generation_run', 'billed_0',             "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'lo que cayo al 0%'");
CALL moneyToDecimal('generation_run', 'adjustment_tolerance', "DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'tope del ajuste vigente al generar'");

-- -- Lote de carga ----------------------------------------------------------------

CALL moneyToDecimal('import_batch', 'control_total', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

-- -- Catalogo y ventas -----------------------------------------------------------

CALL moneyToDecimal('product', 'price', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

CALL moneyToDecimal('sale', 'subtotal', "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('sale', 'tax',      "DECIMAL(12,2) NOT NULL DEFAULT 0.00");
CALL moneyToDecimal('sale', 'total',    "DECIMAL(12,2) NOT NULL DEFAULT 0.00");

DROP PROCEDURE IF EXISTS moneyToDecimal;
