-- =====================================================================
-- ROLLBACK de 2026-10-19_requisiciones-y-despacho.sql
-- Quita la sección Despacho (sus permisos y los de cada rol se van con
-- ella: ON DELETE CASCADE) y regresa 'ordenes' a «Pedidos» en ordenes.php.
-- Bajar antes el código: despacho.php y la campana usan la sección.
-- =====================================================================

DELETE FROM fayxzvov_erp.sections WHERE code = 'despacho';

UPDATE fayxzvov_erp.sections
   SET name  = 'Pedidos',
       route = 'operacion/almacen/ordenes.php',
       icon  = 'clipboard-list'
 WHERE code = 'ordenes';
