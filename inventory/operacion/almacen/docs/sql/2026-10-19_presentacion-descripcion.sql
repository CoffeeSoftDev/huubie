-- =====================================================================
-- Catálogo > Productos: cada presentación con su propia descripción
-- Fecha: 19/10/2026
-- BD:    fayxzvov_inventory
--
-- Antes la descripción la heredaba del producto base. Ahora la reja de 12
-- trae la suya (notas del empaque y otros nombres con que se conoce).
--
-- item_presentation.description   texto libre, hasta 255 (NULL = sin descripción)
--
-- CORRER DESPUÉS de 2026-10-18_presentacion-area-foto.sql y ANTES de subir
-- el código: addPresentacion, editPresentacion y lsPresentaciones
-- (ctrl-almacen) usan la columna.
--
-- Se puede volver a correr (MySQL 5.7 no tiene ADD COLUMN IF NOT EXISTS:
-- la columna se agrega solo si falta). El -rollback la quita.
-- =====================================================================

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.item_presentation ADD COLUMN description VARCHAR(255) DEFAULT NULL AFTER name',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'item_presentation'
      AND COLUMN_NAME  = 'description'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- VERIFICACIÓN: debe salir la columna.
SELECT COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
  AND TABLE_NAME   = 'item_presentation'
  AND COLUMN_NAME  = 'description';
