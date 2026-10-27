-- ============================================================================
--  Migracion 03 — los datos que el ticket imprime y nadie habia capturado
--
--  El papel del modulo Tickets reproduce la tira que sale de la termica del POS,
--  y ese papel lleva renglones que el esquema ya modela pero que estaban en
--  NULL: el RFC, el domicilio fiscal de la empresa (el que va bajo el RFC) y el
--  telefono. El lema —"COMIENDO EN CHIAPAS"— ya vivia en company.business_name
--  desde la carga del membrete; lo que faltaba era leerlo.
--
--  branch.fiscal_address NO se toca: su contenido es la direccion de la
--  sucursal, que en el papel es el LUGAR DE EXPEDICION. El domicilio de arriba
--  es el de la empresa y por eso va en company.
--
--  Sin ALTER TABLE: aqui no falta esquema, faltaban datos.
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

-- -- Emisor --------------------------------------------------------------------

UPDATE company
   SET rfc            = COALESCE(rfc, 'CC1221024LS8'),
       fiscal_address = COALESCE(fiscal_address, 'BLVD. BELISARIO DOMINGUEZ. NUM 171, COL. ISSSTE TUXTLA GUTIERREZ CHIAPAS MEXICO CP 29060'),
       phone          = COALESCE(phone, '9613308870')
 WHERE id = 1;

UPDATE branch
   SET rfc   = COALESCE(rfc, 'CC1221024LS8'),
       phone = COALESCE(phone, '9613308870')
 WHERE id = 1;

-- -- Meseros -------------------------------------------------------------------
--
-- El export del POS solo trae el codigo del mesero, asi que la carga de comandas
-- dio de alta a los 17 con el codigo por nombre y el ticket imprimia "MESERO:98".
-- Aqui se bautizan. El `name = code` del WHERE es lo que hace idempotente la
-- migracion y respeta al que ya tenga nombre puesto a mano desde el catalogo.

UPDATE waiter SET name = 'MAFER'   WHERE code = '98'  AND name = code;
UPDATE waiter SET name = 'DIANA'   WHERE code = '03'  AND name = code;
UPDATE waiter SET name = 'KARLA'   WHERE code = '124' AND name = code;
UPDATE waiter SET name = 'JOSUE'   WHERE code = '60'  AND name = code;
UPDATE waiter SET name = 'BRENDA'  WHERE code = '133' AND name = code;
UPDATE waiter SET name = 'IVAN'    WHERE code = '163' AND name = code;
UPDATE waiter SET name = 'PAOLA'   WHERE code = '157' AND name = code;
UPDATE waiter SET name = 'LUIS'    WHERE code = '46'  AND name = code;
UPDATE waiter SET name = 'ANDREA'  WHERE code = '221' AND name = code;
UPDATE waiter SET name = 'HUGO'    WHERE code = '229' AND name = code;
UPDATE waiter SET name = 'XIMENA'  WHERE code = '132' AND name = code;
UPDATE waiter SET name = 'CESAR'   WHERE code = '77'  AND name = code;
UPDATE waiter SET name = 'ROSY'    WHERE code = '179' AND name = code;
UPDATE waiter SET name = 'ABEL'    WHERE code = '87'  AND name = code;
UPDATE waiter SET name = 'YARELI'  WHERE code = '68'  AND name = code;
UPDATE waiter SET name = 'OMAR'    WHERE code = '184' AND name = code;
UPDATE waiter SET name = 'NALLELY' WHERE code = '90'  AND name = code;
