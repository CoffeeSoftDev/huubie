-- =====================================================================
-- Categorías reales (paso 3 de la reorganización categoría / área / almacén)
-- Fecha: 23/09/2026
-- BD:    fayxzvov_inventory
--
-- REQUISITO: correr antes 2026-09-23_categoria-a-area.sql. Esa migración
--   copia la ubicación (ANAQUEL 1..4, REFRIGERADOR, CONGELADOR) al Área;
--   sin ella, este script borraría la única pista de dónde está cada producto.
--
-- QUÉ HACE
--   1. Crea 12 categorías de pastelería (lo que ES el producto).
--   2. Reasigna cada producto por su NOMBRE (no por id: los id pueden no
--      coincidir entre local y prod).
--   3. Desactiva las 6 categorías-ubicación que queden vacías.
--   NO toca SKU: cada producto conserva el suyo hasta el paso 4.
--
-- PROD: @empresa = id de "Reginas - Pasteleria" en fayxzvov_erp.companies.
--   En local es 1; confirmarlo allá antes de correr. Un producto cuyo nombre
--   no esté en el mapa conserva su categoría y aparece en la verificación.
--
-- RESPALDO
--   item_category_bk_20260923 -> categorías creadas y desactivadas.
--   item_category_item_bk_20260923 -> categoría de cada producto antes.
--   El -rollback usa las dos y las borra.
-- =====================================================================

USE fayxzvov_inventory;

SET @empresa := 1;


-- 0) RESPALDO -----------------------------------------------------------
CREATE TABLE item_category_item_bk_20260923 AS
SELECT id, category_id
FROM item
WHERE companies_id = @empresa;

CREATE TABLE item_category_bk_20260923 (
    id           INT         NOT NULL PRIMARY KEY,
    accion       VARCHAR(12) NOT NULL,   -- 'creada' | 'desactivada'
    active_antes TINYINT     NULL
);


-- 1) CATEGORÍAS NUEVAS --------------------------------------------------
-- El orden fija el id, y el id es el prefijo del SKU (paso 4).
CREATE TEMPORARY TABLE tmp_categoria (
    orden  INT          NOT NULL,
    nombre VARCHAR(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL
);

INSERT INTO tmp_categoria (orden, nombre) VALUES
    ( 1, 'HARINAS Y AZÚCARES'),
    ( 2, 'AUXILIARES DE REPOSTERÍA'),
    ( 3, 'CHOCOLATES Y COBERTURAS'),
    ( 4, 'RELLENOS Y MERMELADAS'),
    ( 5, 'LÁCTEOS, GRASAS Y HUEVO'),
    ( 6, 'CREMAS Y JARABES'),
    ( 7, 'FRUTAS Y FRUTOS SECOS'),
    ( 8, 'GALLETAS Y DULCES'),
    ( 9, 'LICORES'),
    (10, 'SALADOS Y COCINA'),
    (11, 'CAFÉ'),
    (12, 'EMPAQUES');

SET @ultima_cat := (SELECT COALESCE(MAX(id), 0) FROM item_category);

INSERT INTO item_category (name, created_at, active, companies_id)
SELECT t.nombre, NOW(), 1, @empresa
FROM tmp_categoria t
WHERE NOT EXISTS (
        SELECT 1 FROM item_category c
        WHERE c.companies_id = @empresa AND c.name = t.nombre AND c.active = 1
      )
ORDER BY t.orden;

INSERT INTO item_category_bk_20260923 (id, accion, active_antes)
SELECT id, 'creada', NULL
FROM item_category
WHERE id > @ultima_cat;


-- 2) PRODUCTO -> CATEGORÍA (por nombre) ---------------------------------
CREATE TEMPORARY TABLE tmp_mapa (
    producto  VARCHAR(160) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL,
    categoria VARCHAR(120) CHARACTER SET latin1 COLLATE latin1_swedish_ci NOT NULL
);

