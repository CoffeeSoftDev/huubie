-- =====================================================================
-- Rollback de 2026-11-06_crear-fayxzvov-pos.sql
-- Fecha: 06/11/2026
--
-- ALTO: borra la base COMPLETA, con todo lo que se haya capturado o
-- migrado en ella (ventas, pagos, turnos, cierres). No hay vuelta atras.
-- Respalda antes:  mysqldump fayxzvov_pos > fayxzvov_pos_bk_AAAAMMDD.sql
--
-- fayxzvov_reginas no se toca en ninguno de los dos sentidos.
-- =====================================================================

DROP DATABASE IF EXISTS `fayxzvov_pos`;
