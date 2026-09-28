-- =====================================================================
-- ROLLBACK :: Entradas: tipos de entrada nuevos y destino (área)
-- Fecha: 27/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa los nombres de EDA y AJUSTE, desactiva AJUSTE, borra "Compra sin
-- proveedor" si ninguna entrada la usa y quita inventory_inflow.warehouse_area_id.
--
-- OJO: saveEntrada y updateEntrada (ctrl-entradas) escriben warehouse_area_id.
--   Si se regresa la BD hay que regresar también ese ctrl/mdl.
-- =====================================================================

UPDATE fayxzvov_inventory.inflow_origin SET name = 'nota' WHERE code = 'EDA';
UPDATE fayxzvov_inventory.inflow_origin SET name = 'Ajuste', active = 0 WHERE code = 'AJUSTE';

DELETE o FROM fayxzvov_inventory.inflow_origin o
 WHERE o.code = 'COMPRA_SP'
   AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.inventory_inflow i WHERE i.inflow_origin_id = o.id);

ALTER TABLE fayxzvov_inventory.inventory_inflow
    DROP FOREIGN KEY fk_inflow_area,
    DROP KEY idx_inflow_area,
    DROP COLUMN warehouse_area_id;
