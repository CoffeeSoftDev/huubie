-- =====================================================================
-- Folio por sucursal (2 de 2): renumerar los documentos que ya existen
-- Fecha: 19/10/2026
-- BD:    fayxzvov_inventory (lee las claves de fayxzvov_erp.branches)
--
-- Cada documento con folio viejo (ENT-0018) pasa a la serie de su sucursal, en el
-- orden en que se creó: la primera entrada de Kafeto queda ENT-KAF-0001.
-- Una serie = empresa + sucursal + prefijo (ENT, S, SI, OC, REAB, CP, AJU, TRA).
--
--   inventory_inflow      ENT-   sucursal: branch_id
--   inventory_shrinkage   S-/SI- sucursal: branch_id
--   purchase_order        OC-/REAB-/CP-  sucursal: branch_id (la que pide)
--   inventory_adjustment  AJU-   sucursal: branch_id
--   inventory_transfer    TRA-   sucursal: origin_branch_id
--
-- Se quedan como están:
--   - documentos sin sucursal (branch_id NULL): su folio viejo no choca con los nuevos;
--   - una serie que ya tiene folios nuevos (el código subió antes que esta migración):
--     renumerarla los repetiría. La VERIFICACIÓN las enseña.
--
-- También se corrigen las notas que nombran un pedido o una compra por su folio
-- («Reabasto por surtido de la solicitud OC-0007»): la del reabasto es la liga con
-- su pedido (mdl-borrado.php), no puede quedar con el folio viejo.
--
-- folio_renumeracion guarda cada cambio (antes → después): el -rollback lo usa.
--
-- Va DESPUÉS de 2026-10-19_folio-por-sucursal-claves.sql y ANTES del código.
-- Se puede volver a correr: solo toca folios con el formato viejo.
-- =====================================================================

CREATE TABLE IF NOT EXISTS fayxzvov_inventory.folio_renumeracion (
    id            INT(11)     NOT NULL AUTO_INCREMENT,
    tabla         VARCHAR(40) NOT NULL,
    registro_id   INT(11)     NOT NULL,
    companies_id  INT(11)     NOT NULL,
    folio_antes   VARCHAR(20) NOT NULL,
    folio_despues VARCHAR(20) NOT NULL,
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_folio_renumeracion (tabla, registro_id),
    KEY idx_folio_renumeracion_antes (companies_id, folio_antes)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- -- 1. Plan: el folio nuevo de cada documento viejo --
-- n = cuántos documentos viejos de su serie hay con id <= el suyo.

INSERT IGNORE INTO fayxzvov_inventory.folio_renumeracion (tabla, registro_id, companies_id, folio_antes, folio_despues)
SELECT 'inventory_inflow', t.id, t.companies_id, t.folio,
       CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-', LPAD(COUNT(t2.id), 4, '0'))
FROM fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_erp.branches b ON b.id = t.branch_id AND b.company_id = t.companies_id AND b.folio_code IS NOT NULL
INNER JOIN fayxzvov_inventory.inventory_inflow t2
    ON t2.companies_id = t.companies_id AND t2.branch_id = t.branch_id AND t2.id <= t.id
   AND SUBSTRING_INDEX(t2.folio, '-', 1) = SUBSTRING_INDEX(t.folio, '-', 1)
   AND t2.folio REGEXP '^[A-Z]+-[0-9]+$'
WHERE t.folio REGEXP '^[A-Z]+-[0-9]+$'
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_inventory.inventory_inflow n
      WHERE n.companies_id = t.companies_id
        AND n.folio LIKE CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-%')
  )
GROUP BY t.id, t.companies_id, t.folio, b.folio_code;

INSERT IGNORE INTO fayxzvov_inventory.folio_renumeracion (tabla, registro_id, companies_id, folio_antes, folio_despues)
SELECT 'inventory_shrinkage', t.id, t.companies_id, t.folio,
       CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-', LPAD(COUNT(t2.id), 4, '0'))
FROM fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_erp.branches b ON b.id = t.branch_id AND b.company_id = t.companies_id AND b.folio_code IS NOT NULL
INNER JOIN fayxzvov_inventory.inventory_shrinkage t2
    ON t2.companies_id = t.companies_id AND t2.branch_id = t.branch_id AND t2.id <= t.id
   AND SUBSTRING_INDEX(t2.folio, '-', 1) = SUBSTRING_INDEX(t.folio, '-', 1)
   AND t2.folio REGEXP '^[A-Z]+-[0-9]+$'
WHERE t.folio REGEXP '^[A-Z]+-[0-9]+$'
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_inventory.inventory_shrinkage n
      WHERE n.companies_id = t.companies_id
        AND n.folio LIKE CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-%')
  )
GROUP BY t.id, t.companies_id, t.folio, b.folio_code;

INSERT IGNORE INTO fayxzvov_inventory.folio_renumeracion (tabla, registro_id, companies_id, folio_antes, folio_despues)
SELECT 'purchase_order', t.id, t.companies_id, t.folio,
       CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-', LPAD(COUNT(t2.id), 4, '0'))
