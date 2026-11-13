-- =============================================================================
-- Catalogo pasa al submodulo TPV, justo despues de Pedidos
-- Fecha:     13/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-09_modulos-pos-h02.sql (submodulos pos-tpv y pos-catalogo)
-- Rollback:  2026-11-13_catalogo-en-tpv-rollback.sql
--
-- Antes:  POS > TPV       Ventas 1, Pedidos 2, Calendario 3 ... WhatsApp 7
--         POS > Catalogo  Catalogo 1   (en el menu empataba con Ventas)
-- Despues POS > TPV       Ventas 1, Pedidos 2, Catalogo 3, Calendario 4 ... WhatsApp 8
--         El submodulo pos-catalogo queda vacio y se apaga (no se borra).
--
-- Solo filas de datos: no cambia estructura. Rutas y permisos no se tocan.
-- Valores absolutos y busqueda por code: se puede volver a correr.
-- =============================================================================

-- 1) Las de TPV desde Calendario bajan un lugar.
UPDATE sections
SET orden = CASE code
        WHEN 'pos-calendario' THEN 4
        WHEN 'pos-clientes'   THEN 5
        WHEN 'pos-puntos'     THEN 6
        WHEN 'pos-ecommerce'  THEN 7
        WHEN 'pos-whatsapp'   THEN 8
    END
WHERE code IN ('pos-calendario', 'pos-clientes', 'pos-puntos', 'pos-ecommerce', 'pos-whatsapp');

-- 2) Catalogo entra a TPV en el lugar 3.
UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-tpv'
SET s.submodule_id = sm.id,
    s.orden        = 3
WHERE s.code = 'catalogo';

-- 3) El submodulo Catalogo queda sin secciones: se apaga.
UPDATE submodules SET is_active = 0 WHERE code = 'pos-catalogo';

-- Comprobacion: Catalogo con orden 3 en TPV y pos-catalogo en 0.
SELECT s.code, sm.code AS submodule, s.orden
FROM sections s
LEFT JOIN submodules sm ON sm.id = s.submodule_id
WHERE sm.code IN ('pos-tpv', 'pos-catalogo') OR s.code = 'catalogo'
ORDER BY s.orden, s.id;

SELECT code, is_active FROM submodules WHERE code IN ('pos-tpv', 'pos-catalogo');
