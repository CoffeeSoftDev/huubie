-- =============================================================================
-- Inventarios R2 (editar entradas y salidas) y R3 (Dashboard y Kárdex)
-- Fecha:     29/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app) y fayxzvov_inventarios
-- Requiere:  2026-11-23_secciones-inventarios.sql (secciones y casillas)
--            2026-11-28_catalogo-de-insumos.sql
-- Rollback:  2026-11-29_inventarios-r2-r3-rollback.sql
--
-- 1) Salidas: quién y cuándo editó (Entradas ya lo tenía).
-- 2) Salidas: la casilla «Editar» (update). Pide contraseña, como cancelar.
-- 3) Kárdex: se enciende en el menú (la página ya estaba).
-- 4) Dashboard: sección nueva, la primera del menú: al entrar a Inventarios
--    se abre ella. Casillas show y ver-costos.
--
-- NO asigna roles: el Dueño y root ven todo sin filas. Los demás roles no ven
-- el Dashboard ni editan salidas hasta que se les marque en Accesos › Roles.
--
-- Orden en prod: ANTES del código (updateSalida escribe edited_at).
-- Los INSERT y UPDATE van por code: se pueden volver a correr. El ALTER no.
-- =============================================================================

SET NAMES utf8mb4;

-- 1) Quién editó la salida.
ALTER TABLE fayxzvov_inventarios.inventory_outflow
  ADD COLUMN `edited_user_id` INT NULL DEFAULT NULL COMMENT 'quién la editó por última vez' AFTER `cancel_reason`,
  ADD COLUMN `edited_at`      DATETIME NULL DEFAULT NULL AFTER `edited_user_id`;

-- 2) y 4) Las casillas nuevas.
INSERT INTO sections (name, code, icon, route, orden, module_id, submodule_id, is_active, created_at)
SELECT 'Dashboard', 'inv-dashboard', 'layout-dashboard', 'app/inventarios/dashboard.php', 0, m.id, NULL, 1, NOW()
FROM modules m
WHERE m.code = 'inventarios'
  AND NOT EXISTS (SELECT 1 FROM sections s WHERE s.code = 'inv-dashboard');

INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM (
              SELECT 'inv-salidas' AS sec, 'update' AS act
    UNION ALL SELECT 'inv-dashboard',      'show'
    UNION ALL SELECT 'inv-dashboard',      'ver-costos'
) t
INNER JOIN sections s          ON s.code = t.sec
INNER JOIN type_permissions tp ON tp.code = t.act
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.section_id = s.id AND p.type_permission_id = tp.id
);

UPDATE permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
INNER JOIN (
              SELECT 'inv-salidas' AS sec, 'update' AS act, 'Edita una salida: motivo, almacén, fecha y productos (pide contraseña).' AS txt
    UNION ALL SELECT 'inv-dashboard',      'ver-costos',    'Ve el valor del inventario y el costo de cada movimiento.'
) t ON t.sec = s.code AND t.act = tp.code
SET p.description = t.txt
WHERE p.description IS NULL OR p.description = '';

-- 3) Kárdex en el menú.
UPDATE sections SET is_active = 1 WHERE code = 'inv-kardex';

-- -- Comprobación --

SELECT s.orden, s.code, s.name, s.route, s.is_active,
       GROUP_CONCAT(tp.code ORDER BY tp.id) AS casillas
FROM sections s
INNER JOIN modules m             ON m.id = s.module_id AND m.code = 'inventarios'
LEFT JOIN permissions p          ON p.section_id = s.id
LEFT JOIN type_permissions tp    ON tp.id = p.type_permission_id
GROUP BY s.id, s.orden, s.code, s.name, s.route, s.is_active
ORDER BY s.orden, s.id;

SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'fayxzvov_inventarios'
  AND TABLE_NAME = 'inventory_outflow'
  AND COLUMN_NAME IN ('edited_user_id', 'edited_at');
