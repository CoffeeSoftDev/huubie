-- =====================================================================
-- Requisiciones: el departamento que pide (Producción, Pastelería...)
-- Fecha: 28/10/2026
-- BD:    fayxzvov_inventory (y lee fayxzvov_erp.companies)
--
-- department                     catálogo por empresa de los departamentos
--                                de la empresa: QUIÉN pide y usa el material.
--                                No es el área de almacén (warehouse_area:
--                                Anaquel 1, Refrigerador = DÓNDE se guarda).
--                                icon (Lucide), color_hex (texto) y bg_hex
--                                (fondo) para su etiqueta, como Motivos de
--                                salida.
-- purchase_order.department_id   departamento de la requisición (OC-). NULL
--                                en las de antes, en los reabastos (REAB-) y
--                                en las compras (CP-).
--
-- Filas con companies_id NULL = PLANTILLA: no se listan; se copian a cada
-- empresa (aquí y en el Admin del Tenant: qSeedInventoryCatalogs).
--
-- utf8mb4 y no latin1 como las demás: los nombres llevan acentos y la
-- tabla no se compara por texto con ninguna otra.
--
-- CORRER ANTES de subir el código: Requisiciones y Surtir leen la tabla y
-- la columna en la lista, el detalle y al guardar; sin ellas no cargan.
--
-- Idempotente. El -rollback quita la columna y la tabla.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_inventory.department (
    id           INT(11)     NOT NULL AUTO_INCREMENT,
    name         VARCHAR(80) NOT NULL,
    icon         VARCHAR(40) NULL     COMMENT 'Ícono Lucide de la etiqueta',
    color_hex    VARCHAR(9)  NULL     COMMENT 'Texto de la etiqueta',
    bg_hex       VARCHAR(9)  NULL     COMMENT 'Fondo de la etiqueta',
    sort_order   INT(11)     NOT NULL DEFAULT 0,
    created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
    active       TINYINT(4)  NOT NULL DEFAULT 1,
    companies_id INT(11)     NULL     COMMENT 'NULL = plantilla',
    PRIMARY KEY (id),
    UNIQUE KEY uk_department_company_name (companies_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 1. Plantilla (companies_id NULL), solo si no está.
INSERT INTO fayxzvov_inventory.department (name, icon, color_hex, bg_hex, sort_order, companies_id)
SELECT s.name, s.icon, s.color_hex, s.bg_hex, s.sort_order, NULL
FROM (
    SELECT 'Producción' AS name, 'factory'        AS icon, '#7C3AED' AS color_hex, '#EDE9FE' AS bg_hex, 1 AS sort_order UNION ALL
    SELECT 'Panadería',          'croissant',              '#B45309',              '#FEF3C7',           2               UNION ALL
    SELECT 'Batidos',            'cup-soda',               '#0891B2',              '#CFFAFE',           3               UNION ALL
    SELECT 'Pastelería',         'cake',                   '#DB2777',              '#FCE7F3',           4               UNION ALL
    SELECT 'Postres',            'ice-cream-cone',         '#EA580C',              '#FFEDD5',           5               UNION ALL
    SELECT 'Limpieza',           'spray-can',              '#16A34A',              '#DCFCE7',           6
) s
WHERE NOT EXISTS (
    SELECT 1 FROM fayxzvov_inventory.department x WHERE x.companies_id IS NULL AND x.name = s.name
);

-- 2. Copia a cada empresa que aún no los tiene.
INSERT INTO fayxzvov_inventory.department (name, icon, color_hex, bg_hex, sort_order, active, companies_id)
SELECT t.name, t.icon, t.color_hex, t.bg_hex, t.sort_order, t.active, c.id
FROM fayxzvov_inventory.department t
CROSS JOIN fayxzvov_erp.companies c
WHERE t.companies_id IS NULL
AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.department x WHERE x.companies_id = c.id);

-- 3. La columna de la requisición (MySQL 5.7 no tiene ADD COLUMN IF NOT EXISTS).
SET @existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory' AND TABLE_NAME = 'purchase_order' AND COLUMN_NAME = 'department_id'
);
SET @sql := IF(@existe = 0,
    'ALTER TABLE fayxzvov_inventory.purchase_order
         ADD COLUMN department_id INT(11) NULL DEFAULT NULL COMMENT ''Departamento que pide (department)'' AFTER destination_branch_id,
         ADD KEY idx_purchase_order_department (department_id)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- VERIFICACIÓN: 6 por empresa + 6 de plantilla, y la columna.
SELECT companies_id, COUNT(*) AS departamentos FROM fayxzvov_inventory.department GROUP BY companies_id;
SHOW COLUMNS FROM fayxzvov_inventory.purchase_order LIKE 'department_id';
