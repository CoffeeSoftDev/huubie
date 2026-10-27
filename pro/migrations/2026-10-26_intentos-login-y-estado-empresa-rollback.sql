-- Deshace 2026-10-26_intentos-login-y-estado-empresa.sql.
-- El enum vuelve a la errata en los mismos tres pasos, por la misma razon.

ALTER TABLE users
    DROP COLUMN login_attempts;

ALTER TABLE companies
    MODIFY COLUMN status ENUM('pending','active','suspendend','suspended','cancelled') DEFAULT 'pending';

UPDATE companies SET status = 'suspendend' WHERE status = 'suspended';

ALTER TABLE companies
    MODIFY COLUMN status ENUM('pending','active','suspendend','cancelled') DEFAULT 'pending';
