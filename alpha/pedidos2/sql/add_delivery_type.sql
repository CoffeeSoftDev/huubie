-- Agregar columna delivery_type a la tabla pedidos_orders
-- Fecha: 2025-01-17
-- Descripción: Campo para clasificar pedidos como 'local' o 'domicilio'

ALTER TABLE pedidos_orders 
ADD COLUMN delivery_type ENUM('local', 'domicilio') 
NOT NULL DEFAULT 'local' 
COMMENT 'Tipo de entrega del pedido'
AFTER status;

-- Verificar que la columna se agregó correctamente
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    COLUMN_DEFAULT,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'pedidos_orders'
AND COLUMN_NAME = 'delivery_type';
