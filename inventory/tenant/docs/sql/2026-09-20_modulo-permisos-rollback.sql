-- =====================================================================
-- Rollback de 2026-09-20_modulo-permisos.sql
-- Borra en orden inverso: permisos -> sección -> módulo.
-- =====================================================================

SET @section_id = (SELECT id FROM fayxzvov_erp.sections
                   WHERE code = 'permisos-editor' ORDER BY id DESC LIMIT 1);

DELETE FROM fayxzvov_erp.permissions WHERE section_id = @section_id;
DELETE FROM fayxzvov_erp.sections    WHERE id         = @section_id;
DELETE FROM fayxzvov_erp.modules     WHERE code       = 'permisos';
