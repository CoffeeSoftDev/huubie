-- =============================================================================
-- Rollback de 2026-11-27_vendido-en-ventas.sql: «Vendido» vuelve a ser
-- «Historial», en Administración (lugar 3), y el menú queda como el 15/11/2026.
-- Busca por code, con valores absolutos: se puede volver a correr.
-- Los permisos del paso 4 (show/print de pos-historial para quien vende) NO
-- se quitan: no se sabe cuáles ya estaban, y son la regla del 14/11 (A9).
-- =============================================================================

UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-administracion'
SET s.name         = 'Historial',
    s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.orden        = 3
WHERE s.code = 'pos-historial';

UPDATE sections SET orden = CASE code
    WHEN 'pos-pedidos'    THEN 2
    WHEN 'pos-calendario' THEN 3
    WHEN 'pos-clientes'   THEN 4
    WHEN 'pos-tickets'    THEN 5
    WHEN 'pos-ecommerce'  THEN 6
    WHEN 'pos-whatsapp'   THEN 4
END
WHERE code IN ('pos-pedidos', 'pos-calendario', 'pos-clientes', 'pos-tickets', 'pos-ecommerce', 'pos-whatsapp');

SELECT sm.code AS submodule, s.orden, s.code AS section, s.name, s.route
FROM submodules sm
INNER JOIN modules m ON m.id = sm.module_id AND m.code = 'pedidos'
INNER JOIN sections s ON s.submodule_id = sm.id
WHERE sm.is_active = 1
ORDER BY sm.orden, sm.id, s.orden, s.id;
