-- =====================================================================
-- Categorías y proveedores por sucursal
-- Fecha: 19/10/2026
-- BD:    fayxzvov_inventory
--
-- Pedido del usuario: «categorías, almacenes, proveedores es por sucursal».
-- Decisiones (19/10/2026):
--   - Los que ya existen quedan de Matriz (la sucursal del almacén principal).
--     Las demás sucursales empiezan sin categorías ni proveedores.
--   - Cada sucursal, Matriz incluida, ve solo los suyos; el administrador ve los
--     de todas con el selector de sucursal de su pestaña.
-- Los almacenes ya tenían sucursal (warehouse.branch_id) y las áreas cuelgan de
-- su almacén: no cambian aquí, solo su vista (código).
--
-- item_category.branch_id / supplier.branch_id: sucursal dueña. NULL = de toda la
-- empresa (solo queda así en una empresa sin almacén principal).
--
-- El reparto a Matriz solo corre la primera vez (al crear la columna).
-- Va DESPUÉS de 2026-10-18_almacen-principal.sql y ANTES del código.
-- Se puede volver a correr. El -rollback lo deshace.
-- =====================================================================

-- -- item_category --
SET @nueva := (
    SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory' AND TABLE_NAME = 'item_category' AND COLUMN_NAME = 'branch_id'
);
SET @ddl := IF(@nueva,
    'ALTER TABLE fayxzvov_inventory.item_category ADD COLUMN branch_id INT(11) NULL AFTER companies_id, ADD INDEX idx_item_category_branch (branch_id)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE fayxzvov_inventory.item_category c
INNER JOIN (
    SELECT companies_id, MIN(branch_id) AS branch_id
    FROM fayxzvov_inventory.warehouse
    WHERE is_main = 1 AND active = 1
    GROUP BY companies_id
) m ON m.companies_id = c.companies_id
SET c.branch_id = m.branch_id
WHERE @nueva = 1 AND c.branch_id IS NULL;

-- -- supplier --
SET @nueva := (
    SELECT COUNT(*) = 0 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'fayxzvov_inventory' AND TABLE_NAME = 'supplier' AND COLUMN_NAME = 'branch_id'
);
SET @ddl := IF(@nueva,
    'ALTER TABLE fayxzvov_inventory.supplier ADD COLUMN branch_id INT(11) NULL AFTER companies_id, ADD INDEX idx_supplier_branch (branch_id)',
    'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE fayxzvov_inventory.supplier s
INNER JOIN (
    SELECT companies_id, MIN(branch_id) AS branch_id
    FROM fayxzvov_inventory.warehouse
    WHERE is_main = 1 AND active = 1
    GROUP BY companies_id
) m ON m.companies_id = s.companies_id
SET s.branch_id = m.branch_id
WHERE @nueva = 1 AND s.branch_id IS NULL;

-- VERIFICACIÓN
SELECT 'categorias' AS catalogo, companies_id, branch_id, COUNT(*) AS total FROM fayxzvov_inventory.item_category GROUP BY companies_id, branch_id
UNION ALL
SELECT 'proveedores', companies_id, branch_id, COUNT(*) FROM fayxzvov_inventory.supplier GROUP BY companies_id, branch_id;
