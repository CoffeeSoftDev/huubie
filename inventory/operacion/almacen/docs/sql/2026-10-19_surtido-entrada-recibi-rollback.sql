-- =====================================================================
-- ROLLBACK de 2026-10-19_surtido-entrada-recibi.sql
-- Bajar antes el código (surtir() y confirmRecepcion en ctrl-ordenes).
-- El origen SURTIDO_SUC solo se borra si ninguna entrada lo usa.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.purchase_order
    DROP COLUMN received_confirmed_at,
    DROP COLUMN received_confirmed_user_id;

DELETE o FROM fayxzvov_inventory.inflow_origin o
WHERE o.code = 'SURTIDO_SUC'
  AND NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.inventory_inflow i WHERE i.inflow_origin_id = o.id);
