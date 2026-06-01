-- ════════════════════════════════════════════════════════════════════════
--  Migracion: cantidad real confirmada vs cantidad reportada en produccion
--  Fecha: 2026-06-01
--
--  Contexto: una orden de produccion (inflow_origin.code='PRODUCTION') se captura
--  con una cantidad PLANEADA/REPORTADA. Al confirmarla, el panadero ajusta la
--  cantidad REAL que efectivamente entro al almacen. Guardamos ambas:
--    - detail_inventory_inflow.quantity            => cantidad reportada (intacta)
--    - detail_inventory_inflow.confirmed_quantity  => cantidad real que entro
--  confirmed_quantity es NULL mientras la entrada esta Pendiente (o no aplica).
--  El stock y los totales (total_units / total_cost) se calculan con la real.
--
--  YA APLICADA en BD local (fayxzvov_reginas). Ejecutar en produccion.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE detail_inventory_inflow
    ADD COLUMN confirmed_quantity DOUBLE NULL AFTER quantity;
