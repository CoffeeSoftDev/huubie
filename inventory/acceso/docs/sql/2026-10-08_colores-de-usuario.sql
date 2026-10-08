-- =====================================================================
-- Colores de usuario :: de pastel a los tonos de avatar habituales
-- Fecha: 08/10/2026
-- BD:    fayxzvov_erp
--
-- QUÉ CAMBIA
--   `users.color` pinta el avatar del login, de la navbar y de Accesos, con
--   el ícono `user` en blanco encima. La paleta pastel dejaba ese ícono casi
--   invisible. La nueva es la de los avatares de Google y Microsoft
--   (USER_COLOR_PALETTE en admin/accesos/js/accesos.js y tenant/js/saas.js).
--
--   Cada pastel pasa al tono nuevo más parecido:
--
--     #F4B8A4 durazno     -> #CA5010 naranja
--     #A9CBD4 gris azul   -> #69797E gris
--     #B8C4E0 pervinca    -> #1A73E8 azul
--     #B7D9A0 verde       -> #188038 verde
--     #E8CBA0 beige       -> #986F0B dorado
--     #C7B8E3 lavanda     -> #8764B8 violeta
--     #A3D0DE cian        -> #038387 turquesa
--     #E6B4C0 rosa        -> #E3008C rosa
--     #A6DDBF menta       -> #188038 verde
--     #E0C68A arena       -> #986F0B dorado
--
--   Un color que no esté en la lista (o NULL) no se toca.
--
-- RESPALDO
--   Dos pasteles caen en el mismo tono nuevo, así que el cambio no se puede
--   deshacer leyendo `color`. Antes del UPDATE se copia (id, color) a
--   `users_color_bk_20261008`; el archivo -rollback lo regresa desde ahí.
--
-- IDEMPOTENTE: sí. Una segunda corrida no encuentra pasteles; el CREATE
--   lleva IF NOT EXISTS y conserva el respaldo de la primera.
--
-- OJO: el login guarda el color del usuario recordado en localStorage.
--   Cada quien ve el tono nuevo en la tarjeta del login a partir de su
--   siguiente inicio de sesión.
-- =====================================================================


-- 1) RESPALDO ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fayxzvov_erp.users_color_bk_20261008 AS
    SELECT id, color FROM fayxzvov_erp.users;


-- 2) PASTEL -> TONO NUEVO ------------------------------------------------
UPDATE fayxzvov_erp.users
   SET color = CASE UPPER(color)
           WHEN '#F4B8A4' THEN '#CA5010'
           WHEN '#A9CBD4' THEN '#69797E'
           WHEN '#B8C4E0' THEN '#1A73E8'
           WHEN '#B7D9A0' THEN '#188038'
           WHEN '#E8CBA0' THEN '#986F0B'
           WHEN '#C7B8E3' THEN '#8764B8'
           WHEN '#A3D0DE' THEN '#038387'
           WHEN '#E6B4C0' THEN '#E3008C'
           WHEN '#A6DDBF' THEN '#188038'
           WHEN '#E0C68A' THEN '#986F0B'
       END
 WHERE UPPER(color) IN ('#F4B8A4', '#A9CBD4', '#B8C4E0', '#B7D9A0', '#E8CBA0',
                        '#C7B8E3', '#A3D0DE', '#E6B4C0', '#A6DDBF', '#E0C68A');


-- 3) VERIFICACIÓN --------------------------------------------------------
SELECT color, COUNT(*) AS usuarios
  FROM fayxzvov_erp.users
 GROUP BY color
 ORDER BY usuarios DESC;
