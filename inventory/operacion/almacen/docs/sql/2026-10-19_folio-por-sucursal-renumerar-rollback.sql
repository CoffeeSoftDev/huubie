-- =====================================================================
-- ROLLBACK de 2026-10-19_folio-por-sucursal-renumerar.sql
-- Antes: bajar el código (mdl-folios.php). Los documentos que se crearon ya con
-- folio nuevo no están en folio_renumeracion: se quedan como están.
-- Regresa cada folio y cada nota a como estaban y borra folio_renumeracion.
-- =====================================================================

UPDATE fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_inflow' AND r.registro_id = t.id
SET t.folio = r.folio_antes
WHERE t.folio = r.folio_despues;

UPDATE fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_shrinkage' AND r.registro_id = t.id
SET t.folio = r.folio_antes
WHERE t.folio = r.folio_despues;

UPDATE fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.registro_id = t.id
SET t.folio = r.folio_antes
WHERE t.folio = r.folio_despues;

UPDATE fayxzvov_inventory.inventory_adjustment t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_adjustment' AND r.registro_id = t.id
SET t.folio = r.folio_antes
WHERE t.folio = r.folio_despues;

UPDATE fayxzvov_inventory.inventory_transfer t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_transfer' AND r.registro_id = t.id
SET t.folio = r.folio_antes
WHERE t.folio = r.folio_despues;

-- Notas (dos pasadas, como en la migración).
UPDATE fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_despues, r.folio_antes)
WHERE t.note LIKE CONCAT('%', r.folio_despues, '%');

UPDATE fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_despues, r.folio_antes)
WHERE t.note LIKE CONCAT('%', r.folio_despues, '%');

UPDATE fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_despues, r.folio_antes)
WHERE t.note LIKE CONCAT('%', r.folio_despues, '%');

UPDATE fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_despues, r.folio_antes)
WHERE t.note LIKE CONCAT('%', r.folio_despues, '%');

UPDATE fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_despues, r.folio_antes)
WHERE t.note LIKE CONCAT('%', r.folio_despues, '%');

UPDATE fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_despues, r.folio_antes)
WHERE t.note LIKE CONCAT('%', r.folio_despues, '%');

DROP TABLE fayxzvov_inventory.folio_renumeracion;
