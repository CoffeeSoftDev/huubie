-- =====================================================================
-- Temas del navbar al estilo de erp-pro/pro  (inventory)
-- Fecha: 22/09/2026
-- BD:    fayxzvov_erp
-- Requiere: 2026-09-20_temas-navbar.sql
--
-- QUÉ CAMBIA
--   Un tema ahora tiene TRES partes:
--     - la BARRA, como en erp-pro/pro: color plano o imagen de temporada,
--       y `mode` decide si su texto va oscuro o claro.
--     - el ACENTO (`accent`, hex editable): pestañas, chips, selección, foco.
--       De él salen las rampas 50..950 que consume Tailwind (blue-*).
--     - el PRIMARIO (`primary_color`, hex editable): los botones principales.
--       No se llama `primary` porque es palabra reservada de MySQL.
--     - el SECUNDARIO (`secondary_color`, hex editable): los detalles de la
--       barra (sucursal, selección, checks), el foco de los inputs y el borde
--       de las cards al pasar encima. Huubie lo lleva morado (#7C3AED, el
--       accent-purple de Huubie UI) sobre su azul; ERP lo lleva en el azul
--       marino institucional. Si no se distingue, es igual al acento.
--     - la PÁGINA (`scheme`): 'light' = gris #F3F4F6 de siempre; 'huubie' y
--       'midnight' = los dos oscuros (navy de Huubie UI y Midnight de
--       erp-pro/ERP24/avatars). Los temas claros NUNCA cambian el gris.
--   Las rampas se calculan en el navegador (src/js/tailwind-theme.js).
--
--   1. `tipo`    : 'color' | 'imagen'.
--   2. `image`   : ruta relativa a inventory/ (uploads/themes/<code>.<ext>).
--   3. `accent`  : hex, como lo dejó 2026-09-20.
--   4. `primary_color` : hex nuevo. Claro sigue en grafito #292524; Agents y
--                  Avatar toman su propio acento, para que no quede nada del grafito.
--   5. `scheme` : fondo de la página, 'light' | 'huubie' | 'midnight'.
--   6. Se conservan Claro / Agents / Avatar, se suman Azul Nocturno y Azul
--      Marino de erp-pro, el blanco y azul de erp-pro (ERP Corporativo, y
--      ERP Azul con la barra azul) y los oscuros Huubie, Avatar Dark y
--      Avatar Midnight. Los tres Avatar son los tres temas de
--      erp-pro/ERP24/avatars: claro con banda índigo, oscuro morado y midnight.
--   7. `secondary_color` : hex nuevo, ver arriba.
--
-- IDEMPOTENTE y sirve desde los dos puntos de partida: la tabla tal como la
-- dejó 2026-09-20 (prod) o las versiones intermedias que corrieron en local.
-- No pisa lo que se haya editado desde el panel.
-- Rollback: 2026-09-22_temas-estilo-pro-rollback.sql
-- =====================================================================


-- 1) COLUMNAS tipo e image ---------------------------------------------
-- MySQL 5.7 no acepta `ADD COLUMN IF NOT EXISTS`: se arma el ALTER solo
-- cuando falta.
SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'tipo'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE fayxzvov_erp.themes ADD COLUMN tipo VARCHAR(10) NOT NULL DEFAULT ''color'' COMMENT ''color | imagen'' AFTER name',
    'SELECT ''themes.tipo ya existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'image'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE fayxzvov_erp.themes ADD COLUMN image VARCHAR(255) NULL DEFAULT NULL COMMENT ''ruta relativa a inventory/'' AFTER color',
    'SELECT ''themes.image ya existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 2) COLUMNA accent: hex -----------------------------------------------
SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'accent'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE fayxzvov_erp.themes ADD COLUMN accent VARCHAR(20) NOT NULL DEFAULT ''#C05A40'' COMMENT ''hex del acento'' AFTER image',
    'ALTER TABLE fayxzvov_erp.themes MODIFY COLUMN accent VARCHAR(20) NOT NULL DEFAULT ''#C05A40'' COMMENT ''hex del acento'''
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Una versión intermedia (solo local) guardó la familia en vez del hex.
UPDATE fayxzvov_erp.themes
SET accent = CASE accent
                 WHEN 'neutro'  THEN '#171717'
                 WHEN 'violeta' THEN '#7C3AED'
                 ELSE '#C05A40'
             END
