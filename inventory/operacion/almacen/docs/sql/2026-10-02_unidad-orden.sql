-- =====================================================================
-- Unidades de medida: orden manual
-- Fecha: 02/10/2026
-- BD:    fayxzvov_inventory
--
-- unit.sort_order   posición en los selectores de unidad (menor = arriba).
--
-- Misma columna que ya tienen shrinkage_reason (Motivos de salida) e
-- inflow_origin (Origen entradas). Se acomoda arrastrando filas en
-- Catálogo > Unidad (sortUnit, ctrl-catalogo).
--
-- Arranca en orden alfabético por empresa, de 10 en 10, para respetar el orden
-- que tenían los selectores (ORDER BY name) y dejar hueco. El conteo va en una
-- tabla derivada con GROUP BY: MySQL 5.7 la materializa y deja actualizar la
-- misma tabla.
--
-- CORRER ANTES de subir el código: listUnit / getMaxUnitSort / sortUnit
-- (ctrl/mdl-catalogo), lsUnits (mdl-almacen) y lsUnidades (mdl-entradas) ya
-- leen esta columna; sin ella esas consultas fallan y los selectores de unidad
-- salen vacíos.
--
-- El -rollback quita la columna.
-- =====================================================================

ALTER TABLE fayxzvov_inventory.unit
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER name;

UPDATE fayxzvov_inventory.unit u
JOIN (
    SELECT a.id, COUNT(*) * 10 AS orden
    FROM fayxzvov_inventory.unit a
    JOIN fayxzvov_inventory.unit b
      ON b.companies_id = a.companies_id
     AND (b.name < a.name OR (b.name = a.name AND b.id <= a.id))
    GROUP BY a.id
) t ON t.id = u.id
SET u.sort_order = t.orden;
