-- =============================================================================
-- Rollback de los temas Claro, Huubie y Midnight
-- Fecha:     09/11/2026 (10/11/2026: se suma Claro)
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Que hace:  quita lo que agrego 2026-11-09_temas-huubie-midnight.sql.
--            Antes suelta a quien los tenia elegido (theme_code = NULL) y las
--            habilitaciones por empresa, para no dejar filas colgando.
-- Ojo:       Claro es el tema por defecto. Si no queda otro tema en el
--            catalogo, la barra vuelve a esconder el boton de la paleta.
--            En local Claro se dio de alta a mano en developer: este rollback
--            tambien lo quita.
-- =============================================================================

UPDATE users
SET theme_code = NULL
WHERE theme_code IN ('claro', 'huubie', 'avatar-midnight');

DELETE ct
FROM company_themes ct
INNER JOIN themes t ON t.id = ct.theme_id
WHERE t.code IN ('claro', 'huubie', 'avatar-midnight');

DELETE FROM themes WHERE code IN ('claro', 'huubie', 'avatar-midnight');
