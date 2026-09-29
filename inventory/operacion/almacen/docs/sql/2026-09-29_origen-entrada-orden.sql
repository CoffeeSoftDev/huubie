-- =====================================================================
-- Orígenes de entrada: orden manual
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- inflow_origin.sort_order   posición en el selector de Entradas (menor = arriba).
--
-- Misma columna que ya tiene shrinkage_reason (Motivos de salida). Arranca en
-- id * 10 para respetar el orden que tenía el selector (id ASC) y dejar hueco.
-- La mueven las flechas de Catálogo > Origen entradas (moveInflow, ctrl-catalogo).
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.inflow_origin
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER requires_supplier;

UPDATE fayxzvov_inventory.inflow_origin
SET sort_order = id * 10;
