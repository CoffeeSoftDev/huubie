-- =====================================================================
-- Tema "Soft Restaurant"  (inventory)
-- Fecha: 30/09/2026
-- BD:    fayxzvov_erp
-- Requiere: 2026-09-22_temas-estilo-pro.sql
--
-- DE DONDE SALEN LOS COLORES (consultados el 30/09/2026)
--   softrestaurant.com/cloud, hoja de Webflow sr-mkt.webflow.shared.*.css:
--     --orange #ED6C20 (la pagina lo repite: var ACENTO = '#ed6c20'),
--     --orange-hover #E25724, --black #1C1E23, --purple #584569 (sus
--     titulos), --cream #FEEAE1.
--   La nube: admin.softrestaurantcloud.com manda al inicio de sesion de
--   account.nationalsoft.com.mx; su boton .btn-orange es #EB6F22.
--
-- COMO SE REPARTEN
--   barra      #1C1E23, mode dark -> su negro de marca. Con barra blanca,
--                                    como la de su sitio, se confundia con
--                                    Claro (tambien blanco con terracota).
--   acento     #ED6C20 -> su naranja: pestañas, chips, seleccion.
--   primario   #E25724 -> su naranja de "hover". El #ED6C20 con texto blanco
--                         queda en 3.1:1; este llega a 3.7:1.
--   secundario #584569 -> su morado de titulos: detalles de la barra, foco
--                         y borde de las cards al pasar encima.
--   scheme     light   -> la nube es clara: pagina gris de siempre.
--   Es el mismo tema que erp-pro/ERP24/avatars (db/2026-09-30_tema-soft-restaurant.sql).
--
-- IDEMPOTENTE: no pisa el tema si ya existe (se pudo editar en el panel).
-- Rollback: desactivarlo desde tenant/ (Personalizacion) manda a su gente al
-- tema por defecto. Para borrarlo del todo:
--   UPDATE fayxzvov_erp.users SET theme_code = NULL WHERE theme_code = 'soft-restaurant';
--   DELETE FROM fayxzvov_erp.themes WHERE code = 'soft-restaurant';
-- =====================================================================

-- orden 5, junto a Pulpos: queda con los claros, antes de Huubie.
INSERT INTO fayxzvov_erp.themes
    (code, name, tipo, color, image, accent, primary_color, secondary_color, scheme, mode, is_default, orden, is_active, created_at)
VALUES
    ('soft-restaurant', 'Soft Restaurant', 'color', '#1C1E23', NULL, '#ED6C20', '#E25724', '#584569', 'light', 'dark', 0, 5, 1, NOW())
ON DUPLICATE KEY UPDATE
    code = code;

SELECT code, name, tipo, color, accent, primary_color, secondary_color, scheme, mode, orden, is_active
FROM fayxzvov_erp.themes
ORDER BY orden, id;
