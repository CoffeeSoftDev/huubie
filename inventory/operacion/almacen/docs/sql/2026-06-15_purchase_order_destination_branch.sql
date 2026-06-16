-- =====================================================================
-- Modulo Ordenes / Solicitudes de Compra
-- Agrega la sucursal DESTINO ("a quien se le pide") a la cabecera.
--
-- branch_id              = sucursal solicitante (origen, quien levanta la OC)
-- destination_branch_id  = sucursal destino (a quien se le pide que surta)
--
-- FK tenant hacia fayxzvov_erp.branches, mismo patron que branch_id.
-- =====================================================================

ALTER TABLE `purchase_order`
  ADD COLUMN `destination_branch_id` int DEFAULT NULL AFTER `branch_id`,
  ADD KEY `idx_po_dest_branch` (`destination_branch_id`) USING BTREE,
  ADD CONSTRAINT `fk_po_dest_branch` FOREIGN KEY (`destination_branch_id`)
      REFERENCES `fayxzvov_erp`.`branches` (`id`);
