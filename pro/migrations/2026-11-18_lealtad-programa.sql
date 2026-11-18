-- =============================================================================
-- Lealtad › Programa: la pestaña «Programa» de Tarjetas pasa a ser su propia
-- seccion del modulo Lealtad
-- Fecha:     18/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-15_lealtad-modulo-propio.sql (Lealtad con Tarjetas)
--            app/lealtad/programa.php, src/js/programa.js y ctrl/ctrl-programa.php
--            ya subidos (y tarjetas.js / ctrl-tarjetas.php del mismo dia)
-- Rollback:  2026-11-18_lealtad-programa-rollback.sql
--
-- Antes:   Lealtad: Tarjetas 1 (con las pestañas Tipos, Tarjetas y Programa)
-- Despues: Lealtad: Tarjetas 1, Programa 2 (sueltas, sin submodulo)
--
-- Permisos: show y update (Programa no crea nada). Cada rol que hoy tiene
-- show o update en Tarjetas (pos-puntos) recibe el mismo en Programa: nadie
-- pierde lo que ya veia. El Dueño (owner) los tiene todos sin filas.
--
-- Solo filas de datos. Busca por code: se puede volver a correr.
-- =============================================================================

-- 1) La seccion, en Lealtad, despues de Tarjetas.
INSERT INTO sections (name, code, icon, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Programa', 'lealtad-programa', 'sparkles', 'app/lealtad/programa.php', 2, m.id, NULL, 1, NOW()
FROM modules m
WHERE m.code = 'lealtad'
  AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.code = 'lealtad-programa');

-- 2) Sus permisos: ver y cambiar.
INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM sections s
INNER JOIN type_permissions tp ON tp.code IN ('show', 'update')
WHERE s.code = 'lealtad-programa'
  AND NOT EXISTS (
      SELECT 1 FROM permissions p
      WHERE p.section_id = s.id AND p.type_permission_id = tp.id
  );

-- 3) Los mismos roles que hoy tienen show / update en Tarjetas.
INSERT INTO permissions_roles (permission_id, role_id)
SELECT pn.id, pr.role_id
FROM sections so
INNER JOIN permissions po       ON po.section_id = so.id
INNER JOIN permissions_roles pr ON pr.permission_id = po.id
INNER JOIN sections sn          ON sn.code = 'lealtad-programa'
INNER JOIN permissions pn       ON pn.section_id = sn.id AND pn.type_permission_id = po.type_permission_id
INNER JOIN type_permissions tp  ON tp.id = po.type_permission_id AND tp.code IN ('show', 'update')
WHERE so.code = 'pos-puntos'
  AND NOT EXISTS (
      SELECT 1 FROM permissions_roles x
      WHERE x.permission_id = pn.id AND x.role_id = pr.role_id
  );

-- Comprobacion: Lealtad en orden y quien tiene Programa.
SELECT s.orden, s.code, s.name, s.route, s.icon
FROM sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'lealtad'
ORDER BY s.orden, s.id;

SELECT r.id AS role_id, r.name AS role, tp.code AS permiso
FROM permissions_roles pr
INNER JOIN permissions p       ON p.id = pr.permission_id
INNER JOIN sections s          ON s.id = p.section_id AND s.code = 'lealtad-programa'
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
INNER JOIN roles r             ON r.id = pr.role_id
ORDER BY r.id, tp.id;
