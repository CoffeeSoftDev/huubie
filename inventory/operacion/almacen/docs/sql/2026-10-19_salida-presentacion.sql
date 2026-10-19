-- =====================================================================
-- Salidas: el renglón recuerda si salió como presentación
-- Fecha: 19/10/2026
-- BD:    fayxzvov_inventory
--
-- Al guardar, una presentación se vuelve renglón de su producto base
-- (Caja 24 × 2 = 48 piezas): el stock y el kárdex van en el base. Estas
-- dos columnas guardan lo que se capturó para enseñarlo en el detalle de
-- la salida («2 × Caja 24»).
--
-- detail_inventory_shrinkage.item_presentation_id    item_presentation.id
-- detail_inventory_shrinkage.presentation_quantity   empaques que salieron
--
-- NULL en las dos = salió como producto suelto (todas las de antes).
--
-- CORRER ANTES de subir el código: getSalidaDetail e insertSalidaDetail
-- (mdl-salidas) usan las dos columnas.
--
-- Se puede volver a correr (MySQL 5.7 no tiene ADD COLUMN IF NOT EXISTS:
-- cada columna se agrega solo si falta). El -rollback las quita.
-- =====================================================================

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.detail_inventory_shrinkage ADD COLUMN item_presentation_id INT(11) DEFAULT NULL AFTER item_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'detail_inventory_shrinkage'
      AND COLUMN_NAME  = 'item_presentation_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.detail_inventory_shrinkage ADD COLUMN presentation_quantity DOUBLE DEFAULT NULL AFTER item_presentation_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'detail_inventory_shrinkage'
      AND COLUMN_NAME  = 'presentation_quantity'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- VERIFICACIÓN: deben salir las dos columnas.
SELECT COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
  AND TABLE_NAME   = 'detail_inventory_shrinkage'
  AND COLUMN_NAME IN ('item_presentation_id', 'presentation_quantity');
