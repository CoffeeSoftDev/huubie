-- =====================================================================
-- ROLLBACK :: Colores de usuario
-- Fecha: 08/10/2026
-- BD:    fayxzvov_erp
--
-- Regresa a cada usuario el color que tenía antes de la migración, desde el
-- respaldo `users_color_bk_20261008`, y borra el respaldo.
--
-- OJO: si alguien eligió un color en Accesos después de migrar, este
--   rollback se lo pisa con el de antes. La paleta pastel tampoco vuelve
--   sola: hay que regresar USER_COLOR_PALETTE en admin/accesos/js/accesos.js,
--   tenant/js/saas.js y configuracion/js/accesos.js.
-- =====================================================================

UPDATE fayxzvov_erp.users u
  JOIN fayxzvov_erp.users_color_bk_20261008 b ON b.id = u.id
   SET u.color = b.color;

DROP TABLE fayxzvov_erp.users_color_bk_20261008;