WHERE accent IN ('terracota', 'neutro', 'violeta');


-- 3) COLUMNA primary_color ---------------------------------------------
-- @had_primary recuerda si ya existía: los valores de Agents y Avatar solo
-- se siembran al CREAR la columna, para no pisar una edición del panel.
SET @had_primary := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'primary_color'
);
SET @sql := IF(@had_primary = 0,
    'ALTER TABLE fayxzvov_erp.themes ADD COLUMN primary_color VARCHAR(20) NOT NULL DEFAULT ''#292524'' COMMENT ''hex de los botones principales'' AFTER accent',
    'SELECT ''themes.primary_color ya existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE fayxzvov_erp.themes
SET primary_color = accent
WHERE @had_primary = 0
  AND code IN ('agents', 'avatar');


-- 3b) COLUMNA scheme ---------------------------------------------------
SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'scheme'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE fayxzvov_erp.themes ADD COLUMN scheme VARCHAR(10) NOT NULL DEFAULT ''light'' COMMENT ''fondo de la pagina: light | huubie | midnight'' AFTER primary_color',
    'SELECT ''themes.scheme ya existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;


-- 3c) COLUMNA secondary_color ------------------------------------------
-- Igual que primary_color: los valores propios solo se siembran al CREAR la
-- columna; el resto arranca igual a su acento, que es no cambiar nada.
SET @had_secondary := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'secondary_color'
);
SET @sql := IF(@had_secondary = 0,
    'ALTER TABLE fayxzvov_erp.themes ADD COLUMN secondary_color VARCHAR(20) NOT NULL DEFAULT ''#C05A40'' COMMENT ''hex de la barra, el foco y el hover de cards'' AFTER primary_color',
    'SELECT ''themes.secondary_color ya existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE fayxzvov_erp.themes
SET secondary_color = CASE
                          WHEN code IN ('huubie', 'avatar-dark')         THEN '#7C3AED'
                          WHEN code IN ('erp-corporativo', 'erp-azul')   THEN '#003360'
                          ELSE accent
                      END
WHERE @had_secondary = 0;


-- 4) LOS TEMAS ---------------------------------------------------------
-- Solo se insertan los que falten: si ya existen NO se pisan, porque desde
-- el panel se les puede haber cambiado nombre, colores o imagen.
-- is_default NO se toca aquí: se resuelve en el paso 6.
INSERT INTO fayxzvov_erp.themes
    (code, name, tipo, color, image, accent, primary_color, secondary_color, scheme, mode, is_default, orden, is_active, created_at)
