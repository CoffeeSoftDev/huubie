-- ============================================================================
--  fayxzvov_erp — una sola collation: utf8mb4_general_ci
--
--  El esquema del tenant (companies / branches / users / roles / permissions)
--  estaba en tres collations a la vez:
--
--    · 15 tablas y 50 columnas en `utf8mb4_0900_ai_ci`  ← lo que corrige este script
--    ·  4 tablas y 10 columnas en `latin1_swedish_ci`   ← legacy, NO se toca (ver abajo)
--    ·  1 tabla  (`branches`) en `utf8mb4_general_ci`   ← la unica que estaba bien
--
--  Ademas el DEFAULT del esquema estaba en `latin1_general_ci`, asi que toda
--  tabla nueva nacia con la collation equivocada aunque el DDL fuera correcto.
--
--  ── Por que general_ci y no 0900_ai_ci ─────────────────────────────────────
--  Es la convencion de la casa (grimorios/db-rules.md §1.2). `0900_ai_ci` es el
--  default de MySQL 8 y se cuela solo en cualquier `CREATE TABLE` sin `COLLATE`
--  explicito; solo existe en MySQL 8 —no restaura en MariaDB ni en 5.7— y
--  mezclado con las bases vecinas revienta los JOIN con «Illegal mix of
--  collations».
--
--  ── Las 4 tablas latin1 se quedan como estan ───────────────────────────────
--  `perfiles`, `subsidiaries`, `udn` y `usuarios` son legacy (nombres en
--  español, anteriores al esquema actual). db-rules manda respetarlas tal cual:
--  pasar `latin1` a `utf8mb4` no es un cambio de collation sino una
--  REINTERPRETACION de bytes, y si esos datos traen UTF-8 mal guardado el
--  CONVERT TO los deja corruptos de forma permanente. Eso se audita y se migra
--  aparte, con su propia revision de mojibake.
--
--  Las FK cross-schema desde `fayxzvov_inventory` no se ven afectadas: todas
--  van por `id` (INT), y ningun JOIN del modulo compara texto entre esquemas.
--
--  Idempotente: se puede correr las veces que sea.
--  Respaldo previo en backups/backup_fayxzvov_erp_2026-09-05_antes-de-collation.sql
-- ============================================================================

USE fayxzvov_erp;

ALTER DATABASE fayxzvov_erp
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 0;

-- -- Tenant y suscripcion --
ALTER TABLE companies          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE branches           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE plans              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE subscriptions      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE payment_history    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE coupons            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE coupon_redemptions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- -- Accesos --
ALTER TABLE users              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE users_braches      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE user_sessions      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE roles              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE permissions        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE type_permissions   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- -- Menu de modulos --
ALTER TABLE modules            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE submodules         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE sections           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -- Verificacion: solo deben quedar las 4 tablas legacy en latin1_swedish_ci --
SELECT TABLE_NAME, TABLE_COLLATION
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = 'fayxzvov_erp'
   AND TABLE_COLLATION <> 'utf8mb4_general_ci';
