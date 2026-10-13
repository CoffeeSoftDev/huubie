-- =====================================================================
-- Rollback de 2026-10-13_quitar-seccion-solicitudes.sql
-- Fecha: 13/10/2026
-- BD:    fayxzvov_erp
--
-- Vuelve a encender la sección Solicitudes. OJO: solicitudes.php y
-- js/solicitudes.js se borraron; hay que recuperarlos de git y también
-- showOrdenes / getOrdenKpis y el filtro `mine` de ctrl/mdl-ordenes.
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET is_active = 1
 WHERE route = 'operacion/almacen/solicitudes.php';
