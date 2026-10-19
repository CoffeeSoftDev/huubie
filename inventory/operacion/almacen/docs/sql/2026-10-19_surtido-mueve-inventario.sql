-- =====================================================================
-- Interruptor «Surtir pedidos mueve inventario» por almacén
-- Fecha: 19/10/2026
-- BD:    fayxzvov_inventory
--
-- warehouse.supply_moves_stock: cuando este almacén surte un pedido de OTRA
-- sucursal, 1 = descuenta de aquí (SI-) y da entrada a quien pidió (ENT-, con
-- «Recibí»); 0 = solo marca el pedido como surtido, sin mover inventario.
-- Los pedidos dentro de la misma sucursal siguen descontando como siempre.
-- Se cambia en Catálogo › Almacenes.
--
-- Reginas arranca en 0 (pedido del usuario, 19/10/2026); las demás empresas, en 1.
-- El UPDATE de Reginas solo corre la primera vez (al crear la columna), para no
-- pisar lo que se cambie después en Catálogo.
--
-- Va DESPUÉS de 2026-10-19_surtido-entrada-recibi.sql y ANTES del código.
-- Se puede volver a correr. El -rollback lo deshace.
-- =====================================================================

SET @nueva := (
    SELECT COUNT(*) = 0
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'warehouse'
      AND COLUMN_NAME  = 'supply_moves_stock'
);

SET @ddl := IF(
    @nueva,
    'ALTER TABLE fayxzvov_inventory.warehouse ADD COLUMN supply_moves_stock TINYINT(1) NOT NULL DEFAULT 1 AFTER is_main',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE fayxzvov_inventory.warehouse w
INNER JOIN fayxzvov_erp.companies c ON c.id = w.companies_id
SET w.supply_moves_stock = 0
WHERE @nueva = 1 AND c.name LIKE 'Reginas%';

-- VERIFICACIÓN
SELECT c.name AS empresa, w.id, w.name AS almacen, w.is_main, w.supply_moves_stock
FROM fayxzvov_inventory.warehouse w
INNER JOIN fayxzvov_erp.companies c ON c.id = w.companies_id
ORDER BY c.id, w.id;
