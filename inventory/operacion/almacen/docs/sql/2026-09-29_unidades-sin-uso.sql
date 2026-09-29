-- =====================================================================
-- Unidades de medida: borrar las que no se usan
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- Correr DESPUÉS de 2026-09-29_unidades-unificar.sql.
--
-- "Sin uso" = ningún producto (item_attribute), renglón de entrada
-- (detail_inventory_inflow) ni renglón de orden de compra (detail_purchase_order)
-- la referencia. Son las únicas tres columnas unit_id del esquema.
--
-- Solo la empresa de @empresa: una empresa recién dada de alta y todavía sin
-- productos perdería su catálogo completo. En prod confirmar el id antes de correr.
--
-- En local (29/09/2026) quedaron solo KG y PZA; se borraron 20, entre ellas
-- LT, GRS y GL.
--
-- Respaldo para el -rollback: bk_unit_unused_20260929 (las filas borradas).
-- =====================================================================

SET @empresa = 1;

CREATE TABLE fayxzvov_inventory.bk_unit_unused_20260929 AS
SELECT u.*
FROM fayxzvov_inventory.unit u
WHERE u.companies_id = @empresa
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.item_attribute          x WHERE x.unit_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.detail_inventory_inflow x WHERE x.unit_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.detail_purchase_order   x WHERE x.unit_id = u.id);

DELETE FROM fayxzvov_inventory.unit
WHERE id IN (SELECT id FROM fayxzvov_inventory.bk_unit_unused_20260929);
