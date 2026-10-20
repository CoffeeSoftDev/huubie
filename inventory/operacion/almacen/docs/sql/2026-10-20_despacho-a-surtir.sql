-- =====================================================================
-- El módulo Despacho se llama «Surtir» en el menú lateral
-- Fecha: 20/10/2026
-- BD:    fayxzvov_erp
--
-- Solo cambia el nombre que se ve en el sidebar. El code ('despacho'), la
-- ruta (despacho.php) y los permisos de cada rol se quedan igual.
--
-- Se puede correr antes o después del código. Idempotente.
-- El -rollback lo regresa a «Despacho».
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET name = 'Surtir'
 WHERE code = 'despacho';

-- VERIFICACIÓN
SELECT id, name, code, route, is_active
  FROM fayxzvov_erp.sections
 WHERE code IN ('ordenes', 'despacho');
