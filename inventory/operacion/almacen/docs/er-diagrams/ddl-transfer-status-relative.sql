-- ─────────────────────────────────────────────────────────────────
--  transfer_status :: etiquetas relativas a la perspectiva
--  name_out = como lo ve el ORIGEN (yo envio)
--  name_in  = como lo ve el DESTINO (yo recibo)
--  Si quedan NULL, el codigo cae al name global.
--  BD: fayxzvov_inventory
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE fayxzvov_inventory.transfer_status
    ADD COLUMN name_out VARCHAR(50) NULL AFTER name,
    ADD COLUMN name_in  VARCHAR(50) NULL AFTER name_out;

UPDATE fayxzvov_inventory.transfer_status SET name_out = 'Enviado',     name_in = 'Solicitado'  WHERE code = 'REQUESTED';
UPDATE fayxzvov_inventory.transfer_status SET name_out = 'Autorizado',  name_in = 'Autorizado'  WHERE code = 'AUTHORIZED';
UPDATE fayxzvov_inventory.transfer_status SET name_out = 'En transito', name_in = 'En transito' WHERE code = 'IN_TRANSIT';
UPDATE fayxzvov_inventory.transfer_status SET name_out = 'Entregado',   name_in = 'Recibido'    WHERE code = 'RECEIVED';
UPDATE fayxzvov_inventory.transfer_status SET name_out = 'Rechazado',   name_in = 'Rechazado'   WHERE code = 'REJECTED';
