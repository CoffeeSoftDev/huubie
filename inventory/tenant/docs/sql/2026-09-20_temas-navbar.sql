-- =====================================================================
-- Selector de temas del navbar  (inventory)
-- Fecha: 20/09/2026
-- BD:    fayxzvov_erp
--
-- QUÉ HACE
--   1. Tabla `themes` con el catálogo de temas del navbar.
--   2. Columna `users.theme_code` para guardar la elección de cada usuario.
--
-- POR QUÉ DOS COLUMNAS DE COLOR
--   `color`  = fondo de la barra.
--   `accent` = color de acento (botones, bordes, pill de sucursal).
--   Los tres temas son CLAROS y casi todos con la barra blanca: lo que los
--   distingue es el acento, así que con una sola columna la muestra de color
--   del selector saldría prácticamente idéntica en los tres.
--
-- Modelado sobre rfwsmqex_erp.themes (erp-pro), sin las columnas `tipo` e
-- `image`: aquí no hay temas de fotografía.
--
-- IDEMPOTENTE: se puede correr dos veces sin duplicar ni romper.
-- =====================================================================


-- 1) CATÁLOGO DE TEMAS ---------------------------------------------------
CREATE TABLE IF NOT EXISTS fayxzvov_erp.themes (
    id         INT(11)     NOT NULL AUTO_INCREMENT,
    code       VARCHAR(40) NOT NULL,
    name       VARCHAR(80) NOT NULL,
    color      VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
    accent     VARCHAR(20) NOT NULL DEFAULT '#C05A40',
    mode       VARCHAR(10) NOT NULL DEFAULT 'light',
    badge      VARCHAR(30)     NULL DEFAULT NULL,
    is_default SMALLINT(6)     NULL DEFAULT 0,
    orden      SMALLINT(6)     NULL DEFAULT 1,
    is_active  SMALLINT(6)     NULL DEFAULT 1,
    created_at DATETIME        NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_themes_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- 2) LOS TRES TEMAS ------------------------------------------------------
-- Los tres son CLAROS. Salen de los temas [data-theme="light"] / :root de:
--   light  -> el de siempre en inventory: gris #F3F4F6 con acento terracota.
--   agents -> erp-pro/ERP24/agents/src/css/agents.css  (shadcn neutro).
--             Su acento NO es un color: es el contraste, un casi negro #171717
--             sobre fondo blanco. Así está declarado en el origen.
--   avatar -> erp-pro/ERP24/avatars/src/css/visor.css  (claro con violeta).
INSERT INTO fayxzvov_erp.themes
    (code, name, color, accent, mode, is_default, orden, is_active, created_at)
VALUES
    ('light',  'Claro',  '#F3F4F6', '#C05A40', 'light', 1, 1, 1, NOW()),
    ('agents', 'Agents', '#FFFFFF', '#171717', 'light', 0, 2, 1, NOW()),
    ('avatar', 'Avatar', '#F3F4F6', '#7C3AED', 'light', 0, 3, 1, NOW())
ON DUPLICATE KEY UPDATE
    name   = VALUES(name),
    color  = VALUES(color),
    accent = VALUES(accent),
    mode   = VALUES(mode),
    orden  = VALUES(orden);


-- 3) COLUMNA EN USERS ----------------------------------------------------
-- MySQL 5.7 no acepta `ADD COLUMN IF NOT EXISTS` (eso es MariaDB), así que
-- se consulta information_schema y se arma el ALTER solo cuando falta.
SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp'
      AND TABLE_NAME   = 'users'
      AND COLUMN_NAME  = 'theme_code'
);
SET @sql := IF(@col = 0,
    'ALTER TABLE fayxzvov_erp.users ADD COLUMN theme_code VARCHAR(40) NULL DEFAULT NULL AFTER color',
    'SELECT ''users.theme_code ya existía, no se tocó'' AS aviso'
);
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;


-- 4) VERIFICACIÓN --------------------------------------------------------
SELECT code, name, color, accent, mode, is_default, orden
FROM fayxzvov_erp.themes
WHERE is_active = 1
ORDER BY orden, id;
