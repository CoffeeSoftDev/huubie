USE fayxzvov_reginas;

-- Quien capturo el pedido. Mismo patron que cancelled_by / produced_by: id de
-- fayxzvov_alpha.usr_users, sin FK. Los pedidos anteriores quedan en NULL porque
-- ese dato nunca se guardo.
ALTER TABLE `order`
    ADD COLUMN created_by INT(11) NULL DEFAULT NULL AFTER date_creation;
