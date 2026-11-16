-- =============================================================================
-- Rollback de 2026-11-15_lealtad-modulo-propio.sql
-- Fecha:  15/11/2026
-- Regresa Tarjetas a «Punto de venta › Administración» como Puntos, como la
-- dejo la migra puntos-whatsapp-en-administracion:
--   Catalogo 1, Dashboard 2, Historial 3, Puntos 4, WhatsApp 5
-- y deja Lealtad sin ruta.
--
-- Ojo: app/order/puntos.php hoy solo redirige a app/lealtad/. Tras este
-- rollback la ruta vieja manda a Lealtad, que ya no tiene la seccion: el
-- usuario cae en su inicio. Revertir tambien el codigo (puntos.php como pagina).
-- =============================================================================

UPDATE sections s
INNER JOIN submodules sm ON sm.code = 'pos-administracion'
SET s.module_id    = sm.module_id,
    s.submodule_id = sm.id,
    s.name         = 'Puntos',
    s.route        = 'app/order/puntos.php',
    s.orden        = 4
WHERE s.code = 'pos-puntos';

UPDATE sections SET orden = 5 WHERE code = 'pos-whatsapp';

UPDATE modules SET route = NULL WHERE code = 'lealtad';
