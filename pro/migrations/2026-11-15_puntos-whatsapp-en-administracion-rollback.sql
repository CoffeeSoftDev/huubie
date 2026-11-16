-- =============================================================================
-- Rollback de 2026-11-15_puntos-whatsapp-en-administracion.sql
-- Fecha:  15/11/2026
-- Regresa Puntos y WhatsApp a «Punto de venta», como los dejo la migra del 14/11:
--   Punto de venta  Ventas 1, Pedidos 2, Calendario 3, Clientes 4,
--                   Tickets/Cierre 5, Puntos 6, Ecommerce 7, WhatsApp 8
-- y las tarjetas a su nombre y orden de entonces: Administración 1,
-- Punto de venta 2.
-- =============================================================================

UPDATE submodules SET orden = 1 WHERE code = 'pos-administracion';
UPDATE submodules SET name = 'Punto de venta', orden = 2 WHERE code = 'pos-punto-de-venta';

UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-punto-de-venta'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = CASE s.code
        WHEN 'pos-puntos'    THEN 6
        WHEN 'pos-ecommerce' THEN 7
        WHEN 'pos-whatsapp'  THEN 8
    END
WHERE s.code IN ('pos-puntos', 'pos-ecommerce', 'pos-whatsapp');
