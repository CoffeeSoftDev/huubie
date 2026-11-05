-- =====================================================================
-- ROLLBACK de 2026-10-28_departamentos.sql
-- Quita el departamento de las requisiciones y su catálogo. Bajar ANTES el
-- código de Requisiciones y Surtir: sin la tabla ni la columna no cargan.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    DROP KEY idx_purchase_order_department,
    DROP COLUMN department_id;

DROP TABLE IF EXISTS fayxzvov_inventory.department;
