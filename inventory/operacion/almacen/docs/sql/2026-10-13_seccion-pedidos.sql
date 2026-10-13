-- =====================================================================
-- La sección "Compras" de ordenes.php pasa a llamarse "Pedidos"
-- Fecha: 13/10/2026
-- BD:    fayxzvov_erp
--
-- sections     ordenes.php ya no es una orden de compra: es el pedido de
--              materiales entre sucursales (Mis pedidos / Mis entregas).
--              Además chocaba con "Compra" (compras.php) en el menú.
--
-- Idempotente. El -rollback regresa el nombre "Compras".
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET name = 'Pedidos'
 WHERE route = 'operacion/almacen/ordenes.php';

-- Verificación: name = 'Pedidos'.
-- SELECT id, name, route FROM fayxzvov_erp.sections WHERE route = 'operacion/almacen/ordenes.php';
