-- =============================================================================
-- Rollback de 2026-11-29_requisiciones-surtir.sql
-- Fecha:  29/11/2026
-- BD:     la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Requisiciones y Surtir vuelven a «Próximamente» (sin ruta, apagadas) y sus
-- casillas a los textos del 23/11. Las requisiciones capturadas se quedan en
-- fayxzvov_inventarios. Correr DESPUÉS de regresar el código.
-- =============================================================================

SET NAMES utf8mb4;

UPDATE sections SET route = NULL, is_active = 0 WHERE code IN ('inv-requisiciones', 'inv-surtir');

UPDATE permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
INNER JOIN (
              SELECT 'inv-requisiciones' AS sec, 'update' AS act, 'Corrige el borrador y da «Recibí».' AS txt
    UNION ALL SELECT 'inv-surtir',               'update',        'Surte: descuenta de la Matriz y entra a quien pidió.'
    UNION ALL SELECT 'inv-surtir',               'cancel',        'Rechaza la requisición.'
) t ON t.sec = s.code AND t.act = tp.code
SET p.description = t.txt;
