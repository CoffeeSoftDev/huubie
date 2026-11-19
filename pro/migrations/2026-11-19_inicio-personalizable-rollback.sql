-- =============================================================================
-- Rollback de 2026-11-19_inicio-personalizable.sql
-- Fecha:     19/11/2026
-- BD:        la del .env de pro (DB_NAME, hoy fayxzvov_app)
--
-- Borra el catalogo de tarjetas y el acomodo que cada dueño guardo. Antes de
-- correrlo, regresa app/home y app/configuracion a la version anterior: sin
-- estas tablas el inicio del dueño se queda sin tarjetas.
-- =============================================================================

DROP TABLE IF EXISTS user_home_widgets;
DROP TABLE IF EXISTS home_widgets;
