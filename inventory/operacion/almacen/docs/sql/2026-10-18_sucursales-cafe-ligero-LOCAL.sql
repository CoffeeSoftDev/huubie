-- =====================================================================
-- SOLO BD LOCAL (IDs locales). NO correr en producción.
-- Café Ligero (company 2): Kafeto y Cuarta pasan de ser almacenes de la
-- sucursal Central a ser sucursales con su propio almacén.
-- Fecha: 18/10/2026
--
-- Antecedente: el 07/10/2026 (2026-10-07_mover-inventario-cafe-ligero.sql)
-- las sucursales de Reginas se juntaron en la sucursal 3 (Cafe Ligero
-- Central) y quedaron como almacenes: 6 «Almacén kafeto», 7 «Almacén cuarta».
-- Al 18/10/2026 esos dos almacenes no tienen stock ni movimientos.
--
-- Crea las sucursales «Cafe Ligero Kafeto» y «Cafe Ligero Cuarta», les pasa
-- su almacén como almacén por defecto y le da a Rosy (usuario 1) el mismo rol
-- que tiene en Central, para poder cambiar de sucursal en la navbar.
-- El almacén principal queda el «Almacén General» de Central (id 1).
-- El -rollback lo deshace.
-- =====================================================================

INSERT INTO fayxzvov_erp.branches (name, ubication, `order`, created_at, is_active, company_id)
SELECT 'Cafe Ligero Kafeto', 'En cafeto', 2, NOW(), 1, 2
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM fayxzvov_erp.branches WHERE company_id = 2 AND name = 'Cafe Ligero Kafeto');

INSERT INTO fayxzvov_erp.branches (name, ubication, `order`, created_at, is_active, company_id)
SELECT 'Cafe Ligero Cuarta', '4a sur', 3, NOW(), 1, 2
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM fayxzvov_erp.branches WHERE company_id = 2 AND name = 'Cafe Ligero Cuarta');

SET @kafeto := (SELECT id FROM fayxzvov_erp.branches WHERE company_id = 2 AND name = 'Cafe Ligero Kafeto' LIMIT 1);
SET @cuarta := (SELECT id FROM fayxzvov_erp.branches WHERE company_id = 2 AND name = 'Cafe Ligero Cuarta' LIMIT 1);

UPDATE fayxzvov_inventory.warehouse SET branch_id = @kafeto, is_default = 1 WHERE id = 6 AND companies_id = 2;
UPDATE fayxzvov_inventory.warehouse SET branch_id = @cuarta, is_default = 1 WHERE id = 7 AND companies_id = 2;

UPDATE fayxzvov_inventory.warehouse SET is_main = 0 WHERE companies_id = 2;
UPDATE fayxzvov_inventory.warehouse SET is_main = 1 WHERE id = 1 AND companies_id = 2;

INSERT INTO fayxzvov_erp.users_braches (user_id, branch_id, role_id)
SELECT ub.user_id, nueva.id, ub.role_id
FROM fayxzvov_erp.users_braches ub
INNER JOIN (SELECT @kafeto AS id UNION ALL SELECT @cuarta) nueva
WHERE ub.user_id = 1 AND ub.branch_id = 3
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_erp.users_braches x WHERE x.user_id = 1 AND x.branch_id = nueva.id);

-- VERIFICACIÓN
SELECT b.id, b.name, GROUP_CONCAT(CONCAT(w.id, ':', w.name, IF(w.is_default = 1, ' (defecto)', ''), IF(w.is_main = 1, ' (principal)', '')) SEPARATOR ' | ') AS almacenes
FROM fayxzvov_erp.branches b
LEFT JOIN fayxzvov_inventory.warehouse w ON w.branch_id = b.id AND w.active = 1
WHERE b.company_id = 2
GROUP BY b.id;
