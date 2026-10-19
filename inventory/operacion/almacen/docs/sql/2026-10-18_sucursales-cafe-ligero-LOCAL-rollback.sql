-- =====================================================================
-- SOLO BD LOCAL. ROLLBACK de 2026-10-18_sucursales-cafe-ligero-LOCAL.sql
-- Regresa los almacenes 6 y 7 a la sucursal Central (3) y borra las
-- sucursales Kafeto y Cuarta de Café Ligero con sus accesos.
-- Falla si ya hay movimientos con esas sucursales: revisar antes.
-- =====================================================================

SET @kafeto := (SELECT id FROM fayxzvov_erp.branches WHERE company_id = 2 AND name = 'Cafe Ligero Kafeto' LIMIT 1);
SET @cuarta := (SELECT id FROM fayxzvov_erp.branches WHERE company_id = 2 AND name = 'Cafe Ligero Cuarta' LIMIT 1);

UPDATE fayxzvov_inventory.warehouse SET branch_id = 3, is_default = 0 WHERE id IN (6, 7) AND companies_id = 2;

DELETE FROM fayxzvov_erp.users_braches WHERE branch_id IN (@kafeto, @cuarta);
DELETE FROM fayxzvov_erp.branches WHERE id IN (@kafeto, @cuarta);
