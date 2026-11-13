-- =====================================================================
-- Alta en linea: registro desde la pagina de precios, cobro con Stripe y
-- configuracion de la empresa en el primer ingreso
-- Fecha: 13/11/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Requiere: 2026-11-12_home-planes-de-ejemplo-y-capital-humano.sql
-- Rollback: 2026-11-13_alta-en-linea-y-stripe-rollback.sql
--
--   users.first_login_at            la primera vez que entro al sistema. NULL =
--                                   nunca ha entrado. La escribe el login una
--                                   sola vez (auth/ctrl/ctrl-auth.php).
--   users.last_login_at             su ingreso mas reciente.
--   companies.setup_done_at         cuando el dueño termino de completar los
--                                   datos de su empresa (app/configurar). NULL
--                                   = pendiente: se le pide en su primer
--                                   ingreso y despues solo se le recuerda en
--                                   la campana de la barra.
--   companies.stripe_customer_id    el cliente de Stripe (cus_...).
--   subscriptions.stripe_subscription_id   la suscripcion de Stripe (sub_...).
--   payment_history.stripe_id       la factura o sesion de Stripe que origino
--                                   el pago. UNICA: el mismo cobro llega por el
--                                   webhook y por la pagina de regreso, y solo
--                                   debe quedar una vez.
--   stripe_events                   lo que ya se atendio (eventos del webhook y
--                                   el correo de bienvenida): Stripe reintenta
--                                   y cada cosa se hace una sola vez.
--
-- Las empresas y usuarios que ya existian se dan por configurados y por
-- ingresados: a ellos no se les pide nada.
--
-- Se puede volver a correr: cada cambio revisa antes si ya esta hecho.
-- =====================================================================

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'first_login_at') > 0, 'DO 0',
              'ALTER TABLE users
                  ADD COLUMN first_login_at DATETIME NULL DEFAULT NULL AFTER login_attempts,
                  ADD COLUMN last_login_at  DATETIME NULL DEFAULT NULL AFTER first_login_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @nuevo = (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'setup_done_at') = 0;

SET @sql = IF(@nuevo = 0, 'DO 0',
              'ALTER TABLE companies
                  ADD COLUMN setup_done_at      DATETIME NULL DEFAULT NULL AFTER status,
                  ADD COLUMN stripe_customer_id VARCHAR(64) NULL DEFAULT NULL AFTER setup_done_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Solo al crear las columnas: lo que ya existia no tiene nada pendiente.
SET @sql = IF(@nuevo = 0, 'DO 0', 'UPDATE companies SET setup_done_at = COALESCE(created_at, NOW())');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@nuevo = 0, 'DO 0', 'UPDATE users SET first_login_at = COALESCE(created_at, NOW()) WHERE first_login_at IS NULL');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'stripe_subscription_id') > 0, 'DO 0',
              'ALTER TABLE subscriptions
                  ADD COLUMN stripe_subscription_id VARCHAR(64) NULL DEFAULT NULL AFTER external_reference,
                  ADD KEY stripe_subscription_id (stripe_subscription_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_history' AND COLUMN_NAME = 'stripe_id') > 0, 'DO 0',
              'ALTER TABLE payment_history
                  ADD COLUMN stripe_id VARCHAR(80) NULL DEFAULT NULL AFTER gateway,
                  ADD UNIQUE KEY payment_history_stripe_unique (stripe_id)');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

CREATE TABLE IF NOT EXISTS stripe_events (
    id         VARCHAR(120) NOT NULL COMMENT 'evt_... del webhook, o una llave propia (welcome:<suscripcion>)',
    type       VARCHAR(80) NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
