-- =====================================================================
-- ROLLBACK :: Unidades de medida: borrar las que no se usan
-- Fecha: 29/09/2026
-- BD:    fayxzvov_inventory
--
-- Regresa las unidades borradas con su mismo id desde el respaldo y lo borra.
-- Correr ANTES del -rollback de 2026-09-29_unidades-unificar.sql si se
-- regresan las dos.
-- =====================================================================

INSERT INTO fayxzvov_inventory.unit (id, code, name, created_at, active, companies_id)
SELECT id, code, name, created_at, active, companies_id
FROM fayxzvov_inventory.bk_unit_unused_20260929;

DROP TABLE fayxzvov_inventory.bk_unit_unused_20260929;
