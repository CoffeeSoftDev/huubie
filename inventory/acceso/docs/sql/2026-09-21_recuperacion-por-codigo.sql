-- =====================================================================
-- Recuperación de contraseña por correo :: el código de 6 dígitos
-- Fecha: 21/09/2026
-- BD:    fayxzvov_erp
--
-- QUÉ AGREGA
--   Tres columnas en `users` para el código que se manda al correo cuando
--   alguien no puede entrar (inventory/recuperar.php):
--
--     reset_code      el código, HASHEADO con bcrypt. NULL = no hay ninguno.
--     reset_expires   hasta cuándo vale. NULL = no hay ninguno vigente.
--     reset_tries     cuántas veces se tecleó mal. Vuelve a 0 con cada envío.
--
-- PORTADO DE erp-pro/pro (2026-09-11_recuperacion-por-codigo.sql), con dos
-- diferencias: allá el código se reciclaba en la columna password2 y aquí
-- lleva la suya, y aquí solo se manda por correo (users no guarda teléfono).
--
-- POR QUÉ NO SE TOCA users.password AL PEDIR UN CÓDIGO
--   El acceso viejo SUSTITUÍA la contraseña por una temporal: cualquiera que
--   supiera tu correo podía dejarte fuera sin leer el mensaje. Con el código
--   aparte, `password` solo cambia cuando su dueño escribe la nueva.
--
-- POR QUÉ CADUCA Y SE CUENTAN LOS INTENTOS
--   Son seis dígitos: un millón de combinaciones, que sin tope se prueban en
--   una tarde. Con 15 minutos de vigencia y 5 intentos la ventana son 5 tiros
--   entre un millón. Las dos cifras viven en ctrl-access.php
--   (RESET_MINUTES y RESET_MAX_TRIES), no aquí.
--
-- POR QUÉ EN `users` Y NO EN UNA TABLA APARTE
--   Es estado de la cuenta, no un historial: solo puede haber un código
--   vigente por persona y el anterior deja de importar en cuanto se manda otro.
--
-- NO SE REUSARON setup_token / token_expires: esas dos son de la invitación
--   al dar de alta al usuario. Compartirlas haría que pedir un código
--   invalidara una invitación pendiente, y al revés.
--
-- IDEMPOTENTE: no. MySQL 5.7 no tiene ADD COLUMN IF NOT EXISTS; si ya se
--   corrió, el ALTER falla con "Duplicate column name" y no hay nada que
--   arreglar. Revertir con el archivo -rollback.
-- =====================================================================


-- 1) LAS COLUMNAS --------------------------------------------------------
ALTER TABLE fayxzvov_erp.users
    ADD COLUMN reset_code    TEXT     NULL DEFAULT NULL AFTER token_expires,
    ADD COLUMN reset_expires DATETIME NULL DEFAULT NULL AFTER reset_code,
    ADD COLUMN reset_tries   INT(11)  NOT NULL DEFAULT 0 AFTER reset_expires;


-- 2) VERIFICACIÓN --------------------------------------------------------
SHOW COLUMNS FROM fayxzvov_erp.users LIKE 'reset_%';
