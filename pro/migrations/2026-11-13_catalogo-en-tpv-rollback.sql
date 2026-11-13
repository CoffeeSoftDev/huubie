-- =============================================================================
-- Rollback de 2026-11-13_catalogo-en-tpv.sql
-- Fecha:  13/11/2026
-- Deja Catalogo en su submodulo pos-catalogo (orden 1) y TPV como estaba:
-- Ventas 1, Pedidos 2, Calendario 3, Clientes 4, Puntos 5, Ecommerce 6, WhatsApp 7.
-- =============================================================================

-- 1) El submodulo Catalogo vuelve a encenderse.
UPDATE submodules SET is_active = 1 WHERE code = 'pos-catalogo';

-- 2) Catalogo regresa a su submodulo.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-catalogo'
SET s.submodule_id = sm.id,
    s.orden        = 1
WHERE s.code = 'catalogo';

-- 3) Las de TPV suben un lugar.
UPDATE sections
SET orden = CASE code
        WHEN 'pos-calendario' THEN 3
        WHEN 'pos-clientes'   THEN 4
        WHEN 'pos-puntos'     THEN 5
        WHEN 'pos-ecommerce'  THEN 6
        WHEN 'pos-whatsapp'   THEN 7
    END
WHERE code IN ('pos-calendario', 'pos-clientes', 'pos-puntos', 'pos-ecommerce', 'pos-whatsapp');
