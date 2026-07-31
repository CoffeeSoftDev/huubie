-- ============================================================================
--  Migracion 02 — la tasa del ticket virtual
--
--  El reparto del dia manda una parte de las ventas al 0% y deja el resto al
--  16%. La tasa de ESE papel no se puede deducir de `sale`: la venta viene del
--  POS con su 16% y el ticket que se entrega va al cero, asi que son dos datos
--  distintos y el segundo no tenia donde vivir.
--
--  `sale` no se toca a proposito: es la replica literal del Excel del POS y
--  volver a cargar el periodo revertiria cualquier cambio hecho ahi.
--
--  Idempotente no es: correr una sola vez.
-- ============================================================================

USE fayxzvov_facturacion;

ALTER TABLE virtual_ticket
  ADD COLUMN tax_rate DOUBLE NOT NULL DEFAULT 0 AFTER discount,
  ADD COLUMN tax      DOUBLE NOT NULL DEFAULT 0 AFTER tax_rate;
