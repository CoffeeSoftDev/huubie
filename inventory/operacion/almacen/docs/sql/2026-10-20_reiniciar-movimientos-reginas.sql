-- 20/10/2026 · Reinicia el inventario de Reginas (companies_id = 1) CONSERVANDO las entradas:
-- borra salidas, ajustes (conteos), compras/pedidos (purchase_order) y rehace el stock
-- solo con lo que sumaron las entradas aplicadas.
-- NO toca el catálogo: productos, último costo (item_attribute.cost_unit), categorías,
-- áreas, almacenes, proveedores ni unidades.
-- Los folios S-, AJ- y de pedidos vuelven a 0001 solos: nextFolio() toma el MAX que exista.
-- IDs de la BD LOCAL: en prod confirmar que Reginas es companies_id = 1 antes de correrlo.
-- Deshacer: 2026-10-20_reiniciar-movimientos-reginas-rollback.sql (lee los respaldos *_bk_20261020).

-- MySQL 5.7 pide base seleccionada para DELETE con alias (error 1046 sin ella).
USE fayxzvov_inventory;

SET @cia = 1;

-- -- Respaldo --
-- Fuera de la transacción: CREATE TABLE hace commit implícito. LIKE no copia las FK.
CREATE TABLE fayxzvov_inventory.inventory_inflow_bk_20261020             LIKE fayxzvov_inventory.inventory_inflow;
CREATE TABLE fayxzvov_inventory.inventory_shrinkage_bk_20261020          LIKE fayxzvov_inventory.inventory_shrinkage;
CREATE TABLE fayxzvov_inventory.detail_inventory_shrinkage_bk_20261020   LIKE fayxzvov_inventory.detail_inventory_shrinkage;
CREATE TABLE fayxzvov_inventory.inventory_adjustment_bk_20261020         LIKE fayxzvov_inventory.inventory_adjustment;
CREATE TABLE fayxzvov_inventory.detail_inventory_adjustment_bk_20261020  LIKE fayxzvov_inventory.detail_inventory_adjustment;
CREATE TABLE fayxzvov_inventory.inventory_adjustment_history_bk_20261020 LIKE fayxzvov_inventory.inventory_adjustment_history;
CREATE TABLE fayxzvov_inventory.purchase_order_bk_20261020               LIKE fayxzvov_inventory.purchase_order;
CREATE TABLE fayxzvov_inventory.detail_purchase_order_bk_20261020        LIKE fayxzvov_inventory.detail_purchase_order;
CREATE TABLE fayxzvov_inventory.stock_bk_20261020                        LIKE fayxzvov_inventory.stock;
CREATE TABLE fayxzvov_inventory.folio_renumeracion_bk_20261020           LIKE fayxzvov_inventory.folio_renumeracion;

-- Solo las entradas ligadas a un pedido: se les suelta la liga y el rollback la regresa.
INSERT INTO fayxzvov_inventory.inventory_inflow_bk_20261020
SELECT * FROM fayxzvov_inventory.inventory_inflow WHERE companies_id = @cia AND purchase_order_id IS NOT NULL;

INSERT INTO fayxzvov_inventory.inventory_shrinkage_bk_20261020
SELECT * FROM fayxzvov_inventory.inventory_shrinkage WHERE companies_id = @cia;

INSERT INTO fayxzvov_inventory.detail_inventory_shrinkage_bk_20261020
SELECT d.* FROM fayxzvov_inventory.detail_inventory_shrinkage d
WHERE d.inventory_shrinkage_id IN (SELECT id FROM fayxzvov_inventory.inventory_shrinkage WHERE companies_id = @cia);

INSERT INTO fayxzvov_inventory.inventory_adjustment_bk_20261020
SELECT * FROM fayxzvov_inventory.inventory_adjustment WHERE companies_id = @cia;

INSERT INTO fayxzvov_inventory.detail_inventory_adjustment_bk_20261020
SELECT d.* FROM fayxzvov_inventory.detail_inventory_adjustment d
WHERE d.inventory_adjustment_id IN (SELECT id FROM fayxzvov_inventory.inventory_adjustment WHERE companies_id = @cia);

