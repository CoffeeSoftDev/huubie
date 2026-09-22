-- =====================================================================
-- Rollback de 2026-09-20_temas-navbar.sql
-- =====================================================================

SET @col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp'
      AND TABLE_NAME   = 'users'
      AND COLUMN_NAME  = 'theme_code'
);
SET @sql := IF(@col = 1,
    'ALTER TABLE fayxzvov_erp.users DROP COLUMN theme_code',
    'SELECT ''users.theme_code no existe'' AS aviso'
);
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;

DROP TABLE IF EXISTS fayxzvov_erp.themes;
