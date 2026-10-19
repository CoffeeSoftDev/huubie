-- =====================================================================
-- Motivo de ajuste: «Pasó a presentación»
-- Fecha: 18/10/2026
-- BD:    fayxzvov_inventory
-- Requiere: 2026-10-01_conteo-fisico.sql (adjustment_reason) y
--           2026-10-18_presentaciones-producto.sql (item_presentation)
--
-- QUÉ HACE
--   Catálogo > Productos > Editar: un producto que ya existe (COCA COLA REJA 12)
--   se cambia a Presentación de otro (12 piezas de COCA COLA LATA). Su stock pasa
--   al producto base multiplicado por el factor (5 rejas = +60 piezas) y queda
--   un ajuste AJU- ya Aplicado, tipo 'presentacion', con este motivo: dos
--   renglones por almacén, el producto que se va a 0 y el base que suma.
--   Así sale en el kárdex como AJUSTE y no se pierde inventario.
--
-- affects_cost = 0: no es merma ni sobrante, es el mismo inventario contado en
-- otra unidad.
--
-- CORRER ANTES de subir el código: ctrl-almacen lo busca por código al guardar
-- y sin él responde «Falta el motivo PRESENTACION».
-- Se puede volver a correr. El -rollback lo quita si ningún ajuste lo usa.
-- =====================================================================

INSERT INTO fayxzvov_inventory.adjustment_reason (code, name, icon, color_hex, bg_hex, affects_cost, sort_order, active)
SELECT 'PRESENTACION', 'Pasó a presentación', 'boxes', '#C05A40', '#FBF3EF', 0, 60, 1
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM fayxzvov_inventory.adjustment_reason WHERE code = 'PRESENTACION'
);

-- VERIFICACIÓN
SELECT id, code, name, affects_cost, sort_order, active
FROM fayxzvov_inventory.adjustment_reason
ORDER BY sort_order, id;
