-- =====================================================================
-- Catálogo > Productos: cada presentación con su propia área y su foto
-- Fecha: 18/10/2026
-- BD:    fayxzvov_inventory
--
-- Decisión B: la presentación NO hereda área ni foto del producto base.
-- La reja de 12 puede guardarse en otra parte del almacén que la lata
-- suelta, y su foto es la del empaque.
--
-- item_presentation.warehouse_area_id   dónde se guarda (warehouse_area.id)
-- item_presentation.image               ruta relativa a inventory/
--                                       (uploads/presentaciones/{id}_xxxx.jpg)
--
-- Lo demás sigue siendo del base: categoría, mínimo y máximo, vida útil y
-- descripción.
--
-- CORRER DESPUÉS de 2026-10-18_presentaciones-producto.sql y ANTES de subir
-- el código: lsPresentaciones (ctrl-almacen) lee las dos columnas.
--
-- Se puede volver a correr (MySQL 5.7 no tiene ADD COLUMN IF NOT EXISTS:
-- cada columna se agrega solo si falta). El -rollback las quita.
-- =====================================================================

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.item_presentation ADD COLUMN warehouse_area_id INT(11) DEFAULT NULL AFTER unit_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'item_presentation'
      AND COLUMN_NAME  = 'warehouse_area_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.item_presentation ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER warehouse_area_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'item_presentation'
      AND COLUMN_NAME  = 'image'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- VERIFICACIÓN: deben salir las dos columnas.
SELECT COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
  AND TABLE_NAME   = 'item_presentation'
  AND COLUMN_NAME IN ('warehouse_area_id', 'image');
