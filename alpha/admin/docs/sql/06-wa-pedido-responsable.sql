USE fayxzvov_alpha;

-- Emojis de 4 bytes en la plantilla: sin utf8mb4 se guardan como "????".
SET NAMES utf8mb4;

-- Avisos de pedido: quién lo capturó ({capturo}) y quién lo editó ({edito}). Agrega el
-- renglón debajo de la sucursal en las plantillas ya guardadas. Requiere 05. Se puede
-- aplicar antes o después del código: una variable que el aviso no manda no sale.
-- Las plantillas que ya traen la variable no se tocan. Se ancla en "{sucursal}" y no en
-- "📍 {sucursal}": la plantilla que sembró 05 dice "📍 Sucursal: {sucursal}".

UPDATE wa_plantillas
SET body = REPLACE(body, '{sucursal}\n', '{sucursal}\n🖊️ Capturó: {capturo}\n')
WHERE type = 'personalizado'
  AND body NOT LIKE '%{capturo}%';

UPDATE wa_plantillas
SET body = REPLACE(body, '{sucursal}\n', '{sucursal}\n🖊️ Editó: {edito}\n')
WHERE type = 'edicion'
  AND body NOT LIKE '%{edito}%';

-- Comprobación: todo en 1. Un 0 = la plantilla no tenía "{sucursal}" en su propio
-- renglón; agregar la variable a mano en Admin > WhatsApp.
SELECT companies_id, type,
       IF(type = 'personalizado', body LIKE '%{capturo}%', body LIKE '%{edito}%') AS trae_responsable
FROM wa_plantillas
WHERE type IN ('personalizado', 'edicion');

-- Reversa:
-- UPDATE wa_plantillas SET body = REPLACE(body, '🖊️ Capturó: {capturo}\n', '') WHERE type = 'personalizado';
-- UPDATE wa_plantillas SET body = REPLACE(body, '🖊️ Editó: {edito}\n', '') WHERE type = 'edicion';
