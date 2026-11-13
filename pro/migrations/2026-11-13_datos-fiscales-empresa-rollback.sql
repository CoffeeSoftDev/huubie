-- =============================================================================
-- Rollback de 2026-11-13_datos-fiscales-empresa.sql
-- Quita de companies las columnas de datos fiscales y de contacto. Lo que el
-- dueño haya escrito en ellas se pierde.
-- =============================================================================

ALTER TABLE companies
    DROP COLUMN legal_name,
    DROP COLUMN tax_regime,
    DROP COLUMN zip_code,
    DROP COLUMN phone,
    DROP COLUMN email;
