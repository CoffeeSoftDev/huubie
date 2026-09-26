USE fayxzvov_reginas;

-- Palomeo de Produccion en el calendario de pedidos: quien marco el pedido como
-- elaborado y cuando. Mismo patron que cancelled_by / cancelled_at. Un pedido esta
-- producido cuando produced_at no es NULL; al quitar la palomita vuelven a NULL.
ALTER TABLE `order`
    ADD COLUMN produced_by INT(11)  NULL DEFAULT NULL AFTER cancelled_at,
    ADD COLUMN produced_at DATETIME NULL DEFAULT NULL AFTER produced_by;
