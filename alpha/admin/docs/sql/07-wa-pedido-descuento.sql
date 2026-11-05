USE fayxzvov_alpha;

-- Emojis de 4 bytes en la plantilla: sin utf8mb4 se guardan como "????".
SET NAMES utf8mb4;

-- Avisos de pedido: renglon del descuento ({descuento}) arriba del Total (Pedidos) y
-- arriba de Resta (Pedido editado). Requiere 05. Se puede aplicar antes o despues del
-- codigo: una variable que el aviso no manda no sale, y sin descuento el renglon
-- tampoco. Las plantillas que ya traen la variable no se tocan. Se ancla en
-- "{descripcion}" y su renglon en blanco para no depender de los emojis guardados.

UPDATE wa_plantillas
SET body = REPLACE(body, '{descripcion}\n\n', '{descripcion}\n\n🏷️ Descuento: -{descuento}\n')
WHERE type IN ('personalizado', 'edicion')
  AND body NOT LIKE '%{descuento}%';

-- Comprobacion: todo en 1. Un 0 = la plantilla no tenia "{descripcion}" seguido de un
-- renglon en blanco; agregar la variable a mano en Admin > WhatsApp.
SELECT companies_id, type, body LIKE '%{descuento}%' AS trae_descuento
FROM wa_plantillas
WHERE type IN ('personalizado', 'edicion');

-- Reversa:
-- UPDATE wa_plantillas SET body = REPLACE(body, '🏷️ Descuento: -{descuento}\n', '') WHERE type IN ('personalizado', 'edicion');
