-- =============================================================================
-- Temas Claro, Huubie y Midnight
-- Fecha:     09/11/2026 (10/11/2026: se suma Claro, que es el por defecto)
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Que hace:  agrega tres temas al catalogo (themes). Sin temas, la barra de
--            Catalogo esconde el boton de la paleta.
--            El tema por defecto de pro es Claro: es el que ve quien no ha
--            elegido uno y el unico que ven las empresas sin temas habilitados.
--            Huubie y Midnight no son por defecto: root los ve siempre; a cada
--            empresa se le habilitan desde developer (company_themes).
--            Se puede correr dos veces: cada INSERT revisa que no exista el code.
-- Rollback:  2026-11-09_temas-huubie-midnight-rollback.sql
-- =============================================================================

-- 1) Huubie: pagina oscura de la marca (scheme huubie).
--    Mismos colores que en inventory (fayxzvov_erp.themes, code huubie).
INSERT INTO themes (code, name, tipo, color, image, accent, primary_color, secondary_color,
                    sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'huubie', 'Huubie', 'color', '#141D2B', NULL, '#1C64F2', '#1C64F2', '#7C3AED',
       NULL, 'huubie', 'dark', NULL, 0, 1, 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'huubie');

-- 2) Midnight: pagina azul noche (scheme midnight). Lleva el mismo code que en inventory.
INSERT INTO themes (code, name, tipo, color, image, accent, primary_color, secondary_color,
                    sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'avatar-midnight', 'Midnight Blue', 'color', '#101B29', NULL, '#38BDF8', '#0284C7', '#38BDF8',
       NULL, 'midnight', 'dark', NULL, 0, 2, 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'avatar-midnight');

-- 3) Claro: el tema por defecto de pro. Barra blanca y terracota en acento,
--    botones y detalles; los mismos valores con que se dio de alta en
--    developer > Personalizacion (por eso el code es 'claro' y no 'light').
--    Queda por defecto solo si todavia no hay otro: si en developer ya se
--    eligio uno, esa eleccion se respeta.
INSERT INTO themes (code, name, tipo, color, image, accent, primary_color, secondary_color,
                    sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'claro', 'Claro', 'color', '#FFFFFF', NULL, '#C05A40', '#C05A40', '#C05A40',
       NULL, 'light', 'light', NULL,
       IF(EXISTS (SELECT 1 FROM themes WHERE is_default = 1), 0, 1), 4, 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'claro');
