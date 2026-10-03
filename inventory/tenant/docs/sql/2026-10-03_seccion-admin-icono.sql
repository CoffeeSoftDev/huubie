-- =====================================================================
-- Sección "Admin" del rail: casita -> engrane
-- Fecha: 03/10/2026
-- BD:    fayxzvov_erp
--
-- La casita (house) ahora es el botón fijo "Inicio" del rail, que lleva a
-- las cards de módulos (acceso/src/js/sidebar.js). La sección 8 ("Admin",
-- módulo 7 = dev) la usaba también y se veían dos casitas con destino
-- distinto: pasa a 'settings'.
--
-- Se acota por id + module_id + code (el code 'admin' se repite en otros
-- módulos) y por el ícono actual, para no pisar uno puesto a mano.
-- IDEMPOTENTE.
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET icon = 'settings'
 WHERE id        = 8
   AND module_id = 7
   AND code      = 'admin'
   AND icon      = 'house';


-- VERIFICACIÓN -----------------------------------------------------------
SELECT id, name AS seccion, icon, route AS ruta, is_active, module_id
FROM fayxzvov_erp.sections
WHERE module_id = 7
ORDER BY orden, id;
