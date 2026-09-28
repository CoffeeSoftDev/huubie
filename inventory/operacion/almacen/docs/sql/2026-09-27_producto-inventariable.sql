-- =====================================================================
-- Producto inventariable
-- Fecha: 27/09/2026
-- BD:    fayxzvov_inventory
--
-- El formulario de Almacén > Productos pide el campo "Inventariable" (Sí/No)
-- después del costo con impuesto. No había columna donde guardarlo.
--
--   item_attribute.is_inventoriable   1 = inventariable, 0 = no   (columna nueva)
--
-- Los productos que ya existen quedan como inventariables (DEFAULT 1).
-- Por ahora solo se guarda: ninguna pantalla cambia su comportamiento por él.
--
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.item_attribute
    ADD COLUMN is_inventoriable TINYINT NOT NULL DEFAULT 1 AFTER cost_tax;
