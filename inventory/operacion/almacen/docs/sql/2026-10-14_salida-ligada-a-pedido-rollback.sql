-- =====================================================================
-- ROLLBACK :: Salidas: liga de la salida de surtido (SI-) con su pedido
-- Fecha: 14/10/2026
-- BD:    fayxzvov_inventory
--
-- OJO: surtir() (ctrl-ordenes), insertShrinkageFromOrden (mdl-ordenes),
--   mdl-borrado.php y los listados de CoffeeIA de Salidas usan esta columna.
--   Si se regresa la BD hay que regresar también esos ctrl/mdl.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_shrinkage
    DROP FOREIGN KEY fk_shrink_po,
    DROP KEY idx_shrink_po,
    DROP COLUMN purchase_order_id;
