-- =====================================================================
-- Salidas: liga de la salida de surtido (SI-) con su pedido
-- Fecha: 14/10/2026
-- BD:    fayxzvov_inventory
--
-- inventory_shrinkage.purchase_order_id   pedido (OC-/REAB-) que generó la
--                                          salida al surtirse. Antes la única
--                                          liga era la nota "Surtido de
--                                          solicitud OC-0007", y quien surte
--                                          puede escribir otra nota.
--
-- La usa CoffeeIA al eliminar: borrar un pedido borra también su salida y
-- regresa el stock; en Salidas una SI- ligada no se borra sola.
--
-- CORRER ANTES de subir el código: surtir() (ctrl-ordenes) inserta esta
-- columna; sin ella `_CUD` falla y no se puede surtir ni aprobar y surtir.
--
-- El UPDATE liga las SI- que ya existen por su nota (la que pone el sistema).
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inventory_shrinkage
    ADD COLUMN purchase_order_id INT NULL AFTER companies_id,
    ADD KEY idx_shrink_po (purchase_order_id),
    ADD CONSTRAINT fk_shrink_po FOREIGN KEY (purchase_order_id) REFERENCES fayxzvov_inventory.purchase_order (id);

UPDATE fayxzvov_inventory.inventory_shrinkage s
INNER JOIN fayxzvov_inventory.purchase_order po
    ON po.companies_id = s.companies_id
   AND s.note = CONCAT('Surtido de solicitud ', po.folio)
SET s.purchase_order_id = po.id
WHERE s.folio LIKE 'SI-%'
  AND s.purchase_order_id IS NULL;