INSERT INTO tmp_mapa (producto, categoria) VALUES
    -- Harinas y azúcares (7)
    ('FECULA DE MAIZ',               'HARINAS Y AZÚCARES'),
    ('HARINA DE ALMENDRAS',          'HARINAS Y AZÚCARES'),
    ('HARINA MAYRAN',                'HARINAS Y AZÚCARES'),
    ('AZUCAR REFINADA',              'HARINAS Y AZÚCARES'),
    ('AZUCAR MASCABADO',             'HARINAS Y AZÚCARES'),
    ('AZUCAR GLASS',                 'HARINAS Y AZÚCARES'),
    ('AZUCAR ESTANDAR',              'HARINAS Y AZÚCARES'),
    -- Auxiliares de repostería (10)
    ('POLVO PARA HORNEAR',           'AUXILIARES DE REPOSTERÍA'),
    ('LEVADURA',                     'AUXILIARES DE REPOSTERÍA'),
    ('MEJORAMIX',                    'AUXILIARES DE REPOSTERÍA'),
    ('GELATINAS',                    'AUXILIARES DE REPOSTERÍA'),
    ('CANELA EN POLVO',              'AUXILIARES DE REPOSTERÍA'),
    ('BOTE DE CANELA',               'AUXILIARES DE REPOSTERÍA'),
    ('EXTRACTO DE VAINILLA',         'AUXILIARES DE REPOSTERÍA'),
    ('VAINILLA',                     'AUXILIARES DE REPOSTERÍA'),
    ('GRANILLO DE COLORES',          'AUXILIARES DE REPOSTERÍA'),
    ('GRANILLO DE CHOCOLATE',        'AUXILIARES DE REPOSTERÍA'),
    -- Chocolates y coberturas (10)
    ('COCOA',                        'CHOCOLATES Y COBERTURAS'),
    ('CHOCOLATE CARAT',              'CHOCOLATES Y COBERTURAS'),
    ('CHOCOLATE BLANCO',             'CHOCOLATES Y COBERTURAS'),
    ('CHOCOLANTE OSCURO',            'CHOCOLATES Y COBERTURAS'),
    ('CHOCOLANTE LECHE',             'CHOCOLATES Y COBERTURAS'),
    ('CHISPA DE CHOCOLATE',          'CHOCOLATES Y COBERTURAS'),
    ('GANASHE BLANCO',               'CHOCOLATES Y COBERTURAS'),
    ('GANASHE OSCURO',               'CHOCOLATES Y COBERTURAS'),
    ('CHOCOLATE PARA DONA',          'CHOCOLATES Y COBERTURAS'),
    ('COBERTURA PARA DONA MAPLE',    'CHOCOLATES Y COBERTURAS'),
    -- Rellenos y mermeladas (12)
    ('MANGA DE PIÑA',                'RELLENOS Y MERMELADAS'),
    ('MANGA DE FRESA',               'RELLENOS Y MERMELADAS'),
    ('MANGA DE ZARZAMORA',           'RELLENOS Y MERMELADAS'),
    ('MANGA DE VAINILLA',            'RELLENOS Y MERMELADAS'),
    ('GLASSE DE FRESA',              'RELLENOS Y MERMELADAS'),
    ('MERMELADA DE FRESA',           'RELLENOS Y MERMELADAS'),
    ('MERMELADA DE ZARZAMORA',       'RELLENOS Y MERMELADAS'),
    ('CREMA DE AVELLANAS',           'RELLENOS Y MERMELADAS'),
    ('CREMA LOTUS',                  'RELLENOS Y MERMELADAS'),
    ('DULCE DE LECHE',               'RELLENOS Y MERMELADAS'),
    ('CAJETA',                       'RELLENOS Y MERMELADAS'),
    ('MIEL',                         'RELLENOS Y MERMELADAS'),
    -- Lácteos, grasas y huevo (15)
    ('LECHE PRADEL',                 'LÁCTEOS, GRASAS Y HUEVO'),
    ('LECHE LALA DESLACTOSADA',      'LÁCTEOS, GRASAS Y HUEVO'),
    ('LECHERA',                      'LÁCTEOS, GRASAS Y HUEVO'),
    ('CARNETION',                    'LÁCTEOS, GRASAS Y HUEVO'),
    ('YOGURT',                       'LÁCTEOS, GRASAS Y HUEVO'),
    ('QUESO CREMA SANTA CRUZ',       'LÁCTEOS, GRASAS Y HUEVO'),
    ('QUESO PHILADELPHIA',           'LÁCTEOS, GRASAS Y HUEVO'),
    ('QUESO AMARILLO',               'LÁCTEOS, GRASAS Y HUEVO'),
    ('QUESO MOZZARELLA',             'LÁCTEOS, GRASAS Y HUEVO'),
    ('QUESO DOBLE CREMA',            'LÁCTEOS, GRASAS Y HUEVO'),
    ('MANTEQUILLA AZTURIAS',         'LÁCTEOS, GRASAS Y HUEVO'),
    ('MARGARINA BIZCOCHO',           'LÁCTEOS, GRASAS Y HUEVO'),
    ('FEITE DANES',                  'LÁCTEOS, GRASAS Y HUEVO'),
    ('SELECTA',                      'LÁCTEOS, GRASAS Y HUEVO'),
    ('HUEVO',                        'LÁCTEOS, GRASAS Y HUEVO'),
    -- Cremas y jarabes (8)
    ('AMBIANTE',                     'CREMAS Y JARABES'),
    ('CREMA PARA BATIR BETTERCREAM', 'CREMAS Y JARABES'),
    ('DOBLE CHOCOLATE',              'CREMAS Y JARABES'),
    ('CREMA DE BAILYES',             'CREMAS Y JARABES'),
    ('JARABE 3 LECHES',              'CREMAS Y JARABES'),
    ('JARABE 3 LECHES RICHES',       'CREMAS Y JARABES'),
    ('CONCENTRADO DE JARABE 3 LECHES','CREMAS Y JARABES'),
    ('JARABE DE BAILYES',            'CREMAS Y JARABES'),
    -- Frutas y frutos secos (13)
    ('NUEZ PICADA',                  'FRUTAS Y FRUTOS SECOS'),
    ('AJONJOLI',                     'FRUTAS Y FRUTOS SECOS'),
    ('ALMENDRA FILETEADA',           'FRUTAS Y FRUTOS SECOS'),
    ('COCO',                         'FRUTAS Y FRUTOS SECOS'),
    ('CACAHUATE',                    'FRUTAS Y FRUTOS SECOS'),
    ('CEREZAS',                      'FRUTAS Y FRUTOS SECOS'),
    ('DURAZNO MITADES',              'FRUTAS Y FRUTOS SECOS'),
    ('PIÑA TROZOS',                  'FRUTAS Y FRUTOS SECOS'),
    ('PIÑA RODAJAS',                 'FRUTAS Y FRUTOS SECOS'),
    ('FRUTOS ROJOS CONGELADOS',      'FRUTAS Y FRUTOS SECOS'),
    ('FRESAS CONGELADAS',            'FRUTAS Y FRUTOS SECOS'),
    ('MANGO EN CUBITOS',             'FRUTAS Y FRUTOS SECOS'),
    ('PULPA DE MANGO',               'FRUTAS Y FRUTOS SECOS'),
    -- Galletas y dulces (5)
    ('GALLETA MARIAS',               'GALLETAS Y DULCES'),
    ('GALLETA RITZ',                 'GALLETAS Y DULCES'),
    ('GALLETA OREO',                 'GALLETAS Y DULCES'),
    ('GALLETA LOTUS',                'GALLETAS Y DULCES'),
    ('FERREROS',                     'GALLETAS Y DULCES'),
    -- Licores (4)
    ('TEQUILA',                      'LICORES'),
    ('ROMPOPE',                      'LICORES'),
    ('BRANDY',                       'LICORES'),
    ('LICOR DE BAILEYS',             'LICORES'),
    -- Salados y cocina (11)
    ('SALSA PARA PIZZA',             'SALADOS Y COCINA'),
    ('MAYONESA MEMBER`S MARK',       'SALADOS Y COCINA'),
    ('MAYONESA MCCORMICK',           'SALADOS Y COCINA'),
    ('SAL',                          'SALADOS Y COCINA'),
    ('ACEITE',                       'SALADOS Y COCINA'),
    ('JAMON',                        'SALADOS Y COCINA'),
    ('SALCHICHA',                    'SALADOS Y COCINA'),
    ('PEPERONI',                     'SALADOS Y COCINA'),
    ('ELOTE EN GRANO',               'SALADOS Y COCINA'),
    ('RAJAS',                        'SALADOS Y COCINA'),
    ('OSTIONES AHUMADOS',            'SALADOS Y COCINA'),
    -- Café (2)
    ('CAFE',                         'CAFÉ'),
    ('cafe nimbuz 500 gr',           'CAFÉ'),
    -- Empaques (26)
    ('DOMO C-85',                    'EMPAQUES'),
    ('DOMO C-95',                    'EMPAQUES'),
    ('DOMO C-105',                   'EMPAQUES'),
    ('DOMO P-32AN',                  'EMPAQUES'),
    ('DOMO P-20AN',                  'EMPAQUES'),
    ('DOMO C-15N',                   'EMPAQUES'),
    ('DOMO REBANADAS',               'EMPAQUES'),
    ('DOMO LASAÑA',                  'EMPAQUES'),
    ('DOMO 1/4 DE PLANCHA',          'EMPAQUES'),
    ('DOMO 1/2 PLANCHA',             'EMPAQUES'),
    ('DOMO CUPCAKE',                 'EMPAQUES'),
    ('DOMO BOCADILLO GD',            'EMPAQUES'),
    ('DOMO BOCADILLO CH',            'EMPAQUES'),
    ('DOMO ROSCA MED',               'EMPAQUES'),
    ('DOMO ROSCA GD',                'EMPAQUES'),
    ('DOMO ROSCA FAMILIAR',          'EMPAQUES'),
    ('DOMO CHUNCAKE',                'EMPAQUES'),
    ('BASE 15CM',                    'EMPAQUES'),
    ('BASE 20 CM',                   'EMPAQUES'),
    ('BASE 25 CM',                   'EMPAQUES'),
    ('BASE 30 CM',                   'EMPAQUES'),
    ('BASE 35 CM',                   'EMPAQUES'),
    ('BASE 40 CM',                   'EMPAQUES'),
    ('BASE 45 CM',                   'EMPAQUES'),
    ('BASE DORADA',                  'EMPAQUES'),
    ('CAJAS DE GALLETA',             'EMPAQUES');

