-- =============================================================================
-- Inventarios R4: Requisiciones y Surtir en el menú
-- Fecha:     29/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-23_secciones-inventarios.sql (las secciones y casillas)
--            2026-11-22_crear-fayxzvov-inventarios.sql (requisition,
--            detail_requisition, requisition_status, requisition_supply,
--            department: ya existen, no se tocan)
-- Rollback:  2026-11-29_requisiciones-surtir-rollback.sql
--
-- Las dos secciones ya tenían sus casillas; les faltaba la página. Se les da
-- su ruta, se encienden y se corrige qué hace cada casilla de Surtir: surtir
-- saca de su almacén y lo que surte entra a quien pidió cuando da «Recibí».
--
-- Orden en prod: ANTES del código (sin ruta el rail las enseña como
-- «Próximamente»). Solo UPDATE por code: se puede volver a correr.
-- =============================================================================

SET NAMES utf8mb4;

UPDATE sections SET route = 'app/inventarios/requisiciones.php', is_active = 1 WHERE code = 'inv-requisiciones';
UPDATE sections SET route = 'app/inventarios/surtir.php',        is_active = 1 WHERE code = 'inv-surtir';

UPDATE permissions p
INNER JOIN sections s          ON s.id = p.section_id
INNER JOIN type_permissions tp ON tp.id = p.type_permission_id
INNER JOIN (
              SELECT 'inv-requisiciones' AS sec, 'update' AS act, 'Edita la suya (en espera pide contraseña), la envía y da «Recibí»: lo surtido entra a su almacén.' AS txt
    UNION ALL SELECT 'inv-surtir',               'update',        'Surte: lo que sale de su almacén queda por recibir en la sucursal que pidió.'
    UNION ALL SELECT 'inv-surtir',               'cancel',        'Rechaza la requisición y revierte lo surtido que aún no reciben (pide contraseña).'
) t ON t.sec = s.code AND t.act = tp.code
SET p.description = t.txt;

-- Comprobación: las dos con su ruta y encendidas.
SELECT code, name, route, is_active FROM sections WHERE code IN ('inv-requisiciones', 'inv-surtir');
