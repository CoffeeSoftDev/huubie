-- ============================================================================
--  Rollback de la migracion 18 — regresa el esquema a como estaba
--
--  Deja las 17 tablas que estaban en `utf8mb4_0900_ai_ci` tal como estaban y no
--  toca `branch` ni `cashier`, que ya venian en general_ci desde su CREATE.
--
--  ── Esto NO es una alternativa valida ──────────────────────────────────────
--  Existe solo por simetria con el resto de la carpeta: si la migracion 18
--  rompiera algo, este archivo devuelve el estado exacto de antes para poder
--  investigar. La convencion del ecosistema sigue siendo utf8mb4_general_ci en
--  todas las bases; volver a 0900_ai_ci y quedarse ahi vuelve a dejar el
--  esquema atado a MySQL 8 y a romper los JOIN contra las bases vecinas.
--
--  Si el problema no fue la collation, la salida es restaurar el dump:
--    backup/fayxzvov_facturacion-20260905-antes-de-collation.sql
--
--  Idempotente: se puede correr las veces que sea.
-- ============================================================================

USE fayxzvov_facturacion;

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE company                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE pos                      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE waiter                   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE product                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE payment_method           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE sale_status              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE sale_operation_status    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE sale                     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE detail_sale              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE detail_sale_payment      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE detail_sale_payment_card CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE deleted_sale_payment     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE virtual_ticket           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE detail_virtual_ticket    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE import_batch             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE generation_run           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE daily_sale_summary       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
