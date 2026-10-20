-- 20/10/2026 · Deshace 2026-10-20_reiniciar-movimientos-reginas.sql: regresa salidas, ajustes,
-- compras/pedidos, el stock anterior, la liga entrada→pedido y la bitácora de folios desde
-- los respaldos *_bk_20261020.
-- Solo sirve ANTES de capturar movimientos nuevos: con folios nuevos de Reginas chocan las llaves.

USE fayxzvov_inventory;

SET @cia = 1;

START TRANSACTION;

-- Los registros vuelven con su id original; el orden padre→hijo no basta para la FK de
-- purchase_order consigo misma, por eso se apagan las revisiones solo en esta sesión.
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO fayxzvov_inventory.purchase_order               SELECT * FROM fayxzvov_inventory.purchase_order_bk_20261020;
INSERT INTO fayxzvov_inventory.detail_purchase_order        SELECT * FROM fayxzvov_inventory.detail_purchase_order_bk_20261020;
INSERT INTO fayxzvov_inventory.inventory_shrinkage          SELECT * FROM fayxzvov_inventory.inventory_shrinkage_bk_20261020;
INSERT INTO fayxzvov_inventory.detail_inventory_shrinkage   SELECT * FROM fayxzvov_inventory.detail_inventory_shrinkage_bk_20261020;
INSERT INTO fayxzvov_inventory.inventory_adjustment         SELECT * FROM fayxzvov_inventory.inventory_adjustment_bk_20261020;
INSERT INTO fayxzvov_inventory.detail_inventory_adjustment  SELECT * FROM fayxzvov_inventory.detail_inventory_adjustment_bk_20261020;
INSERT INTO fayxzvov_inventory.inventory_adjustment_history SELECT * FROM fayxzvov_inventory.inventory_adjustment_history_bk_20261020;
INSERT INTO fayxzvov_inventory.folio_renumeracion           SELECT * FROM fayxzvov_inventory.folio_renumeracion_bk_20261020;

-- Liga entrada → pedido
UPDATE fayxzvov_inventory.inventory_inflow h
INNER JOIN fayxzvov_inventory.inventory_inflow_bk_20261020 b ON b.id = h.id
SET h.purchase_order_id = b.purchase_order_id;

-- Stock: se cambia el recalculado por el de antes.
DELETE FROM fayxzvov_inventory.stock WHERE companies_id = @cia;
INSERT INTO fayxzvov_inventory.stock SELECT * FROM fayxzvov_inventory.stock_bk_20261020;

SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

-- -- Limpieza de respaldos --
-- Correr solo después de revisar que todo volvió.
-- DROP TABLE fayxzvov_inventory.inventory_inflow_bk_20261020,
--            fayxzvov_inventory.inventory_shrinkage_bk_20261020, fayxzvov_inventory.detail_inventory_shrinkage_bk_20261020,
--            fayxzvov_inventory.inventory_adjustment_bk_20261020, fayxzvov_inventory.detail_inventory_adjustment_bk_20261020,
--            fayxzvov_inventory.inventory_adjustment_history_bk_20261020, fayxzvov_inventory.purchase_order_bk_20261020,
--            fayxzvov_inventory.detail_purchase_order_bk_20261020, fayxzvov_inventory.stock_bk_20261020,
--            fayxzvov_inventory.folio_renumeracion_bk_20261020;
