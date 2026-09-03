-- ============================================================================
--  Rollback de la migracion 14 — el lema vuelve a ser obligatorio
--
--  Antes de poder devolver la columna a NOT NULL hay que darle un valor a las
--  empresas que se quedaron sin lema, porque el ALTER falla si encuentra un solo
--  NULL. Se les pone su RFC, y si tampoco lo tienen, «SIN LEMA» con su id: la
--  columna es UNIQUE y dos empresas con el mismo relleno no cabrian.
--
--  Es relleno, no dato: sale impreso en el ticket. Si se llega a correr esto,
--  revisar el emisor de cada empresa despues.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS restoreCompanyName;

DELIMITER $$

CREATE PROCEDURE restoreCompanyName()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'company'
           AND COLUMN_NAME  = 'business_name'
           AND IS_NULLABLE  = 'YES'
    ) THEN
        UPDATE company
           SET business_name = COALESCE(NULLIF(TRIM(rfc), ''), CONCAT('SIN LEMA ', id))
         WHERE business_name IS NULL OR TRIM(business_name) = '';

        ALTER TABLE company
            MODIFY COLUMN business_name VARCHAR(200) NOT NULL
                COMMENT 'razon social de la empresa';
    END IF;
END$$

DELIMITER ;

CALL restoreCompanyName();

DROP PROCEDURE IF EXISTS restoreCompanyName;
