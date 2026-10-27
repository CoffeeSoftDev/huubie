-- =====================================================================
-- Bloqueo por intentos fallidos y errata del estado de empresa
-- Fecha: 26/10/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-10-26_intentos-login-y-estado-empresa-rollback.sql
--
-- 1. users.login_attempts
--    Contraseñas equivocadas seguidas. La suma auth/ctrl/ctrl-auth.php en
--    cada intento fallido y la deja en 0 un login correcto o recuperar la
--    contraseña. Con 6 (MAX_ATTEMPTS del ctrl) la cuenta queda bloqueada y
--    solo se abre recuperando la contraseña.
--
-- 2. companies.status decia 'suspendend'
--    Se agrega el valor bueno, se pasan las filas y despues se quita el malo.
--    En un solo MODIFY, MySQL en modo estricto rechaza el cambio si alguna
--    fila trae la errata.
-- =====================================================================

ALTER TABLE users
    ADD COLUMN login_attempts INT NOT NULL DEFAULT 0 AFTER reset_tries;

ALTER TABLE companies
    MODIFY COLUMN status ENUM('pending','active','suspendend','suspended','cancelled') DEFAULT 'pending';

UPDATE companies SET status = 'suspended' WHERE status = 'suspendend';

ALTER TABLE companies
    MODIFY COLUMN status ENUM('pending','active','suspended','cancelled') DEFAULT 'pending';