FROM fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_erp.branches b ON b.id = t.branch_id AND b.company_id = t.companies_id AND b.folio_code IS NOT NULL
INNER JOIN fayxzvov_inventory.purchase_order t2
    ON t2.companies_id = t.companies_id AND t2.branch_id = t.branch_id AND t2.id <= t.id
   AND SUBSTRING_INDEX(t2.folio, '-', 1) = SUBSTRING_INDEX(t.folio, '-', 1)
   AND t2.folio REGEXP '^[A-Z]+-[0-9]+$'
WHERE t.folio REGEXP '^[A-Z]+-[0-9]+$'
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_inventory.purchase_order n
      WHERE n.companies_id = t.companies_id
        AND n.folio LIKE CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-%')
  )
GROUP BY t.id, t.companies_id, t.folio, b.folio_code;

INSERT IGNORE INTO fayxzvov_inventory.folio_renumeracion (tabla, registro_id, companies_id, folio_antes, folio_despues)
SELECT 'inventory_adjustment', t.id, t.companies_id, t.folio,
       CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-', LPAD(COUNT(t2.id), 4, '0'))
FROM fayxzvov_inventory.inventory_adjustment t
INNER JOIN fayxzvov_erp.branches b ON b.id = t.branch_id AND b.company_id = t.companies_id AND b.folio_code IS NOT NULL
INNER JOIN fayxzvov_inventory.inventory_adjustment t2
    ON t2.companies_id = t.companies_id AND t2.branch_id = t.branch_id AND t2.id <= t.id
   AND SUBSTRING_INDEX(t2.folio, '-', 1) = SUBSTRING_INDEX(t.folio, '-', 1)
   AND t2.folio REGEXP '^[A-Z]+-[0-9]+$'
WHERE t.folio REGEXP '^[A-Z]+-[0-9]+$'
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_inventory.inventory_adjustment n
      WHERE n.companies_id = t.companies_id
        AND n.folio LIKE CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-%')
  )
GROUP BY t.id, t.companies_id, t.folio, b.folio_code;

INSERT IGNORE INTO fayxzvov_inventory.folio_renumeracion (tabla, registro_id, companies_id, folio_antes, folio_despues)
SELECT 'inventory_transfer', t.id, t.companies_id, t.folio,
       CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-', LPAD(COUNT(t2.id), 4, '0'))
FROM fayxzvov_inventory.inventory_transfer t
INNER JOIN fayxzvov_erp.branches b ON b.id = t.origin_branch_id AND b.company_id = t.companies_id AND b.folio_code IS NOT NULL
INNER JOIN fayxzvov_inventory.inventory_transfer t2
    ON t2.companies_id = t.companies_id AND t2.origin_branch_id = t.origin_branch_id AND t2.id <= t.id
   AND SUBSTRING_INDEX(t2.folio, '-', 1) = SUBSTRING_INDEX(t.folio, '-', 1)
   AND t2.folio REGEXP '^[A-Z]+-[0-9]+$'
WHERE t.folio REGEXP '^[A-Z]+-[0-9]+$'
  AND NOT EXISTS (
      SELECT 1 FROM fayxzvov_inventory.inventory_transfer n
      WHERE n.companies_id = t.companies_id
        AND n.folio LIKE CONCAT(SUBSTRING_INDEX(t.folio, '-', 1), '-', b.folio_code, '-%')
  )
GROUP BY t.id, t.companies_id, t.folio, b.folio_code;

-- -- 2. Aplicar el plan (solo donde el folio sigue siendo el viejo) --

UPDATE fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_inflow' AND r.registro_id = t.id
SET t.folio = r.folio_despues
WHERE t.folio = r.folio_antes;

UPDATE fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_shrinkage' AND r.registro_id = t.id
SET t.folio = r.folio_despues
WHERE t.folio = r.folio_antes;

UPDATE fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.registro_id = t.id
SET t.folio = r.folio_despues
WHERE t.folio = r.folio_antes;

UPDATE fayxzvov_inventory.inventory_adjustment t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_adjustment' AND r.registro_id = t.id
SET t.folio = r.folio_despues
WHERE t.folio = r.folio_antes;

UPDATE fayxzvov_inventory.inventory_transfer t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'inventory_transfer' AND r.registro_id = t.id
SET t.folio = r.folio_despues
WHERE t.folio = r.folio_antes;

-- -- 3. Notas que nombran un pedido o una compra por su folio --
-- Un UPDATE con JOIN cambia cada renglón una vez por corrida: se repite por si
-- alguna nota nombra dos folios. 'OC-0007' no está dentro de 'OC-GUA-0007', así que
-- repetir no vuelve a tocar lo ya cambiado.

UPDATE fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_antes, r.folio_despues)
WHERE t.note LIKE CONCAT('%', r.folio_antes, '%');

UPDATE fayxzvov_inventory.purchase_order t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_antes, r.folio_despues)
WHERE t.note LIKE CONCAT('%', r.folio_antes, '%');

