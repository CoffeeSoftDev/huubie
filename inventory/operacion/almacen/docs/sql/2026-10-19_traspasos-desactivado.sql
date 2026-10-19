-- =====================================================================
-- Traspasos queda desactivado (pedido del usuario, 19/10/2026)
-- BD: fayxzvov_erp
--
-- Apaga la sección: sale del menú y, con el código nuevo, traspasos.php regresa a
-- Inicio y ctrl-traspasos responde 403 a todos (también al Super Admin).
-- En local ya estaba en 0. Se reactiva con el -rollback (o encendiendo la sección).
-- =====================================================================

UPDATE fayxzvov_erp.sections SET is_active = 0 WHERE code = 'traspasos';

-- VERIFICACIÓN
SELECT id, code, name, route, is_active FROM fayxzvov_erp.sections WHERE code = 'traspasos';
