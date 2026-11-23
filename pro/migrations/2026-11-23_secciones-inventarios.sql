-- =============================================================================
-- Inventarios: sus 9 secciones y sus casillas
-- Fecha:     23/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-23_ruta-inventarios.sql (modules.route del modulo)
--            2026-11-22_roles-permisos-descripcion.sql (permissions.description)
-- Rollback:  2026-11-23_secciones-inventarios-rollback.sql
-- Propuesta: pro/app/inventarios/docs/propuesta-roles.html (tablas 02 y 03)
--
-- El modulo `inventarios` (id 3) no tenia secciones: Developer › Accesos no
-- enseñaba nada y Roles no tenia casillas que marcar.
--
-- 1) Tres acciones nuevas: ver-costos (por seccion), aplicar-ajuste (Stock)
--    y producir (Entradas).
-- 2) Las 9 secciones, sueltas (sin submodulo), en el orden del menu de la
--    plantilla. Inicio no es seccion: lo ve todo el que entra al modulo.
--    route = app/inventarios/?vista=<vista>: index.php la pasa a la plantilla.
-- 3) Sus casillas: las de la tabla 03 de la propuesta (la union de los 5 roles).
-- 4) Que hace cada casilla en ESA seccion (permissions.description).
--
-- NO asigna roles: el Dueño y root las ven todas sin filas. OJO: un modulo con
-- secciones solo sale en el inicio a quien tenga alguna concedida
-- (Permission::modules), asi que los demas roles dejan de ver Inventarios
-- hasta que se les marque en Accesos › Roles.
--
-- Solo filas de datos. Busca por code: se puede volver a correr.
-- =============================================================================

SET NAMES utf8mb4;

-- 1) Las acciones (si no existen). order NULL: van despues de Imprimir.
INSERT INTO type_permissions (name, code, `order`, created_at, is_active)
SELECT t.name, t.code, NULL, NOW(), 1
FROM (
              SELECT 'Ver costos'     AS name, 'ver-costos'     AS code
    UNION ALL SELECT 'Aplicar ajuste',         'aplicar-ajuste'
    UNION ALL SELECT 'Producir',               'producir'
) t
WHERE NOT EXISTS (SELECT 1 FROM type_permissions x WHERE x.code = t.code);

-- 2) Las secciones.
INSERT INTO sections (name, code, icon, route, orden, module_id, submodule_id, is_active, created_at)
SELECT t.name, t.code, t.icon, t.route, t.orden, m.id, NULL, 1, NOW()
FROM (
              SELECT 'Stock'         AS name, 'inv-stock'         AS code, 'boxes'              AS icon, 'app/inventarios/?vista=stock'         AS route, 1 AS orden
    UNION ALL SELECT 'Entradas',              'inv-entradas',              'arrow-down-to-line',          'app/inventarios/?vista=entradas',               2
    UNION ALL SELECT 'Salidas',               'inv-salidas',               'arrow-up-from-line',          'app/inventarios/?vista=salidas',                3
    UNION ALL SELECT 'Traspasos',             'inv-traspasos',             'arrow-right-left',            'app/inventarios/?vista=traspasos',              4
    UNION ALL SELECT 'Requisiciones',         'inv-requisiciones',         'clipboard-list',              'app/inventarios/?vista=requisiciones',          5
    UNION ALL SELECT 'Surtir',                'inv-surtir',                'truck',                       'app/inventarios/?vista=surtir',                 6
    UNION ALL SELECT 'Kárdex',                'inv-kardex',                'history',                     'app/inventarios/?vista=movimientos',            7
    UNION ALL SELECT 'Reportes',              'inv-reportes',              'file-chart-column',           'app/inventarios/?vista=reportes',               8
    UNION ALL SELECT 'Catálogo',              'inv-catalogo',              'package',                     'app/inventarios/?vista=catalogo',               9
) t
INNER JOIN modules m ON m.code = 'inventarios'
WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.code = t.code);

