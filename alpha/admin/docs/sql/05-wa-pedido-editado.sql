USE fayxzvov_alpha;

-- Emojis de 4 bytes en la plantilla: sin utf8mb4 se guardan como "????".
SET NAMES utf8mb4;

-- Aviso "Pedido editado" (clave 'edicion'): sale cuando un pedido que ya se avisó se
-- vuelve a guardar con cambios. Lleva lo que cambió desde el último aviso y el pedido
-- como quedó. Requiere 04-wa-config.sql. Aplicar ANTES de subir el código: aviso()
-- escribe la columna nueva en cada envío (cierre y turno incluidos).

-- Lo que dijo cada aviso de pedido (fecha, hora, cliente, tel, estatus y productos, en
-- JSON). El siguiente aviso del mismo pedido se compara contra esto.
ALTER TABLE wa_historial
    ADD COLUMN snapshot TEXT NULL AFTER error;

-- Solo Pastelería Reginas (companies_id 4) usa pedidos. Nace encendido.
INSERT IGNORE INTO wa_plantillas (type, body, companies_id, active) VALUES
('edicion', '✏️ *PEDIDO EDITADO {folio}*\n📅 Fecha: {fecha}\n⏰ Hora: {hora}\n📍 Sucursal: {sucursal}\n👤 Cliente: {cliente}\n📱 Tel: {telefono}\n\n*CAMBIOS*\n{cambios}\n\n*PRODUCTOS*\n{productos}\n\n*PAGO*\n💰 Total: {total}\n💵 Anticipo: {anticipo}\n💳 Forma de pago: {forma_pago}\n🧾 Restante: {restante}\n\n*ESTATUS:* {estatus}', 4, 1);

-- Quien recibe Pedidos recibe también sus ediciones; en Admin se pausan por separado.
INSERT IGNORE INTO wa_destinatarios (name, phone, type, companies_id, active)
SELECT name, phone, 'edicion', companies_id, active
FROM wa_destinatarios
WHERE type = 'personalizado';

-- Reversa:
-- DELETE FROM wa_destinatarios WHERE type = 'edicion';
-- DELETE FROM wa_plantillas WHERE type = 'edicion';
-- ALTER TABLE wa_historial DROP COLUMN snapshot;
