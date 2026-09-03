-- ============================================================================
--  Seed 01 — diez productos puente para armar el papel de tasa 0%
--
--  El cierre del dia se detiene con "No hay productos de tasa 0% dados de alta"
--  mientras el catalogo no tenga ninguno marcado como puente. Los 174 productos
--  que trae la base son los que el POS exporto —comida preparada, con IVA— y
--  ninguno sirve para armar un papel al 0%.
--
--  ── Por que estos y no otros ───────────────────────────────────────────────
--  Son abarrotes: alimento no preparado envasado y hielo. Es lo que la ley pone
--  en tasa 0% (LIVA art. 2-A), asi que un ticket armado con ellos es coherente
--  con la tasa que declara. Un roll de sushi al 0% no lo seria.
--
--  ── Los precios no son decorativos ─────────────────────────────────────────
--  El armado exacto (ver armarExacto) busca la combinacion de precios que suma
--  el total del ticket al peso, y solo cuando no existe recurre al descuento de
--  cuadre. Con esta escala —165, 120, 89, 65, 48, 35, 25, 22, 18, 15— TODO monto
--  entero desde $65 cierra exacto, asi que el descuento deja de hacer falta.
--  Se verifico con la misma tabla de alcance del controlador: 36 huecos, todos
--  por debajo de $65, y los 20 montos con tarjeta del 22/08 cierran los 20.
--
--  Cambiar un precio por uno "mas bonito" puede abrir huecos: antes de tocarlos
--  conviene recalcular que montos siguen cerrando.
--
--  Todos con precio entero y sin centavos: el armado exacto trabaja en pesos y
--  descarta los precios con decimales (ver preciosDe).
--
--  Idempotente: se puede correr las veces que sea, no duplica por code+sucursal.
--  Rollback en seed-01-productos-puente-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

DROP PROCEDURE IF EXISTS seedBridgeProducts;

DELIMITER $$

CREATE PROCEDURE seedBridgeProducts()
BEGIN
    DECLARE sucursal INT DEFAULT NULL;
    DECLARE punto    INT DEFAULT NULL;

    -- Se cuelgan del mismo par sucursal/POS que el catalogo cargado, porque
    -- listBridgeProducts filtra por sucursal y un puente de otra sucursal no lo
    -- veria el cierre.
    SELECT MIN(branch_id) INTO sucursal
      FROM product WHERE active = 1 AND branch_id IS NOT NULL;

    -- Preguntarle la sucursal al catalogo funciona mientras haya catalogo. Recien
    -- limpiada la base —o antes de la primera carga de comandas— la tabla esta
    -- vacia, MIN() devuelve NULL y los puentes entrarian sin sucursal: invisibles
    -- para el cierre, que filtra por ella. La sucursal la responde `branch`, que
    -- existe desde el alta del cliente.
    IF sucursal IS NULL THEN
        SELECT id INTO sucursal
          FROM branch WHERE active = 1 ORDER BY id LIMIT 1;
    END IF;

    -- El POS sale del catalogo de ESA sucursal, y cuando no hay, del que la
    -- sucursal opera hoy (`branch.pos_id`). Importa porque `uk_product_code` es
    -- (code, branch_id, pos_id): con el POS en NULL, la misma clave volveria a
    -- entrar en la siguiente corrida en vez de reconocerse.
    SELECT MIN(pos_id) INTO punto
      FROM product WHERE active = 1 AND branch_id <=> sucursal;

    IF punto IS NULL THEN
        SELECT pos_id INTO punto FROM branch WHERE id = sucursal;
    END IF;

    -- Sin sucursal no se siembra nada: un puente huerfano no lo ve nadie y
    -- estorbaria en el catalogo.
    IF sucursal IS NOT NULL THEN
        INSERT INTO product (code, name, is_modifier, is_bridge, group_type, group_name, price, branch_id, pos_id, active)
        SELECT t.code, t.name, 0, 1, 'ABARROTES', t.group_name, t.price, sucursal, punto, 1
          FROM (
                          SELECT 'PTE001' AS code, 'ARROZ PARA SUSHI 1 KG'        AS name, 'GRANO'    AS group_name, 165 AS price
                UNION ALL SELECT 'PTE002',          'ALGA NORI 50 HOJAS',                'ALGA',              120
                UNION ALL SELECT 'PTE003',          'FIDEO PARA RAMEN SECO 500 G',       'PASTA',              89
                UNION ALL SELECT 'PTE004',          'SALSA DE SOYA 500 ML',              'ADEREZO',            65
                UNION ALL SELECT 'PTE005',          'VINAGRE DE ARROZ 500 ML',           'ADEREZO',            48
                UNION ALL SELECT 'PTE006',          'PAN MOLIDO PANKO 300 G',            'GRANO',              35
                UNION ALL SELECT 'PTE007',          'TE VERDE EN HOJA 100 G',            'INFUSION',           25
                UNION ALL SELECT 'PTE008',          'AJONJOLI TOSTADO 200 G',            'SEMILLA',            22
                UNION ALL SELECT 'PTE009',          'JENGIBRE ENCURTIDO 200 G',          'CONSERVA',           18
                UNION ALL SELECT 'PTE010',          'HIELO EN BOLSA 2 KG',               'HIELO',              15
               ) t
         WHERE NOT EXISTS (
                   SELECT 1 FROM product p
                    WHERE p.code = t.code AND p.branch_id <=> sucursal
               );

        -- El que ya existia de una corrida anterior se deja como puente y con su
        -- precio, por si alguien lo desmarco a mano probando.
        UPDATE product
           SET is_bridge = 1, is_modifier = 0, active = 1
         WHERE code LIKE 'PTE%' AND branch_id <=> sucursal;
    END IF;
END$$

DELIMITER ;

CALL seedBridgeProducts();

DROP PROCEDURE IF EXISTS seedBridgeProducts;

SELECT code, name, price, is_bridge
  FROM product
 WHERE code LIKE 'PTE%' AND active = 1
 ORDER BY price DESC;
