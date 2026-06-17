-- Fix de drift de esquema: la tabla inflow_origin de algunas BBDD quedo sin la
-- columna `bg_hex` (modelo de badge de 2 colores), pero el codigo la consulta en:
--   - mdl-entradas.php  (qEntradas, qGetEntrada)  -> io.bg_hex AS origin_bg
--   - mdl-catalogo.php  (listInflow / create / update inflow_origin)
-- Sin la columna, esas queries fallaban con:
--   SQLSTATE[42S22]: Unknown column 'io.bg_hex' in 'field list'
-- y la lista de entradas quedaba vacia (qEntradas devolvia []).
--
-- El esquema canonico (2026-06-16_inventory_base_schema.sql) ya define bg_hex;
-- esta migracion solo realinea las BBDD que se crearon antes de ese cambio.
-- Idempotente para MySQL 5.7 (que no soporta ADD COLUMN IF NOT EXISTS): solo
-- agrega la columna si aun no existe.

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `inflow_origin` ADD COLUMN `bg_hex` varchar(20) DEFAULT NULL AFTER `color_hex`',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'inflow_origin'
      AND COLUMN_NAME  = 'bg_hex'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
