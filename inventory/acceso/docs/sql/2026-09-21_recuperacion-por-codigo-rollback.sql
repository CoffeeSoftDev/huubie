-- =====================================================================
-- ROLLBACK :: Recuperación de contraseña por correo
-- Fecha: 21/09/2026
-- BD:    fayxzvov_erp
--
-- Quita las tres columnas del código de 6 dígitos. No se pierde nada de la
-- cuenta: el código es de un solo uso y la contraseña vive en `password`.
--
-- OJO: con esto corrido, inventory/recuperar.php deja de funcionar
--   (mdl-access.php consulta reset_code / reset_expires / reset_tries).
-- =====================================================================

ALTER TABLE fayxzvov_erp.users
    DROP COLUMN reset_code,
    DROP COLUMN reset_expires,
    DROP COLUMN reset_tries;
