-- =====================================================================
-- Rollback de 2026-10-07_seccion-reportes.sql
-- Fecha: 07/10/2026
-- BD:    fayxzvov_erp
--
-- Borra los permisos y la sección Reportes (operacion/almacen/reportes.php).
-- Primero los permisos: apuntan a sections.id.
-- =====================================================================

DELETE p
  FROM fayxzvov_erp.permissions p
  JOIN fayxzvov_erp.sections s ON s.id = p.section_id
 WHERE s.route = 'operacion/almacen/reportes.php';

DELETE FROM fayxzvov_erp.sections
 WHERE route = 'operacion/almacen/reportes.php';
