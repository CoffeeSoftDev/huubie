-- ============================================================================
--  Rollback — regresa fayxzvov_erp a como estaba
--
--  Devuelve las 15 tablas a `utf8mb4_0900_ai_ci` y el default del esquema a
--  `latin1_general_ci`. No toca `branches`, que ya estaba en general_ci, ni las
--  4 legacy en latin1, que la migracion tampoco toco.
--
--  Existe solo por si la migracion rompiera algo y hubiera que reproducir el
--  estado exacto para investigar. La convencion sigue siendo utf8mb4_general_ci:
--  quedarse en 0900_ai_ci vuelve a atar el esquema a MySQL 8.
--
--  Si el problema no fue la collation, la salida es restaurar el dump:
--    backups/backup_fayxzvov_erp_2026-09-05_antes-de-collation.sql
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_erp;

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE companies          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE plans              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE subscriptions      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE payment_history    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE coupons            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE coupon_redemptions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE users              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE users_braches      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE user_sessions      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE roles              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE permissions        CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE type_permissions   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE modules            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE submodules         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE sections           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;

ALTER DATABASE fayxzvov_erp
  DEFAULT CHARACTER SET latin1
  DEFAULT COLLATE latin1_general_ci;
