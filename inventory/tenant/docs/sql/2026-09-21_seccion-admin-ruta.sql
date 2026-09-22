-- =====================================================================
-- Sección "Admin" del rail: se le pone la ruta que le faltaba
-- Fecha: 21/09/2026
-- BD:    fayxzvov_erp
--
-- SÍNTOMA
--   Dentro de /inventory/tenant/ el rail lateral mostraba el botón "Admin"
--   y, al darle clic, la pantalla volvía al login. Parecía sesión caída.
--
-- CAUSA
--   La sección 8 ("Admin", módulo 7 = dev) se creó con route = NULL.
--   El rail arma la URL como base + '/' + route (acceso/src/js/sidebar.js),
--   así que con route vacía apuntaba a /inventory/ ... que es el login.
--
-- QUÉ HACE
--   Le pone la ruta del administrador de accesos, que es el que está vivo
--   y el que usa el login (users / users_braches / roles / permissions).
--   Ver inventory/admin/accesos/.
--
-- NOTA: ctrl-access.php::menu() ya no emite secciones sin ruta, así que
--   aunque esta migración no corra el botón deja de mandar al login: ahora
--   simplemente no se pinta. Esta migración es la que lo hace ÚTIL.
--
-- IDEMPOTENTE: el WHERE sólo toca la fila mientras siga sin ruta, así que
--   correrla dos veces no pisa un valor puesto a mano después.
-- =====================================================================


-- 1) LA RUTA -------------------------------------------------------------
-- Se acota por id + module_id + code porque el code 'admin' está repetido:
-- la sección 24 ('Administrador', módulo 1) también lo usa y esa sí apunta
-- a 'tenant'. No queremos tocarla.
UPDATE fayxzvov_erp.sections
   SET route = 'admin/accesos/'
 WHERE id        = 8
   AND module_id = 7
   AND code      = 'admin'
   AND (route IS NULL OR route = '');


-- 2) VERIFICACIÓN --------------------------------------------------------
SELECT s.id, s.name AS seccion, s.icon, s.route AS ruta, s.is_active,
       m.code AS modulo, m.route AS ruta_modulo
FROM fayxzvov_erp.sections s
JOIN fayxzvov_erp.modules m ON m.id = s.module_id
WHERE s.module_id = 7
ORDER BY s.orden, s.id;
