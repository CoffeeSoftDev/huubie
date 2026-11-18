-- =============================================================================
-- Rollback de 2026-11-18_lealtad-programa.sql
-- Fecha:  18/11/2026
-- Quita la seccion Lealtad › Programa con sus permisos y lo que se dio a los
-- roles. Lealtad queda solo con Tarjetas.
--
-- Ojo: el codigo nuevo ya no trae la pestaña «Programa» en Tarjetas. Tras
-- este rollback, revertir tambien tarjetas.js (la pestaña) o el programa no
-- se ve en ningun lado.
-- =============================================================================

DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id
WHERE s.code = 'lealtad-programa';

DELETE p
FROM permissions p
INNER JOIN sections s ON s.id = p.section_id
WHERE s.code = 'lealtad-programa';

DELETE FROM sections WHERE code = 'lealtad-programa';
