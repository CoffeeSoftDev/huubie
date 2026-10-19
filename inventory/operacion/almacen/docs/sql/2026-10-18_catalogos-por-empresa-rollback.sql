-- =====================================================================
-- ROLLBACK de 2026-10-18_catalogos-por-empresa.sql
-- Vuelve a dejar orígenes, motivos y estados de traspaso como catálogos de
-- todas las empresas. Correr con el código anterior ya subido.
--
-- 1. Los movimientos regresan a la fila de la plantilla con el mismo code.
-- 2. Las copias que tienen plantilla se borran.
-- 3. Lo que una empresa dio de alta por su cuenta (sin plantilla) se queda,
--    ya como global.
-- =====================================================================

-- 1) Movimientos de vuelta a la plantilla ----------------------------------

UPDATE fayxzvov_inventory.inventory_inflow f
INNER JOIN fayxzvov_inventory.inflow_origin c ON c.id = f.inflow_origin_id AND c.companies_id IS NOT NULL
INNER JOIN fayxzvov_inventory.inflow_origin t ON t.companies_id IS NULL AND t.code = c.code
SET f.inflow_origin_id = t.id;

UPDATE fayxzvov_inventory.inventory_shrinkage s
INNER JOIN fayxzvov_inventory.shrinkage_reason c ON c.id = s.shrinkage_reason_id AND c.companies_id IS NOT NULL
INNER JOIN fayxzvov_inventory.shrinkage_reason t ON t.companies_id IS NULL AND t.code = c.code
SET s.shrinkage_reason_id = t.id;

UPDATE fayxzvov_inventory.inventory_transfer_history h
INNER JOIN fayxzvov_inventory.transfer_status c ON c.id = h.status_id AND c.companies_id IS NOT NULL
INNER JOIN fayxzvov_inventory.transfer_status t ON t.companies_id IS NULL AND t.code = c.code
SET h.status_id = t.id;

UPDATE fayxzvov_inventory.inventory_transfer x
INNER JOIN fayxzvov_inventory.transfer_status c ON c.id = x.status_id AND c.companies_id IS NOT NULL
INNER JOIN fayxzvov_inventory.transfer_status t ON t.companies_id IS NULL AND t.code = c.code
SET x.status_id = t.id;

-- 2) Copias con plantilla fuera ------------------------------------------

DELETE c
FROM fayxzvov_inventory.inflow_origin c
INNER JOIN fayxzvov_inventory.inflow_origin t ON t.companies_id IS NULL AND t.code = c.code
WHERE c.companies_id IS NOT NULL;

DELETE c
FROM fayxzvov_inventory.shrinkage_reason c
INNER JOIN fayxzvov_inventory.shrinkage_reason t ON t.companies_id IS NULL AND t.code = c.code
WHERE c.companies_id IS NOT NULL;

DELETE c
FROM fayxzvov_inventory.transfer_status c
INNER JOIN fayxzvov_inventory.transfer_status t ON t.companies_id IS NULL AND t.code = c.code
WHERE c.companies_id IS NOT NULL;

-- 3) Columnas fuera (las altas propias de una empresa quedan globales) -------

ALTER TABLE fayxzvov_inventory.inflow_origin
    DROP KEY idx_inflow_origin_company,
    DROP COLUMN companies_id;

ALTER TABLE fayxzvov_inventory.shrinkage_reason
    DROP KEY idx_shrinkage_reason_company,
    DROP COLUMN companies_id;

ALTER TABLE fayxzvov_inventory.transfer_status
    DROP KEY uk_transfer_status_company_code,
    DROP COLUMN companies_id,
    ADD UNIQUE KEY uk_transfer_status_code (code);
