-- =====================================================================
-- Modulos de venta: Inventarios, Produccion, POS y Lealtad
-- Fecha: 31/10/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-10-31_modulos-de-venta-rollback.sql
--
-- Solo el catalogo, para armar planes y suscripciones: todavia no tienen
-- ruta ni secciones, asi que no aparecen en el menu de nadie (igual que
-- Pedidos). price: mensual sin IVA, lo que cuestan en el plan Personalizado.
--
--   Inventarios  249  los inventarios del POS; se vende tambien por separado
--   Produccion   299  ordenes de produccion, lo producido de verdad y mermas
--   POS          349  punto de venta
--   Lealtad      149  tarjetas de lealtad para fidelizar clientes
--
-- Empresarial (todos los modulos) los incluye solo; Starter y Pro no.
-- Se buscan por code: se puede volver a correr.
-- =====================================================================

INSERT INTO modules (name, code, icon, description, price, orden, is_active, created_at)
SELECT 'Inventarios', 'inventarios', 'package',
       'Los inventarios del punto de venta: existencias, entradas y salidas. También se vende por separado.',
       249.00, 2, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'inventarios');

INSERT INTO modules (name, code, icon, description, price, orden, is_active, created_at)
SELECT 'Producción', 'produccion', 'factory',
       'Órdenes de producción, lo que realmente se produjo y las mermas.',
       299.00, 3, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'produccion');

INSERT INTO modules (name, code, icon, description, price, orden, is_active, created_at)
SELECT 'POS', 'pos', 'shopping-cart',
       'Punto de venta: cobra en mostrador, tickets y cortes de caja.',
       349.00, 4, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'pos');

INSERT INTO modules (name, code, icon, description, price, orden, is_active, created_at)
SELECT 'Lealtad', 'lealtad', 'heart-handshake',
       'Tarjetas de lealtad para premiar y fidelizar a tus clientes.',
       149.00, 5, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'lealtad');
