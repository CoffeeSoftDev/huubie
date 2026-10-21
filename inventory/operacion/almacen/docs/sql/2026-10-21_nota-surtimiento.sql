-- =====================================================================
-- Surtir: nota de por qué no se surtió
-- Fecha: 21/10/2026
-- BD:    fayxzvov_inventory
--
-- purchase_order_supply.note   lo que escribe quien surte en «Surtiendo la
--                              requisición» / «Terminar de surtir»: por qué
--                              no se entregó todo (no hay existencia, se
--                              manda mañana...). Una por surtimiento; sale en
--                              el Historial de surtimiento y en el detalle de
--                              la requisición. NULL = sin nota.
--
-- CORRER ANTES de subir el código: surtir() la escribe y getOrden la lee;
-- sin la columna, surtir una requisición falla.
--
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order_supply
    ADD COLUMN note VARCHAR(255) NULL DEFAULT NULL COMMENT 'Por qué no se surtió (lo escribe quien surte)' AFTER total_cost;

-- VERIFICACIÓN
SHOW COLUMNS FROM fayxzvov_inventory.purchase_order_supply LIKE 'note';
