-- =====================================================================
-- Entradas: quién editó la entrada
-- Fecha: 28/09/2026
-- BD:    fayxzvov_inventory
--
-- inventory_inflow.edited_at        cuándo se guardó la última edición.
-- inventory_inflow.edited_user_id   quién la guardó (fayxzvov_erp.users.id).
--
-- Mismo patrón que confirmed_at / confirmed_user_id. No se usa updated_at
-- porque también lo tocan confirmar, cancelar y el recálculo de totales.
-- Sin FK: users vive en otro esquema (fayxzvov_erp), igual que user_id y
-- confirmed_user_id.
--
-- Lo escribe updateEntrada (ctrl-entradas). El -rollback quita las columnas.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_inflow
    ADD COLUMN edited_at      DATETIME NULL AFTER confirmed_at,
    ADD COLUMN edited_user_id INT      NULL AFTER confirmed_user_id,
    ADD KEY idx_inflow_edited_user (edited_user_id);
