-- ============================================================================
--  Migracion 18 — una sola collation para todo el esquema: utf8mb4_general_ci
--
--  El DDL del modulo (ddl-facturacion.sql) siempre declaro
--  `utf8mb4 / utf8mb4_general_ci`, pero la base viva quedo mezclada: 17 de las
--  19 tablas —y 64 columnas de texto— estan en `utf8mb4_0900_ai_ci`, la
--  collation por omision de MySQL 8. Se colo por la puerta de atras: las tablas
--  nacieron de un dump restaurado en un servidor cuyo default es 0900_ai_ci, y
--  el CREATE TABLE sin COLLATE explicito hereda el default del servidor, no el
--  de la carpeta sql/.
--
--  ── Por que general_ci y no 0900_ai_ci ─────────────────────────────────────
--  Es la convencion de la casa: TODAS las bases del ecosistema se crean en
--  utf8mb4_general_ci. La razon practica es que 0900_ai_ci solo existe en
--  MySQL 8: un esquema marcado asi no se restaura en MariaDB ni en un MySQL 5.7,
--  y cualquier JOIN contra una base vecina —que si esta en general_ci— revienta
--  con «Illegal mix of collations». Ese es el costo real de mezclar.
--
--  ── Que hace ────────────────────────────────────────────────────────────────
--  Fija el default del esquema y convierte las 19 tablas. `branch` y `cashier`
--  ya estaban bien; se incluyen igual para que la lista sea el esquema completo
--  y no haya que recordar cuales faltaban.
--
--  Sin FKs sobre columnas de texto, sin vistas, sin triggers y sin rutinas: la
--  conversion no arrastra nada. Aun asi se apagan las FKs mientras dura, que es
--  lo que se hace siempre en un CONVERT TO masivo.
--
--  Idempotente: se puede correr las veces que sea.
--  Respaldo previo en backup/fayxzvov_facturacion-20260905-antes-de-collation.sql
--  Rollback en migra-18-collation-general-ci-rollback.sql
-- ============================================================================

USE fayxzvov_facturacion;

ALTER DATABASE fayxzvov_facturacion
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 0;

-- -- Catalogos --
ALTER TABLE company                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE branch                   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE pos                      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE cashier                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE waiter                   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE product                  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE payment_method           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE sale_status              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE sale_operation_status    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- -- Transacciones y detalles --
ALTER TABLE sale                     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE detail_sale              CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE detail_sale_payment      CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE detail_sale_payment_card CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE deleted_sale_payment     CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE virtual_ticket           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE detail_virtual_ticket    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- -- Bitacoras y resumen --
ALTER TABLE import_batch             CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE generation_run           CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE daily_sale_summary       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- -- Verificacion: ambas consultas deben regresar 0 filas --
SELECT TABLE_NAME, TABLE_COLLATION
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = 'fayxzvov_facturacion'
   AND TABLE_COLLATION <> 'utf8mb4_general_ci';

SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = 'fayxzvov_facturacion'
   AND COLLATION_NAME IS NOT NULL
   AND COLLATION_NAME <> 'utf8mb4_general_ci';
