-- =====================================================================
-- Pedidos entre sucursales: lo surtido entra a quien pidió + «Recibí»
-- Fecha: 19/10/2026
-- BD:    fayxzvov_inventory
--
-- Al surtir un pedido de otra sucursal (Tuxtla le pide a Matriz), además de
-- la salida SI- en el almacén que surte, nace una entrada ENT- ya aplicada en
-- el almacén de la sucursal que pidió. Esa entrada usa el origen SURTIDO_SUC.
-- Después, la sucursal que pidió confirma con «Recibí» que le llegó.
--
-- inflow_origin  SURTIDO_SUC «Surtido de sucursal», uno por empresa. Va
--                inactivo: no sale en el selector de Entradas (solo lo usa el
--                surtido), pero las entradas que genera sí muestran su nombre.
-- purchase_order.received_confirmed_at       cuándo dijeron «Recibí».
-- purchase_order.received_confirmed_user_id  quién lo dijo.
--
-- CORRER ANTES de subir el código: surtir() en ctrl-ordenes pide el origen.
-- Se puede volver a correr. El -rollback lo deshace.
-- =====================================================================

INSERT INTO fayxzvov_inventory.inflow_origin
    (code, name, description, icon, color_hex, bg_hex, requires_supplier, sort_order, active, companies_id)
SELECT 'SURTIDO_SUC', 'Surtido de sucursal',
       'Lo que surtió otra sucursal en Pedidos: entra solo al surtirse',
       'truck', '#0E7490', '#CFFAFE', 0, 990, 0, e.companies_id
FROM (SELECT DISTINCT companies_id FROM fayxzvov_inventory.inflow_origin WHERE companies_id IS NOT NULL) e
WHERE NOT EXISTS (
    SELECT 1 FROM fayxzvov_inventory.inflow_origin o
    WHERE o.code = 'SURTIDO_SUC' AND o.companies_id = e.companies_id
);

SET @ddl := (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE fayxzvov_inventory.purchase_order ADD COLUMN received_confirmed_at DATETIME NULL AFTER approved_at, ADD COLUMN received_confirmed_user_id INT(11) NULL AFTER approved_user_id',
        'SELECT 1'
    )
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory'
      AND TABLE_NAME   = 'purchase_order'
      AND COLUMN_NAME  = 'received_confirmed_at'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- VERIFICACIÓN
SELECT companies_id, id, code, name, active FROM fayxzvov_inventory.inflow_origin WHERE code = 'SURTIDO_SUC';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_inventory' AND TABLE_NAME = 'purchase_order' AND COLUMN_NAME LIKE 'received_confirmed%';
