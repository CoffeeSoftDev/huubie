-- =====================================================================
-- ROLLBACK de 2026-10-06_coffeeia-activo.sql
-- Quita coffeeia_config.active: coffeeIA vuelve a estar siempre encendido.
-- Bajar antes el código que la lee (mdl-coffeeia, mdl-almacen).
-- =====================================================================

ALTER TABLE fayxzvov_erp.coffeeia_config
    DROP COLUMN active;
