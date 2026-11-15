-- =============================================================================
-- Rollback de 2026-11-14_submodulos-administracion-y-punto-de-venta.sql
-- Fecha:  14/11/2026
-- Deja el modulo «Punto de venta» con TPV y Reportes como estaban:
--   TPV       Ventas 1, Pedidos 2, Catalogo 3, Calendario 4, Clientes 5,
--             Puntos 6, Ecommerce 7, WhatsApp 8
--   Reportes  Dashboard 1, Tickets/Cierre 2, Historial 3
-- Administración y Punto de venta quedan vacios y se apagan (no se borran).
-- =============================================================================

-- 1) TPV y Reportes vuelven a encenderse.
UPDATE submodules SET is_active = 1 WHERE code IN ('pos-tpv', 'pos-reportes');

-- 2) Las secciones de TPV regresan a el.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-tpv'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = CASE s.code
        WHEN 'pos-ventas'     THEN 1
        WHEN 'pos-pedidos'    THEN 2
        WHEN 'catalogo'       THEN 3
        WHEN 'pos-calendario' THEN 4
        WHEN 'pos-clientes'   THEN 5
        WHEN 'pos-puntos'     THEN 6
        WHEN 'pos-ecommerce'  THEN 7
        WHEN 'pos-whatsapp'   THEN 8
    END
WHERE s.code IN ('pos-ventas', 'pos-pedidos', 'catalogo', 'pos-calendario',
                 'pos-clientes', 'pos-puntos', 'pos-ecommerce', 'pos-whatsapp');

-- 3) Y las de Reportes.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-reportes'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = CASE s.code
        WHEN 'pos-dashboard' THEN 1
        WHEN 'pos-tickets'   THEN 2
        WHEN 'pos-historial' THEN 3
    END
WHERE s.code IN ('pos-dashboard', 'pos-tickets', 'pos-historial');

-- 4) Los dos nuevos quedan sin secciones: se apagan.
UPDATE submodules SET is_active = 0 WHERE code IN ('pos-administracion', 'pos-punto-de-venta');