UPDATE fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_antes, r.folio_despues)
WHERE t.note LIKE CONCAT('%', r.folio_antes, '%');

UPDATE fayxzvov_inventory.inventory_inflow t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_antes, r.folio_despues)
WHERE t.note LIKE CONCAT('%', r.folio_antes, '%');

UPDATE fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_antes, r.folio_despues)
WHERE t.note LIKE CONCAT('%', r.folio_antes, '%');

UPDATE fayxzvov_inventory.inventory_shrinkage t
INNER JOIN fayxzvov_inventory.folio_renumeracion r ON r.tabla = 'purchase_order' AND r.companies_id = t.companies_id
SET t.note = REPLACE(t.note, r.folio_antes, r.folio_despues)
WHERE t.note LIKE CONCAT('%', r.folio_antes, '%');

-- VERIFICACIÓN
-- a) Cómo quedó cada serie.
SELECT 'inventory_inflow' AS tabla, companies_id, branch_id AS sucursal, SUBSTRING_INDEX(folio, '-', 1) AS prefijo, COUNT(*) AS documentos, MIN(folio) AS primero, MAX(folio) AS ultimo
FROM fayxzvov_inventory.inventory_inflow GROUP BY companies_id, branch_id, prefijo
UNION ALL
SELECT 'inventory_shrinkage', companies_id, branch_id, SUBSTRING_INDEX(folio, '-', 1), COUNT(*), MIN(folio), MAX(folio)
FROM fayxzvov_inventory.inventory_shrinkage GROUP BY companies_id, branch_id, SUBSTRING_INDEX(folio, '-', 1)
UNION ALL
SELECT 'purchase_order', companies_id, branch_id, SUBSTRING_INDEX(folio, '-', 1), COUNT(*), MIN(folio), MAX(folio)
FROM fayxzvov_inventory.purchase_order GROUP BY companies_id, branch_id, SUBSTRING_INDEX(folio, '-', 1)
UNION ALL
SELECT 'inventory_adjustment', companies_id, branch_id, SUBSTRING_INDEX(folio, '-', 1), COUNT(*), MIN(folio), MAX(folio)
FROM fayxzvov_inventory.inventory_adjustment GROUP BY companies_id, branch_id, SUBSTRING_INDEX(folio, '-', 1)
UNION ALL
SELECT 'inventory_transfer', companies_id, origin_branch_id, SUBSTRING_INDEX(folio, '-', 1), COUNT(*), MIN(folio), MAX(folio)
FROM fayxzvov_inventory.inventory_transfer GROUP BY companies_id, origin_branch_id, SUBSTRING_INDEX(folio, '-', 1);

-- b) Lo que se quedó con folio viejo (sin sucursal o serie ya iniciada). Vacío = todo renumerado.
SELECT 'inventory_inflow' AS tabla, id, companies_id, branch_id, folio FROM fayxzvov_inventory.inventory_inflow WHERE folio REGEXP '^[A-Z]+-[0-9]+$'
UNION ALL SELECT 'inventory_shrinkage', id, companies_id, branch_id, folio FROM fayxzvov_inventory.inventory_shrinkage WHERE folio REGEXP '^[A-Z]+-[0-9]+$'
UNION ALL SELECT 'purchase_order', id, companies_id, branch_id, folio FROM fayxzvov_inventory.purchase_order WHERE folio REGEXP '^[A-Z]+-[0-9]+$'
UNION ALL SELECT 'inventory_adjustment', id, companies_id, branch_id, folio FROM fayxzvov_inventory.inventory_adjustment WHERE folio REGEXP '^[A-Z]+-[0-9]+$'
UNION ALL SELECT 'inventory_transfer', id, companies_id, origin_branch_id, folio FROM fayxzvov_inventory.inventory_transfer WHERE folio REGEXP '^[A-Z]+-[0-9]+$';

-- c) Folios repetidos en una empresa. Vacío = bien.
SELECT 'inventory_inflow' AS tabla, companies_id, folio, COUNT(*) AS veces FROM fayxzvov_inventory.inventory_inflow GROUP BY companies_id, folio HAVING COUNT(*) > 1
UNION ALL SELECT 'inventory_shrinkage', companies_id, folio, COUNT(*) FROM fayxzvov_inventory.inventory_shrinkage GROUP BY companies_id, folio HAVING COUNT(*) > 1
UNION ALL SELECT 'purchase_order', companies_id, folio, COUNT(*) FROM fayxzvov_inventory.purchase_order GROUP BY companies_id, folio HAVING COUNT(*) > 1
UNION ALL SELECT 'inventory_adjustment', companies_id, folio, COUNT(*) FROM fayxzvov_inventory.inventory_adjustment GROUP BY companies_id, folio HAVING COUNT(*) > 1
UNION ALL SELECT 'inventory_transfer', companies_id, folio, COUNT(*) FROM fayxzvov_inventory.inventory_transfer GROUP BY companies_id, folio HAVING COUNT(*) > 1;
