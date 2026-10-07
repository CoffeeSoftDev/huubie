-- =====================================================================
-- ROLLBACK :: Sección "Accesos" del módulo Configuración
-- Fecha: 06/10/2026
-- BD:    fayxzvov_erp
--
-- Quita la sección 'configuracion-accesos' y sus permisos. El módulo
-- Configuración vuelve a quedar sin secciones (rail vacío y sin card).
-- =====================================================================

SET @section_id = (SELECT id FROM fayxzvov_erp.sections
                   WHERE code = 'configuracion-accesos' ORDER BY id DESC LIMIT 1);

DELETE FROM fayxzvov_erp.permissions WHERE section_id = @section_id;
DELETE FROM fayxzvov_erp.sections    WHERE id = @section_id;