-- 3) Las casillas de cada seccion.
INSERT INTO permissions (type_permission_id, section_id, is_active, created_at)
SELECT tp.id, s.id, 1, NOW()
FROM (
              SELECT 'inv-stock' AS sec, 'show' AS act
    UNION ALL SELECT 'inv-stock',         'update'
    UNION ALL SELECT 'inv-stock',         'cancel'
    UNION ALL SELECT 'inv-stock',         'print'
    UNION ALL SELECT 'inv-stock',         'ver-costos'
    UNION ALL SELECT 'inv-stock',         'aplicar-ajuste'
    UNION ALL SELECT 'inv-entradas',      'show'
    UNION ALL SELECT 'inv-entradas',      'create'
    UNION ALL SELECT 'inv-entradas',      'producir'
    UNION ALL SELECT 'inv-entradas',      'update'
    UNION ALL SELECT 'inv-entradas',      'cancel'
    UNION ALL SELECT 'inv-entradas',      'print'
    UNION ALL SELECT 'inv-entradas',      'ver-costos'
    UNION ALL SELECT 'inv-salidas',       'show'
    UNION ALL SELECT 'inv-salidas',       'create'
    UNION ALL SELECT 'inv-salidas',       'cancel'
    UNION ALL SELECT 'inv-salidas',       'print'
    UNION ALL SELECT 'inv-salidas',       'ver-costos'
    UNION ALL SELECT 'inv-traspasos',     'show'
    UNION ALL SELECT 'inv-traspasos',     'create'
    UNION ALL SELECT 'inv-traspasos',     'update'
    UNION ALL SELECT 'inv-traspasos',     'cancel'
    UNION ALL SELECT 'inv-traspasos',     'print'
    UNION ALL SELECT 'inv-traspasos',     'ver-costos'
    UNION ALL SELECT 'inv-requisiciones', 'show'
    UNION ALL SELECT 'inv-requisiciones', 'create'
    UNION ALL SELECT 'inv-requisiciones', 'update'
    UNION ALL SELECT 'inv-requisiciones', 'cancel'
    UNION ALL SELECT 'inv-requisiciones', 'print'
    UNION ALL SELECT 'inv-requisiciones', 'ver-costos'
    UNION ALL SELECT 'inv-surtir',        'show'
    UNION ALL SELECT 'inv-surtir',        'update'
    UNION ALL SELECT 'inv-surtir',        'cancel'
    UNION ALL SELECT 'inv-surtir',        'print'
    UNION ALL SELECT 'inv-surtir',        'ver-costos'
    UNION ALL SELECT 'inv-kardex',        'show'
    UNION ALL SELECT 'inv-kardex',        'print'
    UNION ALL SELECT 'inv-kardex',        'ver-costos'
    UNION ALL SELECT 'inv-reportes',      'show'
    UNION ALL SELECT 'inv-reportes',      'print'
    UNION ALL SELECT 'inv-reportes',      'ver-costos'
    UNION ALL SELECT 'inv-catalogo',      'show'
    UNION ALL SELECT 'inv-catalogo',      'create'
    UNION ALL SELECT 'inv-catalogo',      'update'
    UNION ALL SELECT 'inv-catalogo',      'delete'
    UNION ALL SELECT 'inv-catalogo',      'ver-costos'
) t
INNER JOIN sections s          ON s.code = t.sec
INNER JOIN type_permissions tp ON tp.code = t.act
WHERE NOT EXISTS (
    SELECT 1 FROM permissions p
    WHERE p.section_id = s.id AND p.type_permission_id = tp.id
);

