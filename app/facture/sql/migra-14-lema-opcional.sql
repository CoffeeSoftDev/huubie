-- ============================================================================
--  Migracion 14 — el lema del ticket puede quedarse vacio
--
--  El formulario del emisor llama «Lema» al renglon que va bajo la razon social,
--  y ese renglon se guarda en `company.business_name`. Hasta hoy no se podia
--  dejar en blanco: el controlador se negaba a pisarlo con vacio, asi que quien
--  no quisiera lema tenia que escribir algo —un punto— para poder guardar.
--
--  Un campo que obliga a inventar un valor no protege el dato: lo ensucia. El
--  punto acababa impreso en el ticket del cliente igual que cualquier otro texto.
--
--  ── Por que NULL y no cadena vacia ─────────────────────────────────────────
--  La columna es UNIQUE. Con cadena vacia, la SEGUNDA empresa sin lema chocaria
--  contra la primera y no se podria guardar; MySQL, en cambio, admite tantos
--  NULL como haga falta en un indice unico. Ademas `Utileria::sql` ya traduce el
--  vacio del formulario a NULL, asi que el camino corto es tambien el correcto.
--
--  ── Lo que NO cambia ───────────────────────────────────────────────────────
--  El papel sigue sin poder quedarse sin encabezado. La proteccion se mueve al
--  controlador y se vuelve condicional: el lema puede vaciarse SOLO si la
--  sucursal tiene razon social propia. Si no la tiene, el membrete se quedaria
--  mudo y el vacio se rechaza, que es lo que la regla vieja intentaba evitar
--  —solo que lo hacia siempre, tuviera o no la sucursal su nombre—.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-14-lema-opcional-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS relaxCompanyName;

DELIMITER $$

CREATE PROCEDURE relaxCompanyName()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'company'
           AND COLUMN_NAME  = 'business_name'
           AND IS_NULLABLE  = 'NO'
    ) THEN
        ALTER TABLE company
            MODIFY COLUMN business_name VARCHAR(200) NULL
                COMMENT 'lema del ticket · NULL = sin lema, el papel encabeza con la sucursal';
    END IF;

    -- Los puntos y espacios que se capturaron solo para poder guardar no son un
    -- lema: se convierten en el vacio que se queria poner.
    UPDATE company
       SET business_name = NULL
     WHERE business_name IS NOT NULL
       AND TRIM(BOTH '.' FROM TRIM(business_name)) = '';
END$$

DELIMITER ;

CALL relaxCompanyName();

DROP PROCEDURE IF EXISTS relaxCompanyName;
