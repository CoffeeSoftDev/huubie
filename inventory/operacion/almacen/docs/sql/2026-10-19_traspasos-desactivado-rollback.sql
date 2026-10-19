-- =====================================================================
-- ROLLBACK de 2026-10-19_traspasos-desactivado.sql: Traspasos vuelve a estar activo.
-- =====================================================================

UPDATE fayxzvov_erp.sections SET is_active = 1 WHERE code = 'traspasos';
