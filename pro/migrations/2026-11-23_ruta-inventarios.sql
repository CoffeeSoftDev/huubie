-- =============================================================================
-- Inventarios se abre desde el inicio y el rail
-- Fecha:     23/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback:  2026-11-23_ruta-inventarios-rollback.sql
--
-- El modulo `inventarios` (id 3) tenia route NULL: el inicio lo pintaba como
-- «Próximamente» y no dejaba entrar. app/inventarios/index.php revisa sesion y
-- plan, y manda a la plantilla (templates/inventarios.html).
--
-- Orden en prod: DESPUES de subir app/inventarios/ (sin la carpeta, la tarjeta
-- daria 404). Solo cambia una fila del menu; no toca estructura.
-- Va por code y con la ruta vacia: se puede volver a correr.
-- =============================================================================

UPDATE modules
SET route = 'app/inventarios'
WHERE code = 'inventarios'
  AND (route IS NULL OR route = '');

-- Comprobacion: debe salir la fila con app/inventarios.
SELECT id, code, route, is_active FROM modules WHERE code = 'inventarios';
