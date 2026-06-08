-- Migracion subsidiaries_id -> branch_id en fayxzvov_inventory
-- FK ahora apunta a fayxzvov_erp.branches. Datos remapeados a branch 1 (Coffee Central).
USE fayxzvov_inventory;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) inventory_inflow (NOT NULL, vacia)
ALTER TABLE inventory_inflow DROP FOREIGN KEY fk_inflow_subsidiary;
UPDATE inventory_inflow SET subsidiaries_id = 1;
ALTER TABLE inventory_inflow CHANGE subsidiaries_id branch_id INT NOT NULL;
ALTER TABLE inventory_inflow ADD CONSTRAINT fk_inflow_branch FOREIGN KEY (branch_id) REFERENCES fayxzvov_erp.branches(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 2) inventory_movement (NOT NULL)
ALTER TABLE inventory_movement DROP FOREIGN KEY fk_mov_subsidiary;
UPDATE inventory_movement SET subsidiaries_id = 1;
ALTER TABLE inventory_movement CHANGE subsidiaries_id branch_id INT NOT NULL;
ALTER TABLE inventory_movement ADD CONSTRAINT fk_mov_branch FOREIGN KEY (branch_id) REFERENCES fayxzvov_erp.branches(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 3) inventory_shrinkage (NOT NULL)
ALTER TABLE inventory_shrinkage DROP FOREIGN KEY fk_shrink_subsidiary;
UPDATE inventory_shrinkage SET subsidiaries_id = 1;
ALTER TABLE inventory_shrinkage CHANGE subsidiaries_id branch_id INT NOT NULL;
ALTER TABLE inventory_shrinkage ADD CONSTRAINT fk_shrink_branch FOREIGN KEY (branch_id) REFERENCES fayxzvov_erp.branches(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 4) item (NULLABLE)
ALTER TABLE item DROP FOREIGN KEY fk_item_subsidiary;
UPDATE item SET subsidiaries_id = 1;
ALTER TABLE item CHANGE subsidiaries_id branch_id INT NULL;
ALTER TABLE item ADD CONSTRAINT fk_item_branch FOREIGN KEY (branch_id) REFERENCES fayxzvov_erp.branches(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- 5) warehouse (NOT NULL)
ALTER TABLE warehouse DROP FOREIGN KEY fk_warehouse_subsidiary;
UPDATE warehouse SET subsidiaries_id = 1;
ALTER TABLE warehouse CHANGE subsidiaries_id branch_id INT NOT NULL;
ALTER TABLE warehouse ADD CONSTRAINT fk_warehouse_branch FOREIGN KEY (branch_id) REFERENCES fayxzvov_erp.branches(id) ON DELETE NO ACTION ON UPDATE NO ACTION;

SET FOREIGN_KEY_CHECKS = 1;
