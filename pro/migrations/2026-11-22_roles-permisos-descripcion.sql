-- =============================================================================
-- Roles y permisos: qué hace cada permiso + Developer fuera de los roles de empresa
-- Fecha:     22/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback:  2026-11-22_roles-permisos-descripcion-rollback.sql
-- Propuesta: pro/app/configuracion/docs/propuesta-roles-permisos.html (fase F2)
--
-- 1) permissions.description VARCHAR(160) NULL: qué hace ESE permiso en ESA
--    sección. Configuración › Roles lo enseña bajo cada permiso especial, y
--    el de una básica como nota de la sección (cuando abre más de lo que dice
--    su nombre). Root lo escribe en Developer › Accesos › Módulos › sección.
-- 2) Los textos de Pedidos y Ventas. Solo donde todavía no hay texto.
-- 3) Los permisos de Developer que tenga un rol de EMPRESA se borran: Developer
--    es solo de root (Permission::canSee) y no les daban nada. Antes se copian
--    a rollback_20261122_developer_grants para poder regresarlos.
--
-- Se puede volver a correr: no duplica ni pisa textos ya escritos.
-- El orden con el código da igual: sin la columna, el código nuevo trabaja
-- sin descripciones (mdl-developer :: hasPermissionDescription).
-- =============================================================================

SET NAMES utf8mb4;

-- 1) La columna (si no existe).
SET @has := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permissions' AND COLUMN_NAME = 'description'
);
SET @sql := IF(@has = 0,
    'ALTER TABLE permissions ADD COLUMN description VARCHAR(160) NULL AFTER section_id',
    'SELECT ''permissions.description ya existe'' AS aviso');
PREPARE st FROM @sql;
EXECUTE st;
DEALLOCATE PREPARE st;

-- 2) Los textos, por code de sección y de acción (los ids cambian de una base a otra).
UPDATE permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
INNER JOIN (
              SELECT 'pos-pedidos' AS sec, 'ver-bitacora'         AS act, 'Ve quién hizo qué y cuándo en cada pedido.' AS txt
    UNION ALL SELECT 'pos-pedidos', 'ver-capturo-produjo',  'Ve quién capturó y quién produjo cada pedido.'
    UNION ALL SELECT 'pos-pedidos', 'autorizar-descuento',  'Aplica descuentos cuyo motivo pide autorización.'
    UNION ALL SELECT 'pos-pedidos', 'cambiar-forma-pago',   'Corrige la forma de un cobro mientras su turno siga abierto.'
    UNION ALL SELECT 'pos-pedidos', 'ver-corte-z',          'Ve el Corte Z de un día que todavía no se cierra.'
    UNION ALL SELECT 'pos-pedidos', 'editar-corte-cerrado', 'Cambia productos o descuentos de un pendiente cuyo corte ya cerró.'
    UNION ALL SELECT 'pos-pedidos', 'reabrir-turno',        'Reabre un turno cerrado o vuelve a sacar sus totales.'
    UNION ALL SELECT 'pos-pedidos', 'cancel',               'También cancela pedidos que no son cotización, atiende pedidos de otra sucursal, cambia la entrega de un pedido pagado y reenvía avisos de WhatsApp.'
    UNION ALL SELECT 'pos-ventas',  'autorizar-descuento',  'Aplica descuentos cuyo motivo pide autorización.'
    UNION ALL SELECT 'pos-ventas',  'create',               'También cobra saldos pendientes desde Historial y Clientes.'
    UNION ALL SELECT 'pos-ventas',  'update',               'También cambia el cliente de una venta en Historial.'
    UNION ALL SELECT 'pos-ventas',  'cancel',               'También ve todas las ventas en Historial (sin él, solo las suyas del turno abierto) y borra pagos.'
) t ON t.sec = s.code AND t.act = tp.code
SET p.description = t.txt
WHERE p.description IS NULL OR p.description = '';

-- 3) Developer fuera de los roles de empresa: copia y borrado.
CREATE TABLE IF NOT EXISTS rollback_20261122_developer_grants (
    id            INT NOT NULL,
    permission_id INT NULL,
    role_id       INT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO rollback_20261122_developer_grants (id, permission_id, role_id)
SELECT pr.id, pr.permission_id, pr.role_id
FROM permissions_roles pr
INNER JOIN roles r       ON r.id = pr.role_id AND r.company_id IS NOT NULL
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id
INNER JOIN modules m     ON m.id = s.module_id AND m.code = 'developer';

DELETE pr
FROM permissions_roles pr
INNER JOIN rollback_20261122_developer_grants b ON b.id = pr.id;

-- -- Comprobacion --

-- a) Los textos: 12 filas (el catálogo es el mismo para todas las empresas).
SELECT s.code AS seccion, tp.code AS accion, p.description
FROM permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
WHERE p.description IS NOT NULL
ORDER BY s.code, tp.id;

-- b) Roles de empresa con algo de Developer: sin filas.
SELECT r.id, r.name, COUNT(*) AS permisos
FROM permissions_roles pr
INNER JOIN roles r       ON r.id = pr.role_id AND r.company_id IS NOT NULL
INNER JOIN permissions p ON p.id = pr.permission_id
INNER JOIN sections s    ON s.id = p.section_id
INNER JOIN modules m     ON m.id = s.module_id AND m.code = 'developer'
GROUP BY r.id, r.name;
