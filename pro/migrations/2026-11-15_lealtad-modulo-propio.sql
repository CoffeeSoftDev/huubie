-- =============================================================================
-- Lealtad, modulo propio: Puntos sale de «Punto de venta › Administración»
-- y pasa a ser «Lealtad › Tarjetas»
-- Fecha:     15/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere:  2026-11-15_puntos-whatsapp-en-administracion.sql
--            el modulo `lealtad` (id 6 en local) en el catalogo de modulos
--            la carpeta app/lealtad/ ya subida al servidor
-- Rollback:  2026-11-15_lealtad-modulo-propio-rollback.sql
--
-- Antes:   Punto de venta › Administración: Catalogo 1, Dashboard 2,
--          Historial 3, Puntos 4, WhatsApp 5
--          Lealtad: sin secciones, sin ruta
-- Despues: Punto de venta › Administración: Catalogo 1, Dashboard 2,
--          Historial 3, WhatsApp 4
--          Lealtad (route app/lealtad): Tarjetas 1, suelta (sin submodulo)
--
-- El code no cambia: sigue siendo pos-puntos. Los permisos van por
-- section_id: no se tocan, el Dueño los conserva.
-- Desde ahora la seccion la abre solo la empresa con Lealtad en su plan
-- (Plan::allows mira el modulo de la seccion). Hoy: Reginas si, CoffeeSoft no.
--
-- Solo filas de datos. Busca por code, con valores absolutos: se puede volver
-- a correr.
-- =============================================================================

-- 1) La seccion, al modulo Lealtad, suelta y con su nombre nuevo.
UPDATE sections s
INNER JOIN modules m ON m.code = 'lealtad'
SET s.module_id    = m.id,
    s.submodule_id = NULL,
    s.name         = 'Tarjetas',
    s.route        = 'app/lealtad/tarjetas.php',
    s.orden        = 1
WHERE s.code = 'pos-puntos';

-- 2) La tarjeta de Lealtad en Inicio entra por la carpeta (su index.php es la puerta).
UPDATE modules SET route = 'app/lealtad' WHERE code = 'lealtad';

-- 3) WhatsApp sube un lugar en Administración (queda sin hueco).
UPDATE sections SET orden = 4 WHERE code = 'pos-whatsapp';

-- Comprobacion: Lealtad y el menu de Punto de venta, por submodulo y en orden.
SELECT m.code AS module, m.route AS module_route, sm.code AS submodule,
       s.orden, s.code AS section, s.name, s.route
FROM modules m
INNER JOIN sections s ON s.module_id = m.id
LEFT JOIN submodules sm ON sm.id = s.submodule_id
WHERE m.code IN ('lealtad', 'pedidos')
ORDER BY m.code, sm.orden, sm.id, s.orden, s.id;
