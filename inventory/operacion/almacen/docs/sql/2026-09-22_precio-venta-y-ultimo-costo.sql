-- =====================================================================
-- Precio de venta y último costo: cada uno en su columna
-- Fecha: 22/09/2026
-- BD:    fayxzvov_inventory
--
-- SÍNTOMA
--   El producto no tenía dónde guardar el precio de venta. Lo que se tecleaba
--   en Almacén > Productos ("Costo sin IVA / IVA / Precio con IVA") caía en
--   item.price / price_without_tax / tax, y la primera entrada lo pisaba con
--   el costo de la compra (updateItemTax en ctrl-entradas y ctrl-ordenes).
--   Además item_attribute.cost_unit era una copia del formulario que ninguna
--   entrada actualizaba: ACEITE quedó con price = 25 y cost_unit = 0.
--
-- MODELO NUEVO (mismo patrón que el POS: order_products.price para vender,
-- product_attribute.cost_unit para inventario)
--   item.price                 precio de venta CON IVA   (formulario)
--   item.price_without_tax     precio de venta SIN IVA   (formulario)
--   item.tax                   IVA de venta, %           (formulario)
--   item_attribute.cost_unit   último costo SIN IVA      (entradas y recepciones)
--   item_attribute.cost_tax    IVA de esa compra, %      (columna nueva)
--
-- REGLA PARA LOS DATOS QUE YA EXISTEN
--   a) Producto CON entradas: lo que hay en item.* lo dejó la última compra,
--      o sea que es costo. Se pasa a cost_unit / cost_tax (del renglón de
--      entrada más reciente con costo > 0) y el precio de venta queda en 0.
--   b) Producto SIN entradas: lo que hay en item.* lo tecleó el usuario y se
--      toma como precio de venta. Su cost_unit era copia de ese precio: va a 0.
--
-- EN PRODUCCIÓN: antes de correrla, revisar con la consulta 0) qué productos
--   caen en a) y en b). La regla b) supone que nadie capturó ahí un costo.
--
-- RESPALDO: item_precio_bk_20260922 y item_attribute_costo_bk_20260922.
--   El -rollback los regresa y quita la columna nueva.
-- =====================================================================

-- Las tablas temporales del paso 3 necesitan una BD seleccionada.
USE fayxzvov_inventory;


-- 0) REVISIÓN PREVIA (solo lectura) ---------------------------------------
SELECT i.id, i.name, i.price, i.price_without_tax, i.tax, ia.cost_unit,
       (SELECT COUNT(*)
          FROM fayxzvov_inventory.detail_inventory_inflow d
          JOIN fayxzvov_inventory.inventory_inflow r ON r.id = d.inventory_inflow_id
         WHERE d.item_id = i.id AND d.active = 1 AND r.status <> 'Cancelada') AS entradas
  FROM fayxzvov_inventory.item i
  LEFT JOIN fayxzvov_inventory.item_attribute ia ON ia.item_id = i.id
 WHERE i.price > 0 OR i.price_without_tax > 0 OR ia.cost_unit > 0;


-- 1) RESPALDO -------------------------------------------------------------
CREATE TABLE fayxzvov_inventory.item_precio_bk_20260922 AS
SELECT id, price, price_without_tax, tax
FROM fayxzvov_inventory.item;

CREATE TABLE fayxzvov_inventory.item_attribute_costo_bk_20260922 AS
SELECT id, item_id, cost_unit
FROM fayxzvov_inventory.item_attribute;


-- 2) COLUMNA NUEVA --------------------------------------------------------
ALTER TABLE fayxzvov_inventory.item_attribute
    ADD COLUMN cost_tax DOUBLE NULL AFTER cost_unit;


-- 3) PRODUCTOS CON ENTRADAS -----------------------------------------------
-- Último renglón con costo de una entrada no cancelada, por producto.
CREATE TEMPORARY TABLE tmp_ultimo_costo AS
SELECT d.item_id, d.price_without_tax AS base, d.tax
FROM fayxzvov_inventory.detail_inventory_inflow d
JOIN (
    SELECT d2.item_id, MAX(d2.id) AS last_id
    FROM fayxzvov_inventory.detail_inventory_inflow d2
    JOIN fayxzvov_inventory.inventory_inflow r2 ON r2.id = d2.inventory_inflow_id
    WHERE d2.active = 1 AND r2.status <> 'Cancelada' AND d2.cost > 0
    GROUP BY d2.item_id
) u ON u.last_id = d.id;

CREATE TEMPORARY TABLE tmp_con_entradas AS
SELECT DISTINCT d.item_id
FROM fayxzvov_inventory.detail_inventory_inflow d
JOIN fayxzvov_inventory.inventory_inflow r ON r.id = d.inventory_inflow_id
WHERE d.active = 1 AND r.status <> 'Cancelada' AND d.item_id IS NOT NULL;

-- cost_unit era copia del formulario: se limpia en todos y se vuelve a
-- llenar solo con el costo real de compra.
UPDATE fayxzvov_inventory.item_attribute
   SET cost_unit = 0, cost_tax = NULL;

UPDATE fayxzvov_inventory.item_attribute ia
  JOIN tmp_ultimo_costo t ON t.item_id = ia.item_id
   SET ia.cost_unit = t.base,
       ia.cost_tax  = t.tax;

-- Su item.* era costo, no precio de venta: queda en 0 para capturarlo.
UPDATE fayxzvov_inventory.item i
  JOIN tmp_con_entradas c ON c.item_id = i.id
   SET i.price = 0, i.price_without_tax = 0, i.tax = 0;


-- 4) PRODUCTOS SIN ENTRADAS -----------------------------------------------
-- No se tocan: su item.* queda como precio de venta.


-- 5) VERIFICACIÓN ---------------------------------------------------------
-- Esperado: con_costo = productos con entradas costeadas; en local, ACEITE
-- con cost_unit = 25 y price = 0; NUEZ PICADA, BASE DORADA y cafe nimbuz
-- conservan su precio y quedan con cost_unit = 0.
SELECT i.id, i.name, i.price, i.price_without_tax, i.tax, ia.cost_unit, ia.cost_tax
  FROM fayxzvov_inventory.item i
  JOIN fayxzvov_inventory.item_attribute ia ON ia.item_id = i.id
 WHERE i.price > 0 OR ia.cost_unit > 0;

DROP TEMPORARY TABLE tmp_ultimo_costo;
DROP TEMPORARY TABLE tmp_con_entradas;
