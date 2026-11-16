-- =============================================================================
-- Puntos y WhatsApp pasan de «Punto de venta» a «Administración», y la
-- tarjeta «Punto de venta» se llama «Ventas» y va primero
-- Fecha:     15/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-14_submodulos-administracion-y-punto-de-venta.sql
-- Rollback:  2026-11-15_puntos-whatsapp-en-administracion-rollback.sql
--
-- Antes:  1 Administración  Catalogo 1, Dashboard 2, Historial 3
--         2 Punto de venta  Ventas 1, Pedidos 2, Calendario 3, Clientes 4,
--                           Tickets/Cierre 5, Puntos 6, Ecommerce 7, WhatsApp 8
-- Despues 1 Ventas          Ventas 1, Pedidos 2, Calendario 3, Clientes 4,
--                           Tickets/Cierre 5, Ecommerce 6
--         2 Administración  Catalogo 1, Dashboard 2, Historial 3, Puntos 4,
--                           WhatsApp 5
-- El submodulo cambia de nombre, no de code: sigue siendo pos-punto-de-venta.
-- El modulo (code pedidos) se sigue llamando «Punto de venta».
--
-- Solo filas de datos. Codes, rutas y permisos de las secciones no se tocan.
-- Busca por code, con valores absolutos: se puede volver a correr.
-- =============================================================================

-- 1) Puntos y WhatsApp, al final de Administración.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-administracion'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = CASE s.code
        WHEN 'pos-puntos'   THEN 4
        WHEN 'pos-whatsapp' THEN 5
    END
WHERE s.code IN ('pos-puntos', 'pos-whatsapp');

-- 2) Ecommerce sube un lugar en Punto de venta (queda sin hueco).
UPDATE sections SET orden = 6 WHERE code = 'pos-ecommerce';

-- 3) Las tarjetas: primero Ventas, despues Administración.
UPDATE submodules SET name = 'Ventas', orden = 1 WHERE code = 'pos-punto-de-venta';
UPDATE submodules SET orden = 2 WHERE code = 'pos-administracion';

-- Comprobacion: el menu del modulo, por submodulo y en orden.
SELECT sm.code AS submodule, s.orden, s.code AS section, s.route
FROM submodules sm
INNER JOIN modules m ON m.id = sm.module_id AND m.code = 'pedidos'
INNER JOIN sections s ON s.submodule_id = sm.id
WHERE sm.is_active = 1
ORDER BY sm.orden, sm.id, s.orden, s.id;