UPDATE item i
  JOIN tmp_mapa m       ON m.producto = i.name
  JOIN item_category c  ON c.name = m.categoria AND c.companies_id = i.companies_id AND c.active = 1
   SET i.category_id = c.id
 WHERE i.companies_id = @empresa;


-- 3) DESACTIVAR LAS CATEGORÍAS-UBICACIÓN VACÍAS -------------------------
INSERT INTO item_category_bk_20260923 (id, accion, active_antes)
SELECT c.id, 'desactivada', c.active
FROM item_category c
WHERE c.companies_id = @empresa
  AND c.active = 1
  AND c.name IN ('ANAQUEL 1', 'ANAQUEL 2', 'ANAQUEL 3', 'ANAQUEL 4', 'REFRIGERADOR', 'CONGELADOR')
  AND NOT EXISTS (SELECT 1 FROM item i WHERE i.category_id = c.id);

UPDATE item_category c
  JOIN item_category_bk_20260923 bk ON bk.id = c.id AND bk.accion = 'desactivada'
   SET c.active = 0;


-- 4) VERIFICACIÓN -------------------------------------------------------
-- Esperado en local: productos 123, en_categoria_nueva 123, sin_mapa 0,
-- categorias_creadas 12, categorias_desactivadas 6.
SELECT
    COUNT(*)                                                           AS productos,
    SUM(i.category_id IN (SELECT id FROM item_category_bk_20260923 WHERE accion = 'creada')) AS en_categoria_nueva,
    SUM(NOT EXISTS (SELECT 1 FROM tmp_mapa m WHERE m.producto = i.name)) AS sin_mapa,
    (SELECT COUNT(*) FROM item_category_bk_20260923 WHERE accion = 'creada')      AS categorias_creadas,
    (SELECT COUNT(*) FROM item_category_bk_20260923 WHERE accion = 'desactivada') AS categorias_desactivadas
FROM item i
WHERE i.companies_id = @empresa;

-- Productos que no están en el mapa (en prod: revisar a mano).
SELECT i.id, i.name, c.name AS categoria_actual
FROM item i
LEFT JOIN item_category c ON c.id = i.category_id
WHERE i.companies_id = @empresa
  AND NOT EXISTS (SELECT 1 FROM tmp_mapa m WHERE m.producto = i.name);

DROP TEMPORARY TABLE tmp_mapa;
DROP TEMPORARY TABLE tmp_categoria;
