-- =====================================================================
-- Rollback de 2026-11-13_alta-en-linea-y-stripe.sql
--
-- Quita las columnas y la tabla. NO borra las empresas que se dieron de alta
-- en linea ni cancela nada en Stripe: eso se hace a mano, en Facturacion y en
-- el panel de Stripe.
-- =====================================================================

DROP TABLE IF EXISTS stripe_events;

ALTER TABLE payment_history DROP INDEX payment_history_stripe_unique, DROP COLUMN stripe_id;

ALTER TABLE subscriptions DROP INDEX stripe_subscription_id, DROP COLUMN stripe_subscription_id;

ALTER TABLE companies DROP COLUMN stripe_customer_id, DROP COLUMN setup_done_at;

ALTER TABLE users DROP COLUMN last_login_at, DROP COLUMN first_login_at;
