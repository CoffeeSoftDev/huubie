-- =============================================================================
-- Rollback: Tienda en linea (2026-11-15_tienda-en-linea.sql)
-- BD:        fayxzvov_pos
--
-- Borra las dos tablas. Las ventas que entraron por la tienda NO se borran:
-- siguen en sale (tipo 4 las no aceptadas, tipo 1 las aceptadas); solo se
-- pierde el dato de origen (telefono escrito, entrega, pago, IP).
-- Bajar primero el codigo: sin las tablas falla la pagina Tienda en linea.
-- =============================================================================

DROP TABLE IF EXISTS fayxzvov_pos.online_order;
DROP TABLE IF EXISTS fayxzvov_pos.online_store;

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME IN ('online_store', 'online_order');
