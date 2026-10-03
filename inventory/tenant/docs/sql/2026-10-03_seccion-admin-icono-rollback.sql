-- =====================================================================
-- ROLLBACK de 2026-10-03_seccion-admin-icono.sql
-- BD: fayxzvov_erp
--
-- Regresa la sección 8 ("Admin", módulo 7 = dev) al ícono 'house'. Con el
-- botón fijo "Inicio" del rail se verán dos casitas.
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET icon = 'house'
 WHERE id        = 8
   AND module_id = 7
   AND code      = 'admin'
   AND icon      = 'settings';
