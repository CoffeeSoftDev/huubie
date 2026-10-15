-- =====================================================================
-- Tema "Huubie Claro"  (inventory)
-- Fecha: 15/10/2026
-- BD:    fayxzvov_erp
-- Requiere: 2026-09-22_temas-estilo-pro.sql
--
-- QUE ES
--   La version clara del tema "Huubie". Toma la forma del tema "Claro"
--   (barra blanca, pagina gris #F3F4F6, cards blancas) y los colores de
--   Huubie: morado y azul.
--
-- COMO SE REPARTEN
--   En Huubie predomina el morado, no el azul: el morado va en los papeles
--   que mas se ven y el azul queda de segundo color.
--   barra      #FFFFFF, mode light -> como "Claro": barra blanca, texto oscuro.
--   acento     #7C3AED -> el morado de Huubie UI: pestañas, chips, seleccion.
--                         Rampa exacta (violet de Tailwind) en tailwind-theme.js.
--   primario   #7C3AED -> botones principales.
--   secundario #1C64F2 -> la blue de alpha/ (Flowbite): detalles de la barra,
--                         boton secundario, foco de inputs y hover de las
--                         cards (data-second="own" en themes.css).
--   scheme     light   -> pagina gris de siempre.
--
-- IDEMPOTENTE: no pisa el tema si ya existe (se pudo editar en el panel).
-- Rollback: desactivarlo desde tenant/ (Personalizacion) manda a su gente al
-- tema por defecto. Para borrarlo del todo:
--   UPDATE fayxzvov_erp.users SET theme_code = NULL WHERE theme_code = 'huubie-claro';
--   DELETE FROM fayxzvov_erp.themes WHERE code = 'huubie-claro';
-- =====================================================================

-- orden 5: queda con los claros, justo antes de Huubie (6).
INSERT INTO fayxzvov_erp.themes
    (code, name, tipo, color, image, accent, primary_color, secondary_color, scheme, mode, is_default, orden, is_active, created_at)
VALUES
    ('huubie-claro', 'Huubie Claro', 'color', '#FFFFFF', NULL, '#7C3AED', '#7C3AED', '#1C64F2', 'light', 'light', 0, 5, 1, NOW())
ON DUPLICATE KEY UPDATE
    code = code;

-- La primera version (azul de acento y primario, morado de secundario)
-- alcanzo a correr en local. Solo se corrige ese trio exacto: lo editado en
-- el panel se respeta.
UPDATE fayxzvov_erp.themes
SET accent = '#7C3AED',
    primary_color = '#7C3AED',
    secondary_color = '#1C64F2'
WHERE code = 'huubie-claro'
  AND accent = '#1C64F2'
  AND primary_color = '#1C64F2'
  AND secondary_color = '#7C3AED';

SELECT code, name, tipo, color, accent, primary_color, secondary_color, scheme, mode, orden, is_active
FROM fayxzvov_erp.themes
ORDER BY orden, id;
