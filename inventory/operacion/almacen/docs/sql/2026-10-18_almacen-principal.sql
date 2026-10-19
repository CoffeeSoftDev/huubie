-- =====================================================================
-- Almacenes: el almacén principal de la empresa
-- Fecha: 18/10/2026
-- BD:    fayxzvov_inventory
--
-- Cada sucursal tiene su(s) almacén(es) (warehouse.branch_id). El almacén
-- principal es al que las demás sucursales le piden material en Pedidos:
-- el pedido nuevo va por defecto a la sucursal de ese almacén.
--
-- warehouse.is_main   1 = almacén principal de la empresa (uno por empresa;
--                     ctrl-catalogo apaga los demás al marcar uno).
--
-- A cada empresa que aún no tiene uno se le marca su almacén por defecto
-- (is_default) activo de id más bajo; se cambia en Catálogo › Almacenes.
--
-- CORRER ANTES de subir el código: Catálogo › Almacenes y Pedidos leen la
-- columna. Se puede volver a correr. El -rollback la quita.
-- =====================================================================

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.warehouse ADD COLUMN is_main TINYINT(1) NOT NULL DEFAULT 0 AFTER is_default',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'warehouse'
      AND COLUMN_NAME  = 'is_main'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Uno por empresa, solo donde no hay ninguno marcado.
UPDATE fayxzvov_inventory.warehouse w
INNER JOIN (
    SELECT companies_id,
           CAST(SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY is_default DESC, id ASC), ',', 1) AS UNSIGNED) AS id
    FROM fayxzvov_inventory.warehouse
    WHERE active = 1
    GROUP BY companies_id
) elegido ON elegido.id = w.id
LEFT JOIN (
    SELECT companies_id
    FROM fayxzvov_inventory.warehouse
    WHERE is_main = 1
    GROUP BY companies_id
) ya ON ya.companies_id = w.companies_id
SET w.is_main = 1
WHERE ya.companies_id IS NULL;

-- VERIFICACIÓN: un almacén principal por empresa.
SELECT companies_id, id, name, branch_id
FROM fayxzvov_inventory.warehouse
WHERE is_main = 1
ORDER BY companies_id;
