-- ============================================================================
--  Migracion 07 — la tolerancia del ajuste de cuadre
--
--  El ticket virtual casi siempre suma EXACTO el total de la venta: el armado
--  busca una combinacion de productos que cierre el monto al peso. Cuando no la
--  hay —un total con centavos, un catalogo cuyos precios no cierran ese monto—
--  se arma pasandose a proposito y el excedente se guarda como descuento de
--  cuadre en `virtual_ticket.discount`.
--
--  Ese ajuste existia sin techo. Su tamano lo decidia el catalogo sin que nadie
--  lo hubiera elegido: como la pieza que remata el papel sale del producto mas
--  barato, el ajuste nunca supera su precio. Con el catalogo de tasa 0% de hoy
--  eso son hasta $34.99, y $18.81 en promedio: un descuento grande que se
--  imprimia sin que la casa hubiera dicho hasta donde le parece bien.
--
--  La tolerancia es ese "hasta donde". No bloquea la generacion: el papel se
--  arma igual y se marca, para que la diferencia no pase inadvertida. Un tope
--  que impidiera facturar dejaria ventas sin ticket por un defecto del catalogo,
--  que es un problema de datos y no de la venta.
--
--  Vive en `branch` y no en una constante porque es politica de la casa, como
--  `tip_commission_rate`, y se captura en la pantalla de Emisor.
--
--  El default de 10 es un tope realista contra los catalogos actuales: el de IVA
--  no lo alcanza nunca (su producto mas barato cuesta $5) y en el de tasa 0% si
--  marca, que es justo la senal de que a ese catalogo le faltan productos
--  baratos con los que cerrar montos chicos.
--
--  El 0 se lee como SIN TOPE: deja la columna capturada y la regla apagada.
--
--  Idempotente: se puede correr las veces que sea.
--  Rollback en migra-07-tolerancia-ajuste-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS addBranchColumnIfMissing;

DELIMITER $$

CREATE PROCEDURE addBranchColumnIfMissing(
    IN columnName VARCHAR(64),
    IN definition VARCHAR(500)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'branch'
           AND COLUMN_NAME  = columnName
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `branch` ADD COLUMN `', columnName, '` ', definition);
        PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;


-- -- Hasta donde puede llegar el ajuste ----------------------------------------
--
-- En pesos y no en porcentaje: el ajuste no crece con el monto del ticket, lo
-- acota el precio del producto mas barato del catalogo. Un 1% seria $2 en un
-- ticket de $200 y $50 en uno de $5,000, cuando el ajuste de los dos cabe en el
-- mismo puno de pesos.

CALL addBranchColumnIfMissing('adjustment_tolerance',
    "DOUBLE NOT NULL DEFAULT 10 COMMENT 'tolerancia maxima del ajuste de cuadre, $ · 0 = sin tope' AFTER tip_commission_rate");


-- -- Las sucursales que ya existen ---------------------------------------------
--
-- El DEFAULT solo aplica a las filas nuevas: MySQL rellena las que ya estaban con
-- el default de la columna, pero se deja explicito para que quede dicho que las
-- sucursales de antes de esta migracion arrancan con el mismo tope y no apagadas.

UPDATE branch SET adjustment_tolerance = 10 WHERE adjustment_tolerance IS NULL;


DROP PROCEDURE IF EXISTS addBranchColumnIfMissing;
