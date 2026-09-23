-- =====================================================================
-- ROLLBACK de 2026-09-22_temas-estilo-pro.sql
-- BD: fayxzvov_erp
--
-- Deja la tabla como la dejó 2026-09-20_temas-navbar.sql: se van `tipo`,
-- `image`, `primary_color`, `secondary_color` y `scheme`, y quedan solo
-- light / agents / avatar.
-- Los temas creados después (incluidos Azul Nocturno y Azul Marino) se
-- BORRAN, y quien los tenía elegido vuelve al de por defecto (NULL).
-- Las imágenes de inventory/uploads/themes/ NO se borran: hacerlo a mano.
-- =====================================================================

UPDATE fayxzvov_erp.users
SET theme_code = NULL
WHERE theme_code IS NOT NULL
  AND theme_code NOT IN ('light', 'agents', 'avatar');

DELETE FROM fayxzvov_erp.themes
WHERE code NOT IN ('light', 'agents', 'avatar');

ALTER TABLE fayxzvov_erp.themes MODIFY COLUMN accent VARCHAR(20) NOT NULL DEFAULT '#C05A40';

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'scheme'
);
SET @sql := IF(@col = 1,
    'ALTER TABLE fayxzvov_erp.themes DROP COLUMN scheme',
    'SELECT ''themes.scheme ya no existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'secondary_color'
);
SET @sql := IF(@col = 1,
    'ALTER TABLE fayxzvov_erp.themes DROP COLUMN secondary_color',
    'SELECT ''themes.secondary_color ya no existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'primary_color'
);
SET @sql := IF(@col = 1,
    'ALTER TABLE fayxzvov_erp.themes DROP COLUMN primary_color',
    'SELECT ''themes.primary_color ya no existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'image'
);
SET @sql := IF(@col = 1,
    'ALTER TABLE fayxzvov_erp.themes DROP COLUMN image',
    'SELECT ''themes.image ya no existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'themes' AND COLUMN_NAME = 'tipo'
);
SET @sql := IF(@col = 1,
    'ALTER TABLE fayxzvov_erp.themes DROP COLUMN tipo',
    'SELECT ''themes.tipo ya no existía'' AS aviso'
);
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Los colores originales de 2026-09-20 (guardaban el fondo de la página).
UPDATE fayxzvov_erp.themes SET color = '#F3F4F6', mode = 'light' WHERE code IN ('light', 'avatar');
UPDATE fayxzvov_erp.themes SET color = '#FFFFFF' WHERE code = 'agents';

UPDATE fayxzvov_erp.themes
SET is_default = 1
WHERE code = 'light'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT id FROM fayxzvov_erp.themes WHERE is_default = 1) d
  );

SELECT code, name, color, accent, mode, is_default, orden FROM fayxzvov_erp.themes ORDER BY orden, id;