-- 4) Que hace cada casilla aqui. Solo donde todavia no hay texto.
UPDATE permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
INNER JOIN (
              SELECT 'inv-stock' AS sec, 'update' AS act, 'Abre y captura un conteo físico.' AS txt
    UNION ALL SELECT 'inv-stock',         'cancel',         'Revierte un ajuste ya aplicado, hasta 48 h después.'
    UNION ALL SELECT 'inv-stock',         'aplicar-ajuste', 'Aplica el conteo y mueve la existencia. Sin ella cuenta a ciegas y el conteo queda en borrador.'
    UNION ALL SELECT 'inv-stock',         'ver-costos',     'Ve costo y valor del inventario. Sin ella, las tarjetas de dinero se cambian por conteos.'
    UNION ALL SELECT 'inv-entradas',      'create',         'Captura compras, devoluciones y notas.'
    UNION ALL SELECT 'inv-entradas',      'producir',       'Registra la producción del día.'
    UNION ALL SELECT 'inv-entradas',      'update',         'Confirma la producción y edita entradas.'
    UNION ALL SELECT 'inv-entradas',      'cancel',         'Cancela una entrada aplicada (pide contraseña).'
    UNION ALL SELECT 'inv-entradas',      'ver-costos',     'Ve el costo de lo que entra y el importe de cada entrada.'
    UNION ALL SELECT 'inv-salidas',       'create',         'Registra consumo y mermas.'
    UNION ALL SELECT 'inv-salidas',       'cancel',         'Cancela una salida (pide contraseña).'
    UNION ALL SELECT 'inv-salidas',       'ver-costos',     'Ve el importe de lo que sale y de las mermas.'
    UNION ALL SELECT 'inv-traspasos',     'update',         'Confirma la recepción o la rechaza.'
    UNION ALL SELECT 'inv-traspasos',     'cancel',         'Cancela un traspaso enviado que todavía no reciben.'
    UNION ALL SELECT 'inv-traspasos',     'ver-costos',     'Ve el importe de cada traspaso.'
    UNION ALL SELECT 'inv-requisiciones', 'update',         'Corrige el borrador y da «Recibí».'
    UNION ALL SELECT 'inv-requisiciones', 'cancel',         'Cancela la suya mientras nadie la surta.'
    UNION ALL SELECT 'inv-requisiciones', 'ver-costos',     'Ve el importe estimado de lo que se pide.'
    UNION ALL SELECT 'inv-surtir',        'update',         'Surte: descuenta de la Matriz y entra a quien pidió.'
    UNION ALL SELECT 'inv-surtir',        'cancel',         'Rechaza la requisición.'
    UNION ALL SELECT 'inv-surtir',        'ver-costos',     'Ve el importe de lo que se surte.'
    UNION ALL SELECT 'inv-kardex',        'ver-costos',     'Ve pesos en el kárdex. Sin ella cuenta renglones.'
    UNION ALL SELECT 'inv-reportes',      'print',          'Imprime y descarga Excel.'
    UNION ALL SELECT 'inv-reportes',      'ver-costos',     'Ve los reportes con costos y valores.'
    UNION ALL SELECT 'inv-catalogo',      'delete',         'Desactiva artículos (nunca se borran). Una unidad en uso no se desactiva.'
    UNION ALL SELECT 'inv-catalogo',      'ver-costos',     'Ve el último costo de cada artículo.'
) t ON t.sec = s.code AND t.act = tp.code
SET p.description = t.txt
WHERE p.description IS NULL OR p.description = '';

-- -- Comprobacion --

-- a) Las 9 secciones en orden.
SELECT s.orden, s.code, s.name, s.icon, s.route
FROM sections s
INNER JOIN modules m ON m.id = s.module_id AND m.code = 'inventarios'
ORDER BY s.orden, s.id;

-- b) Casillas por seccion: 6, 7, 5, 6, 6, 5, 3, 3, 5 (46 en total).
SELECT s.code, COUNT(*) AS casillas, GROUP_CONCAT(tp.code ORDER BY tp.id) AS acciones
FROM permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN modules m           ON m.id = s.module_id AND m.code = 'inventarios'
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
GROUP BY s.id, s.code
ORDER BY s.orden;