INSERT INTO fayxzvov_inventory.inventory_adjustment_history_bk_20261020
SELECT h.* FROM fayxzvov_inventory.inventory_adjustment_history h
WHERE h.inventory_adjustment_id IN (SELECT id FROM fayxzvov_inventory.inventory_adjustment WHERE companies_id = @cia);

INSERT INTO fayxzvov_inventory.purchase_order_bk_20261020
SELECT * FROM fayxzvov_inventory.purchase_order WHERE companies_id = @cia;

INSERT INTO fayxzvov_inventory.detail_purchase_order_bk_20261020
SELECT d.* FROM fayxzvov_inventory.detail_purchase_order d
WHERE d.purchase_order_id IN (SELECT id FROM fayxzvov_inventory.purchase_order WHERE companies_id = @cia);

INSERT INTO fayxzvov_inventory.stock_bk_20261020
SELECT * FROM fayxzvov_inventory.stock WHERE companies_id = @cia;

-- La bitácora de entradas se queda (las entradas no se borran).
INSERT INTO fayxzvov_inventory.folio_renumeracion_bk_20261020
SELECT * FROM fayxzvov_inventory.folio_renumeracion WHERE companies_id = @cia AND tabla <> 'inventory_inflow';

-- -- Borrado --
START TRANSACTION;

-- Salidas
DELETE d FROM fayxzvov_inventory.detail_inventory_shrinkage d
INNER JOIN fayxzvov_inventory.inventory_shrinkage h ON h.id = d.inventory_shrinkage_id
WHERE h.companies_id = @cia;
DELETE FROM fayxzvov_inventory.inventory_shrinkage WHERE companies_id = @cia;

-- Ajustes (conteo físico) y su bitácora
DELETE x FROM fayxzvov_inventory.inventory_adjustment_history x
INNER JOIN fayxzvov_inventory.inventory_adjustment h ON h.id = x.inventory_adjustment_id
WHERE h.companies_id = @cia;
DELETE d FROM fayxzvov_inventory.detail_inventory_adjustment d
INNER JOIN fayxzvov_inventory.inventory_adjustment h ON h.id = d.inventory_adjustment_id
WHERE h.companies_id = @cia;
DELETE FROM fayxzvov_inventory.inventory_adjustment WHERE companies_id = @cia;

-- Compras y pedidos (misma tabla). Antes se sueltan las ligas que lo frenan:
-- entradas que nacieron de un pedido y el pedido de origen (FK a sí misma).
UPDATE fayxzvov_inventory.inventory_inflow SET purchase_order_id = NULL WHERE companies_id = @cia AND purchase_order_id IS NOT NULL;
DELETE d FROM fayxzvov_inventory.detail_purchase_order d
INNER JOIN fayxzvov_inventory.purchase_order h ON h.id = d.purchase_order_id
WHERE h.companies_id = @cia;
UPDATE fayxzvov_inventory.purchase_order SET origin_purchase_order_id = NULL WHERE companies_id = @cia;
DELETE FROM fayxzvov_inventory.purchase_order WHERE companies_id = @cia;

-- Stock = lo que sumó cada entrada aplicada (resulting_stock - previous_stock, ya en la
-- unidad del stock). Un producto sin entradas se queda sin renglón; nace con su primer movimiento.
DELETE FROM fayxzvov_inventory.stock WHERE companies_id = @cia;
INSERT INTO fayxzvov_inventory.stock (quantity, last_movement_at, created_at, warehouse_id, item_id, companies_id)
SELECT SUM(IFNULL(d.resulting_stock, 0) - IFNULL(d.previous_stock, 0)),
       MAX(IFNULL(h.confirmed_at, h.created_at)),
       MIN(h.created_at),
       h.warehouse_id, d.item_id, @cia
FROM fayxzvov_inventory.detail_inventory_inflow d
INNER JOIN fayxzvov_inventory.inventory_inflow h ON h.id = d.inventory_inflow_id
WHERE h.companies_id = @cia AND h.status = 'Aplicada' AND h.active = 1 AND d.active = 1
GROUP BY h.warehouse_id, d.item_id;

-- Bitácora de renumeración de salidas: apuntaba a los registros borrados.
DELETE FROM fayxzvov_inventory.folio_renumeracion WHERE companies_id = @cia AND tabla <> 'inventory_inflow';

COMMIT;