VALUES
    ('light',           'Claro',           'color', '#FFFFFF', NULL, '#C05A40', '#292524', '#C05A40', 'light',    'light', 0, 1, 1, NOW()),
    ('agents',          'Agents',          'color', '#FFFFFF', NULL, '#171717', '#171717', '#171717', 'light',    'light', 0, 2, 1, NOW()),
    -- Avatar = el tema claro de erp-pro/ERP24/avatars: la cabecera es una
    -- banda índigo #6366F1 con texto blanco y el acento es su morado #7C3AED.
    ('avatar',          'Avatar',          'color', '#6366F1', NULL, '#7C3AED', '#7C3AED', '#7C3AED', 'light',    'dark',  0, 3, 1, NOW()),
    -- El de erp-pro/pro: barra blanca, pestañas en el blue-600 de Tailwind
    -- (#2563EB) y botones y detalles de la barra en el azul institucional
    -- #003360. Comparte orden 3 con Avatar para quedar junto a los claros sin
    -- mover a los demás.
    ('erp-corporativo', 'ERP Corporativo', 'color', '#FFFFFF', NULL, '#2563EB', '#003360', '#003360', 'light',    'light', 0, 3, 1, NOW()),
    -- La misma pareja de colores con la barra en el Azul Marino de erp-pro.
    ('erp-azul',        'ERP Azul',        'color', '#003360', NULL, '#2563EB', '#003360', '#003360', 'light',    'dark',  0, 3, 1, NOW()),
    ('azul-nocturno',   'Azul Nocturno',   'color', '#0F2740', NULL, '#C05A40', '#292524', '#C05A40', 'light',    'dark',  0, 4, 1, NOW()),
    ('azul-marino',     'Azul Marino',     'color', '#003360', NULL, '#C05A40', '#292524', '#C05A40', 'light',    'dark',  0, 5, 1, NOW()),
    -- Oscuros. Huubie: paleta de Huubie UI (grimorio-huubie-ui): azul #1C64F2
    -- en botones y pestañas, morado #7C3AED en la barra, el foco y el hover.
    -- Avatar Dark: el tema oscuro de avatars (visor.css): las superficies de
    -- Huubie con el morado como acento.
    -- Midnight: [data-theme="midnight"] de erp-pro/ERP24/avatars/src/css/visor.css;
    -- el primario baja a #0284C7 porque el #38BDF8 no sostiene texto blanco.
    ('huubie',          'Huubie',          'color', '#141D2B', NULL, '#1C64F2', '#1C64F2', '#7C3AED', 'huubie',   'dark',  0, 6, 1, NOW()),
    ('avatar-dark',     'Avatar Dark',     'color', '#141D2B', NULL, '#7C3AED', '#7C3AED', '#7C3AED', 'huubie',   'dark',  0, 7, 1, NOW()),
    ('avatar-midnight', 'Avatar Midnight', 'color', '#101B29', NULL, '#38BDF8', '#0284C7', '#38BDF8', 'midnight', 'dark',  0, 7, 1, NOW())
ON DUPLICATE KEY UPDATE
    code = code;

-- Claro y Avatar venían de 2026-09-20 con color '#F3F4F6': ahí `color` era
-- el fondo de la PÁGINA, no el de la barra. Solo se corrige ese valor
-- exacto; uno elegido después en el panel se respeta. Claro vuelve a su
-- barra blanca y Avatar toma la banda índigo de avatars.
UPDATE fayxzvov_erp.themes
SET color = '#FFFFFF'
WHERE code = 'light'
  AND color = '#F3F4F6';

UPDATE fayxzvov_erp.themes
SET color = '#6366F1',
    mode  = 'dark'
WHERE code = 'avatar'
  AND color = '#F3F4F6';


-- 5) BLANCO CORPORATIVO SE FUNDE EN CLARO ------------------------------
-- Una versión intermedia (solo local) sembró 'blanco-corporativo', idéntico
-- a Claro. Quien lo tuviera vuelve al de por defecto.
UPDATE fayxzvov_erp.users
SET theme_code = NULL
WHERE theme_code = 'blanco-corporativo';

DELETE FROM fayxzvov_erp.themes
WHERE code = 'blanco-corporativo';


-- 6) TEMA POR DEFECTO --------------------------------------------------
-- Si no quedó ninguno marcado, Claro. El SELECT va envuelto en una tabla
-- derivada porque MySQL no deja leer en un subquery la tabla que actualiza.
UPDATE fayxzvov_erp.themes
SET is_default = 1
WHERE code = 'light'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT id FROM fayxzvov_erp.themes WHERE is_default = 1) d
  );


-- 7) VERIFICACIÓN ------------------------------------------------------
-- Tiene que salir EXACTAMENTE 1.
SELECT COUNT(*) AS temas_por_defecto FROM fayxzvov_erp.themes WHERE is_default = 1;

SELECT code, name, tipo, color, image, accent, primary_color, secondary_color, scheme, mode, is_default, orden, is_active
FROM fayxzvov_erp.themes
ORDER BY orden, id;

-- Nadie puede apuntar a un tema que no existe.
SELECT u.id, u.theme_code AS tema_huerfano
FROM fayxzvov_erp.users u
LEFT JOIN fayxzvov_erp.themes t ON t.code = u.theme_code
WHERE u.theme_code IS NOT NULL AND u.theme_code <> '' AND t.id IS NULL;
