-- =====================================================================
-- Catálogo: orígenes de entrada, motivos de salida y estados de traspaso por empresa
-- Fecha: 18/10/2026
-- BD:    fayxzvov_inventory (lee fayxzvov_erp.companies)
--
-- ANTES
--   inflow_origin, shrinkage_reason y transfer_status no tenían companies_id.
--   Lo que una empresa cambiaba en Catálogo > Origen entradas, Motivos de salida
--   o Estados de traspaso (nombre, color, activo, orden, altas y bajas) lo veía
--   y lo usaba la otra: Café Ligero trabajaba sobre los de Reginas.
--
-- DESPUÉS
--   1. Las filas que ya existen quedan como PLANTILLA (companies_id NULL).
--      Ninguna pantalla las lista. De ahí sale la copia de cada empresa nueva
--      (Admin del Tenant > Nueva empresa, mdl-tenant::qSeedInventoryCatalogs).
--   2. Cada empresa de fayxzvov_erp.companies recibe su copia, con los mismos
--      code, nombres, colores, orden y activo que tenía.
--   3. Las entradas, salidas y traspasos de cada empresa pasan a apuntar a su
--      copia. template_id es temporal: liga cada copia con su plantilla y se
--      quita al final.
--   4. transfer_status.code deja de ser único global: ahora (companies_id, code).
--
-- Los code (COMPRA, COMPRA_SP, SURTIDO_SUC, REQUESTED, RECEIVED, REJECTED...) los
-- busca el código dentro de la empresa de la sesión: cada copia los conserva.
--
-- CORRER ANTES de subir el código: las consultas filtran por companies_id y sin
-- la columna fallan Catálogo, Entradas, Salidas, Traspasos, Compras y Pedidos.
-- NO se puede volver a correr (ADD COLUMN). El -rollback lo deshace.
-- =====================================================================

-- 1) Columnas -----------------------------------------------------------

ALTER TABLE fayxzvov_inventory.inflow_origin
    ADD COLUMN companies_id INT NULL AFTER active,
    ADD COLUMN template_id INT NULL,
    ADD KEY idx_inflow_origin_company (companies_id);

ALTER TABLE fayxzvov_inventory.shrinkage_reason
    ADD COLUMN companies_id INT NULL AFTER active,
    ADD COLUMN template_id INT NULL,
    ADD KEY idx_shrinkage_reason_company (companies_id);

ALTER TABLE fayxzvov_inventory.transfer_status
    ADD COLUMN companies_id INT NULL AFTER active,
    ADD COLUMN template_id INT NULL,
    DROP INDEX uk_transfer_status_code,
    ADD UNIQUE KEY uk_transfer_status_company_code (companies_id, code);

-- 2) Una copia de la plantilla por empresa -------------------------------

INSERT INTO fayxzvov_inventory.inflow_origin
    (code, name, description, icon, color_hex, bg_hex, requires_supplier, sort_order, active, companies_id, template_id)
SELECT t.code, t.name, t.description, t.icon, t.color_hex, t.bg_hex, t.requires_supplier, t.sort_order, t.active, c.id, t.id
FROM fayxzvov_inventory.inflow_origin t
CROSS JOIN fayxzvov_erp.companies c
WHERE t.companies_id IS NULL
ORDER BY c.id, t.id;

INSERT INTO fayxzvov_inventory.shrinkage_reason
    (code, name, icon, color_hex, bg_hex, sort_order, active, companies_id, template_id)
SELECT t.code, t.name, t.icon, t.color_hex, t.bg_hex, t.sort_order, t.active, c.id, t.id
FROM fayxzvov_inventory.shrinkage_reason t
CROSS JOIN fayxzvov_erp.companies c
WHERE t.companies_id IS NULL
ORDER BY c.id, t.id;

INSERT INTO fayxzvov_inventory.transfer_status
    (code, name, name_out, name_in, order_index, is_terminal, color_hex, bg_hex, active, companies_id, template_id)
SELECT t.code, t.name, t.name_out, t.name_in, t.order_index, t.is_terminal, t.color_hex, t.bg_hex, t.active, c.id, t.id
FROM fayxzvov_inventory.transfer_status t
CROSS JOIN fayxzvov_erp.companies c
WHERE t.companies_id IS NULL
ORDER BY c.id, t.id;

-- 3) Los movimientos de cada empresa apuntan a su copia ---------------------

UPDATE fayxzvov_inventory.inventory_inflow f
INNER JOIN fayxzvov_inventory.inflow_origin c
    ON c.template_id = f.inflow_origin_id
   AND c.companies_id = f.companies_id
SET f.inflow_origin_id = c.id;

UPDATE fayxzvov_inventory.inventory_shrinkage s
INNER JOIN fayxzvov_inventory.shrinkage_reason c
    ON c.template_id = s.shrinkage_reason_id
   AND c.companies_id = s.companies_id
SET s.shrinkage_reason_id = c.id;

UPDATE fayxzvov_inventory.inventory_transfer_history h
INNER JOIN fayxzvov_inventory.inventory_transfer t ON t.id = h.inventory_transfer_id
INNER JOIN fayxzvov_inventory.transfer_status c
    ON c.template_id = h.status_id
   AND c.companies_id = t.companies_id
SET h.status_id = c.id;

UPDATE fayxzvov_inventory.inventory_transfer t
INNER JOIN fayxzvov_inventory.transfer_status c
    ON c.template_id = t.status_id
   AND c.companies_id = t.companies_id
SET t.status_id = c.id;

-- 4) La liga temporal se va -----------------------------------------------

ALTER TABLE fayxzvov_inventory.inflow_origin    DROP COLUMN template_id;
ALTER TABLE fayxzvov_inventory.shrinkage_reason DROP COLUMN template_id;
ALTER TABLE fayxzvov_inventory.transfer_status  DROP COLUMN template_id;

-- VERIFICACIÓN ------------------------------------------------------------

-- Filas por empresa (NULL = plantilla).
SELECT 'inflow_origin' AS tabla, companies_id, COUNT(*) AS filas FROM fayxzvov_inventory.inflow_origin GROUP BY companies_id
UNION ALL
SELECT 'shrinkage_reason', companies_id, COUNT(*) FROM fayxzvov_inventory.shrinkage_reason GROUP BY companies_id
UNION ALL
SELECT 'transfer_status', companies_id, COUNT(*) FROM fayxzvov_inventory.transfer_status GROUP BY companies_id;

-- Movimientos que siguen en la plantilla o en otra empresa: debe salir 0 en todo.
SELECT
    (SELECT COUNT(*) FROM fayxzvov_inventory.inventory_inflow f
        JOIN fayxzvov_inventory.inflow_origin o ON o.id = f.inflow_origin_id
        WHERE o.companies_id IS NULL OR o.companies_id <> f.companies_id) AS entradas,
    (SELECT COUNT(*) FROM fayxzvov_inventory.inventory_shrinkage s
        JOIN fayxzvov_inventory.shrinkage_reason r ON r.id = s.shrinkage_reason_id
        WHERE r.companies_id IS NULL OR r.companies_id <> s.companies_id) AS salidas,
    (SELECT COUNT(*) FROM fayxzvov_inventory.inventory_transfer t
        JOIN fayxzvov_inventory.transfer_status st ON st.id = t.status_id
        WHERE st.companies_id IS NULL OR st.companies_id <> t.companies_id) AS traspasos;
