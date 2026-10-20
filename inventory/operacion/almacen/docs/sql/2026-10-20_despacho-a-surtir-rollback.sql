-- =====================================================================
-- ROLLBACK de 2026-10-20_despacho-a-surtir.sql
-- El módulo vuelve a llamarse «Despacho» en el menú lateral.
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET name = 'Despacho'
 WHERE code = 'despacho';
