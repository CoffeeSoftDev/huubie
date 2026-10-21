-- =====================================================================
-- Catálogo › Estados requisición: el color de cada estado
-- Fecha: 21/10/2026
-- BD:    fayxzvov_inventory (y lee fayxzvov_erp.companies)
--
-- requisition_status   un renglón por estado de la requisición y por
--                      empresa, como transfer_status. Los códigos son
--                      fijos (los usa ctrl-ordenes: estadoRequisicion);
--                      en el Catálogo solo se cambian el ícono (Lucide),
--                      color_hex (texto) y bg_hex (fondo), como en
--                      Motivos de salida. color_hex/bg_hex NULL = el
--                      color del tema (así nace Entregado).
--
-- Filas con companies_id NULL = PLANTILLA: no se listan; se copian a cada
-- empresa (aquí y en el Admin del Tenant: qSeedInventoryCatalogs).
--
-- Arranca con los colores que tenían fijos en el código, así nada cambia
-- de color al correrla. Sin la tabla, Requisiciones y Surtir siguen con
-- esos mismos colores; el Catálogo sí la necesita (pestaña Estados
-- requisición).
--
-- Idempotente. El -rollback borra la tabla.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_inventory.requisition_status (
    id           INT(11)     NOT NULL AUTO_INCREMENT,
    code         VARCHAR(30) NOT NULL COMMENT 'Fijo: lo usa ctrl-ordenes (estadoRequisicion)',
    name         VARCHAR(80) NOT NULL,
    order_index  INT(11)     NOT NULL DEFAULT 0,
    icon         VARCHAR(40) NULL     COMMENT 'Ícono Lucide de la etiqueta',
    color_hex    VARCHAR(9)  NULL     COMMENT 'Texto; NULL = color del tema',
    bg_hex       VARCHAR(9)  NULL     COMMENT 'Fondo; NULL = color del tema',
    created_at   DATETIME    DEFAULT CURRENT_TIMESTAMP,
    active       TINYINT(4)  NOT NULL DEFAULT 1,
    companies_id INT(11)     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_requisition_status_company_code (companies_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- 1. Plantilla (companies_id NULL), solo si no está.
INSERT INTO fayxzvov_inventory.requisition_status (code, name, order_index, icon, color_hex, bg_hex, companies_id)
SELECT s.code, s.name, s.order_index, s.icon, s.color_hex, s.bg_hex, NULL
FROM (
    SELECT 'BORRADOR'        AS code, 'Borrador'             AS name, 1 AS order_index, 'pencil'        AS icon, '#475569' AS color_hex, '#F1F5F9' AS bg_hex UNION ALL
    SELECT 'EN_ESPERA',               'En espera',                    2,                'clock',                '#D97706',              '#FEF3C7'           UNION ALL
    SELECT 'SURTIDO_PARCIAL',         'Surtido parcialmente',         3,                'package-minus',        '#EA580C',              '#FFEDD5'           UNION ALL
    SELECT 'ENTREGADO',               'Entregado',                    4,                'truck',                NULL,                   NULL                UNION ALL
    SELECT 'CONFIRMADO',              'Confirmado',                   5,                'circle-check',         '#16A34A',              '#DCFCE7'           UNION ALL
    SELECT 'RECHAZADA',               'Rechazada',                    6,                'circle-x',             '#DC2626',              '#FEE2E2'           UNION ALL
    SELECT 'CANCELADA',               'Cancelada',                    7,                'ban',                  '#DC2626',              '#FEE2E2'
) s
-- CONVERT: la tabla es latin1 y los literales llegan en el charset de la conexión
-- (utf8mb4 en phpMyAdmin): sin él, «Illegal mix of collations».
WHERE NOT EXISTS (
    SELECT 1 FROM fayxzvov_inventory.requisition_status x WHERE x.companies_id IS NULL AND x.code = CONVERT(s.code USING latin1)
);

-- 2. Copia a cada empresa que aún no los tiene.
INSERT INTO fayxzvov_inventory.requisition_status (code, name, order_index, icon, color_hex, bg_hex, active, companies_id)
SELECT t.code, t.name, t.order_index, t.icon, t.color_hex, t.bg_hex, t.active, c.id
FROM fayxzvov_inventory.requisition_status t
CROSS JOIN fayxzvov_erp.companies c
WHERE t.companies_id IS NULL
AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.requisition_status x WHERE x.companies_id = c.id);

-- VERIFICACIÓN: 7 por empresa + 7 de plantilla.
SELECT companies_id, COUNT(*) AS estados FROM fayxzvov_inventory.requisition_status GROUP BY companies_id;
