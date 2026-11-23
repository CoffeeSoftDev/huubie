-- =====================================================================
-- Rollback de 2026-11-22_crear-fayxzvov-inventarios.sql
-- Fecha: 22/11/2026
--
-- BORRA LA BASE COMPLETA fayxzvov_inventarios (29 tablas, la vista y TODOS
-- sus datos: entradas, salidas, stock, conteos). No toca fayxzvov_app ni
-- fayxzvov_pos: las llaves que salen de aqui hacia alla se van con la base.
-- Sacar respaldo antes si ya tiene datos reales.
-- =====================================================================

-- 1. Revision previa: cuanto se va a borrar.
SELECT table_name, table_rows
  FROM information_schema.tables
 WHERE table_schema = 'fayxzvov_inventarios'
 ORDER BY table_name;

-- 2. Borrar.
DROP DATABASE IF EXISTS `fayxzvov_inventarios`;
