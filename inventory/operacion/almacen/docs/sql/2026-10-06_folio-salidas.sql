-- =====================================================================
-- Salidas: folio M-0001 -> S-0001
-- Fecha: 06/10/2026
-- BD:    fayxzvov_inventory
--
-- inventory_shrinkage.folio   las salidas guardadas con M- pasan a S- con el
--                             mismo número. Desde hoy saveSalida
--                             (ctrl-salidas) arma el folio con S- y sigue la
--                             numeración donde se quedó. Los surtidos (SI-)
--                             no cambian.
--
-- La foto de evidencia se queda donde está: evidence_url guarda la ruta
-- completa (uploads/mermas/M-0001.jpg), no se arma con el folio.
-- OJO: un comprobante ya impreso con M- no va a coincidir con el folio nuevo.
--
-- CORRER ANTES de subir el código: si saveSalida corre con S- y aún no hay
-- folios S-, la numeración arranca otra vez en S-0001.
-- Antes de correrlo, revisar que no exista ya un folio S- (no debería):
--   SELECT folio FROM fayxzvov_inventory.inventory_shrinkage WHERE folio LIKE 'S-%';
--
-- El -rollback regresa los folios S- a M-.
-- =====================================================================

UPDATE fayxzvov_inventory.inventory_shrinkage
   SET folio = CONCAT('S-', SUBSTRING(folio, 3))
 WHERE folio LIKE 'M-%';
