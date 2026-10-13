-- =====================================================================
-- Rollback de 2026-10-13_seccion-pedidos.sql
-- Fecha: 13/10/2026
-- BD:    fayxzvov_erp
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET name = 'Compras'
 WHERE route = 'operacion/almacen/ordenes.php';
