-- =============================================================================
-- Rollback del modulo Catalogo
-- Fecha:     09/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Que hace:  quita lo que agrego 2026-11-09_modulo-catalogo.sql, en orden inverso.
--            No toca los datos del catalogo en fayxzvov_pos.
-- =============================================================================

DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s ON s.id = p.section_id
WHERE s.code = 'catalogo';

DELETE p
FROM permissions p
INNER JOIN sections s ON s.id = p.section_id
WHERE s.code = 'catalogo';

DELETE FROM sections WHERE code = 'catalogo';

DELETE FROM modules WHERE code = 'catalogo';
