-- =====================================================================
-- Quitar la sección "Solicitudes" del menú
-- Fecha: 13/10/2026
-- BD:    fayxzvov_erp
--
-- sections     apaga Solicitudes (operacion/almacen/solicitudes.php). La
--              pantalla se retiró: lo que pide cada sucursal vive ahora en la
--              pestaña "Mis pedidos" de Compras (ordenes.php).
-- permissions  no se tocan; con la sección apagada el menú ya no la muestra.
--
-- Idempotente. El -rollback la vuelve a encender.
-- =====================================================================

UPDATE fayxzvov_erp.sections
   SET is_active = 0
 WHERE route = 'operacion/almacen/solicitudes.php';

-- Verificación: is_active = 0.
-- SELECT id, name, route, is_active
--   FROM fayxzvov_erp.sections
--  WHERE route = 'operacion/almacen/solicitudes.php';
