-- 07/10/2026 · Mueve TODO el inventario de Reginas (companies_id=1) a
-- Cafe ligero Pasteleria (companies_id=2) y junta las sucursales de Reginas
-- (1, 2, 4) en "Cafe Ligero Central" (branch 3). Crea admin y operador.
-- IDs de la BD LOCAL: en prod revisar companies/branches/roles antes de correrlo.

START TRANSACTION;

-- -- Catálogo --
UPDATE fayxzvov_inventory.item_category  SET companies_id = 2 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.unit           SET companies_id = 2 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.supplier       SET companies_id = 2 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.item           SET companies_id = 2, branch_id = 3 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.item_attribute SET companies_id = 2 WHERE companies_id = 1;

-- -- Almacenes y stock --
-- Un solo almacén predeterminado en la sucursal destino: se queda "Almacén General" (id 1).
UPDATE fayxzvov_inventory.warehouse      SET companies_id = 2, branch_id = 3,
                                             is_default = IF(id = 1, is_default, 0)
                                         WHERE companies_id = 1;
UPDATE fayxzvov_inventory.warehouse_area SET companies_id = 2 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.stock          SET companies_id = 2 WHERE companies_id = 1;

-- -- Movimientos --
UPDATE fayxzvov_inventory.inventory_inflow     SET companies_id = 2, branch_id = 3 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.inventory_shrinkage  SET companies_id = 2, branch_id = 3 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.inventory_adjustment SET companies_id = 2, branch_id = 3 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.inventory_transfer   SET companies_id = 2, origin_branch_id = 3, destination_branch_id = 3 WHERE companies_id = 1;
UPDATE fayxzvov_inventory.purchase_order       SET companies_id = 2, branch_id = 3,
                                                   destination_branch_id = IF(destination_branch_id IS NULL, NULL, 3)
                                               WHERE companies_id = 1;
UPDATE fayxzvov_inventory.inflow_format        SET companies_id = 2,
                                                   branch_id = IF(branch_id IS NULL, NULL, 3)
                                               WHERE companies_id = 1;

-- -- Usuarios --
-- Contraseña de ambos: admin (bcrypt + md5 en `key`, igual que el alta de accesos).
INSERT INTO fayxzvov_erp.users (name, last_name, email, password, `key`, branch_id, company_id, status, created_at)
VALUES ('Admin', 'CoffeeSoft', 'admin@coffeesoft.com',
        '$2y$10$t8XrJ3aj/3E6dpzKcRdBQOgGJyOxGSG6aV17FP/0P..vuQ7fiVguW', MD5('admin'), 3, 2, 'active', NOW());
SET @admin_id = LAST_INSERT_ID();

INSERT INTO fayxzvov_erp.users (name, last_name, email, password, `key`, branch_id, company_id, status, created_at)
VALUES ('Operador', 'CoffeeSoft', 'operador@coffeesoft.com',
        '$2y$10$KNMgMZvD4LNjJAR3LuroUeHZpYvKukFuMO.YPVEQF98m0yzfYHE0S', MD5('admin'), 3, 2, 'active', NOW());
SET @operador_id = LAST_INSERT_ID();

-- Rol por sucursal: 2 = admin, 3 = operador.
INSERT INTO fayxzvov_erp.users_braches (user_id, branch_id, role_id) VALUES
    (@admin_id,    3, 2),
    (@operador_id, 3, 3);

COMMIT;
