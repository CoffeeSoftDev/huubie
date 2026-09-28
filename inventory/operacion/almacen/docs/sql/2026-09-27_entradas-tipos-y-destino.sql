-- =====================================================================
-- Entradas: tipos de entrada nuevos y destino (área)
-- Fecha: 27/09/2026
-- BD:    fayxzvov_inventory
--
-- 1) TIPOS DE ENTRADA (inflow_origin, catálogo global)
--    El modal de Nueva entrada debe ofrecer: Nota sencilla, Compra sin
--    proveedor y Entrada por ajuste. Se reusan los que ya existían:
--      - code EDA    "nota"   -> "Nota sencilla"
--      - code AJUSTE "Ajuste" -> "Entrada por ajuste" (estaba inactivo)
--      - "Compra sin proveedor" se crea (no exige proveedor).
--    Los INSERT solo corren si el nombre no existe: en una BD donde no esté
--    EDA o AJUSTE, el tipo se crea en vez de renombrarse.
--
-- 2) DESTINO
--    inventory_inflow.warehouse_area_id   área del almacén a donde irá la
--    mercancía (anaquel, refrigerador...). Opcional. El stock se sigue
--    llevando por almacén (warehouse_id); el área solo se registra.
--
-- El -rollback regresa los nombres, borra "Compra sin proveedor" si ninguna
-- entrada la usa y quita la columna.
-- =====================================================================

-- 1) TIPOS DE ENTRADA -------------------------------------------------------
UPDATE fayxzvov_inventory.inflow_origin
   SET name = 'Nota sencilla', active = 1
 WHERE code = 'EDA';

UPDATE fayxzvov_inventory.inflow_origin
   SET name = 'Entrada por ajuste', active = 1
 WHERE code = 'AJUSTE';

INSERT INTO fayxzvov_inventory.inflow_origin (code, name, icon, color_hex, bg_hex, requires_supplier, active)
SELECT 'NOTA', 'Nota sencilla', 'sticky-note', '#474747', '#e5e5dc', 0, 1 FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.inflow_origin WHERE name = 'Nota sencilla');

INSERT INTO fayxzvov_inventory.inflow_origin (code, name, icon, color_hex, bg_hex, requires_supplier, active)
SELECT 'AJUSTE', 'Entrada por ajuste', 'sliders-horizontal', '#fe6262', NULL, 0, 1 FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.inflow_origin WHERE name = 'Entrada por ajuste');

INSERT INTO fayxzvov_inventory.inflow_origin (code, name, icon, color_hex, bg_hex, requires_supplier, active)
SELECT 'COMPRA_SP', 'Compra sin proveedor', 'shopping-cart', '#fe9706', NULL, 0, 1 FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM fayxzvov_inventory.inflow_origin WHERE name = 'Compra sin proveedor');


-- 2) DESTINO ----------------------------------------------------------------
ALTER TABLE fayxzvov_inventory.inventory_inflow
    ADD COLUMN warehouse_area_id INT NULL AFTER warehouse_id,
    ADD KEY idx_inflow_area (warehouse_area_id),
    ADD CONSTRAINT fk_inflow_area FOREIGN KEY (warehouse_area_id)
        REFERENCES fayxzvov_inventory.warehouse_area (id);
