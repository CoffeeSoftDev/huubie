-- =====================================================================
-- Folio por sucursal (1 de 2): clave de folios de cada sucursal
-- Fecha: 19/10/2026
-- BD:    fayxzvov_erp
--
-- Pedido del usuario: «cada sucursal debe tener su propio folio; las entradas de
-- Kafeto deberían iniciar en 1, no en 8».
-- Decisiones (19/10/2026):
--   - Folio con la clave de la sucursal: ENT-KAF-0001, S-KAF-0001, OC-KAF-0001.
--     La clave no se repite en la empresa, así que el folio tampoco.
--   - Los documentos que ya existen se renumeran (archivo 2 de 2).
--
-- branches.folio_code: clave de folios (2 a 5 letras o números). Se edita en
-- Accesos › Sucursales. Aquí se llena con las 3 primeras letras de la última
-- palabra del nombre («Reginas Kafeto» → KAF). Si dos sucursales de la empresa
-- quedan con la misma, la de id mayor queda con 2 letras + su id (KA9).
--
-- REVISA el SELECT del final ANTES de correr el archivo 2: la renumeración usa
-- estas claves y después cambiarlas ya no renombra los folios viejos.
-- Para corregir una:  UPDATE fayxzvov_erp.branches SET folio_code = 'KAF' WHERE id = 2;
--
-- Va ANTES del código. Se puede volver a correr. El -rollback lo deshace.
-- =====================================================================

-- -- Columna --
SET @nueva := (
    SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND COLUMN_NAME = 'folio_code'
);
SET @ddl := IF(@nueva,
    'ALTER TABLE fayxzvov_erp.branches ADD COLUMN folio_code VARCHAR(5) NULL AFTER name',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -- Clave sugerida para las que no tienen --
UPDATE fayxzvov_erp.branches
SET folio_code = UPPER(LEFT(
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            REPLACE(REPLACE(REPLACE(SUBSTRING_INDEX(TRIM(name), ' ', -1), '.', ''), ',', ''), '-', ''),
            'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ü', 'u'), 'ñ', 'n'),
            'Á', 'A'), 'É', 'E'), 'Í', 'I'), 'Ó', 'O'), 'Ú', 'U'), 'Ü', 'U'), 'Ñ', 'N'),
    3))
WHERE folio_code IS NULL OR folio_code = '';

-- Muy corta (nombre que termina en una sola letra o número): S + id.
UPDATE fayxzvov_erp.branches
SET folio_code = CONCAT('S', id)
WHERE CHAR_LENGTH(folio_code) < 2;

-- -- Repetidas en la misma empresa: la de id mayor queda con 2 letras + su id --
UPDATE fayxzvov_erp.branches b
INNER JOIN (
    SELECT b2.id
    FROM fayxzvov_erp.branches b2
    INNER JOIN fayxzvov_erp.branches b3
        ON b3.company_id = b2.company_id AND b3.folio_code = b2.folio_code AND b3.id < b2.id
    GROUP BY b2.id
) d ON d.id = b.id
SET b.folio_code = LEFT(CONCAT(LEFT(b.folio_code, 2), b.id), 5);

-- -- Única por empresa --
SET @falta := (
    SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'fayxzvov_erp' AND TABLE_NAME = 'branches' AND INDEX_NAME = 'uq_branches_folio_code'
);
SET @ddl := IF(@falta,
    'ALTER TABLE fayxzvov_erp.branches ADD UNIQUE KEY uq_branches_folio_code (company_id, folio_code)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- VERIFICACIÓN: revisa estas claves antes de correr el archivo 2.
SELECT company_id, id, name, folio_code, is_active
FROM fayxzvov_erp.branches
ORDER BY company_id, id;
