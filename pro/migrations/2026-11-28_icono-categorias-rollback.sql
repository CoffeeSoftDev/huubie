-- =============================================================================
-- Rollback de 2026-11-28_icono-categorias.sql
-- Quita category.icon. Los iconos elegidos se pierden: el POS vuelve a
-- adivinarlos por el nombre.
-- IMPORTANTE: bajar ANTES el codigo que lee la columna (Catalogo › Categorias,
-- mdl-order qCatalogProducts y mdl-tienda qStoreProducts).
-- =============================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'category' AND COLUMN_NAME = 'icon') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.category DROP COLUMN icon');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;
