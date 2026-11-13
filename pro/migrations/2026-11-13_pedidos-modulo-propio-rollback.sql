-- =============================================================================
-- Rollback de 2026-11-13_pedidos-modulo-propio.sql
-- Fecha:  13/11/2026
-- TPV, Reportes y Catalogo regresan a POS con sus secciones, el modulo Pedidos se
-- queda sin ruta y se quitan los permisos que dio la migra:
--   Cajera de CoffeeSoft   todos los del modulo (antes no tenia ninguno)
--   Dueño del sistema      todos menos `catalogo`, que ya tenia antes
-- Los de Reginas no se tocan: ya estaban antes.
-- Va ANTES de mover las secciones: los DELETE las buscan en el modulo Pedidos.
-- =============================================================================

-- 1) Permisos de la Cajera de CoffeeSoft.
DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id
INNER JOIN modules m     ON m.id = s.module_id AND m.code = 'pedidos'
INNER JOIN roles r       ON r.id = pr.role_id AND r.name = 'Cajera'
INNER JOIN companies c   ON c.id = r.company_id AND c.name = 'CoffeeSoft';

-- 2) Permisos del Dueño del sistema, menos los de catalogo.
DELETE pr
FROM permissions_roles pr
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id AND s.code <> 'catalogo'
INNER JOIN modules m     ON m.id = s.module_id AND m.code = 'pedidos'
INNER JOIN roles r       ON r.id = pr.role_id AND r.code = 'owner' AND r.is_system = 1;

-- 3) Los submodulos regresan a POS.
UPDATE submodules sm
INNER JOIN modules m ON m.code = 'pos'
SET sm.module_id = m.id
WHERE sm.code IN ('pos-tpv', 'pos-reportes', 'pos-catalogo');

-- 4) Y sus secciones con ellos.
UPDATE sections s
INNER JOIN submodules sm ON sm.id = s.submodule_id
SET s.module_id = sm.module_id
WHERE sm.code IN ('pos-tpv', 'pos-reportes', 'pos-catalogo');

-- 5) El modulo Pedidos sin ruta.
UPDATE modules SET route = NULL WHERE code = 'pedidos';
