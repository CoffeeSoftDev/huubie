-- =====================================================================
-- ROLLBACK de 2026-09-21_seccion-admin-ruta.sql
-- BD: fayxzvov_erp
--
-- Devuelve la sección 8 ("Admin", módulo 7 = dev) a route = NULL, que es
-- como estaba. OJO: en ese estado el botón del rail no se pinta (lo filtra
-- ctrl-access.php::menu()); antes del fix de código mandaba al login.
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET route = NULL
 WHERE id        = 8
   AND module_id = 7
   AND code      = 'admin'
   AND route     = 'admin/accesos/';


-- VERIFICACIÓN -----------------------------------------------------------
SELECT id, name AS seccion, route AS ruta, is_active, module_id
FROM fayxzvov_erp.sections
WHERE module_id = 7
ORDER BY orden, id;
