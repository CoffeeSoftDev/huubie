-- =====================================================================
-- Vincular a mano las 32 llaves foraneas de fayxzvov_pos -> fayxzvov_app
-- Fecha: 07/11/2026
--
-- 2026-11-06_crear-fayxzvov-pos.sql YA las crea. Este archivo es para
-- hacerlo a mano, paso por paso: para volver a vincular, o si fayxzvov_pos
-- se creo antes que fayxzvov_app.
--
-- COMO SE CORRE: un bloque a la vez (en Navicat: selecciona el bloque y
-- "Ejecutar seleccion"). No lo corras completo de un jalon: el PASO 1 y el
-- PASO 4 son consultas que hay que leer.
--
-- Los nombres (sale_ibfk_1, ...) son los mismos que pone el script de
-- creacion, para que los dos archivos no se contradigan.
--
-- Reglas:
--   company_id -> companies  RESTRICT: no deja borrar una empresa con datos.
--   branch_id  -> branches   RESTRICT: no deja borrar una sucursal con datos.
--   *_user_id  -> users      SET NULL: si se borra el usuario, el registro
--                            se queda, solo sin quien lo firmo.
--   Las 32 llevan ON UPDATE CASCADE.
-- =====================================================================

SET NAMES utf8mb4;


-- ---------------------------------------------------------------------
-- PASO 0: REQUISITOS
-- Debe salir 3 filas: int(11) e InnoDB. El tipo tiene que ser IGUAL al de
-- las columnas de fayxzvov_pos (int(11) con signo), si no: errno 150.
-- ---------------------------------------------------------------------

SELECT c.TABLE_NAME, c.COLUMN_TYPE, t.ENGINE
  FROM information_schema.COLUMNS c
  JOIN information_schema.TABLES t
    ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
 WHERE c.TABLE_SCHEMA = 'fayxzvov_app'
   AND c.TABLE_NAME IN ('companies', 'branches', 'users')
   AND c.COLUMN_NAME = 'id';


-- ---------------------------------------------------------------------
-- PASO 1: HUERFANOS
-- Busca registros de fayxzvov_pos que apunten a una empresa, sucursal o
-- usuario que NO existe en fayxzvov_app. Debe salir VACIO.
-- Si sale algo, la llave de esa fila no se va a poder crear (error 1452):
-- corrige el dato o ponlo en NULL antes del PASO 3.
-- ---------------------------------------------------------------------

SELECT * FROM (
  -- -- companies --
  SELECT 'discount_reason.company_id' AS llave, COUNT(*) AS huerfanos FROM fayxzvov_pos.discount_reason x LEFT JOIN fayxzvov_app.companies p ON p.id = x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'modifier_group.company_id',   COUNT(*) FROM fayxzvov_pos.modifier_group x LEFT JOIN fayxzvov_app.companies p ON p.id = x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'payment_method.company_id',   COUNT(*) FROM fayxzvov_pos.payment_method x LEFT JOIN fayxzvov_app.companies p ON p.id = x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'product.company_id',          COUNT(*) FROM fayxzvov_pos.product        x LEFT JOIN fayxzvov_app.companies p ON p.id = x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale_status.company_id',      COUNT(*) FROM fayxzvov_pos.sale_status    x LEFT JOIN fayxzvov_app.companies p ON p.id = x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale_type.company_id',        COUNT(*) FROM fayxzvov_pos.sale_type      x LEFT JOIN fayxzvov_app.companies p ON p.id = x.company_id WHERE x.company_id IS NOT NULL AND p.id IS NULL
  -- -- branches --
  UNION ALL SELECT 'card.branch_id',              COUNT(*) FROM fayxzvov_pos.card          x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'card_type.branch_id',         COUNT(*) FROM fayxzvov_pos.card_type     x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'category.branch_id',          COUNT(*) FROM fayxzvov_pos.category      x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'customer.branch_id',          COUNT(*) FROM fayxzvov_pos.customer      x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'daily_closure.branch_id',     COUNT(*) FROM fayxzvov_pos.daily_closure x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'payment.branch_id',           COUNT(*) FROM fayxzvov_pos.payment       x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'product.branch_id',           COUNT(*) FROM fayxzvov_pos.product       x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'receivable.branch_id',        COUNT(*) FROM fayxzvov_pos.receivable    x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale.branch_id',              COUNT(*) FROM fayxzvov_pos.sale          x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'subcategory.branch_id',       COUNT(*) FROM fayxzvov_pos.subcategory   x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'turn.branch_id',              COUNT(*) FROM fayxzvov_pos.turn          x LEFT JOIN fayxzvov_app.branches p ON p.id = x.branch_id WHERE x.branch_id IS NOT NULL AND p.id IS NULL
  -- -- users --
  UNION ALL SELECT 'daily_closure.user_id',          COUNT(*) FROM fayxzvov_pos.daily_closure x LEFT JOIN fayxzvov_app.users p ON p.id = x.user_id          WHERE x.user_id          IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'daily_closure.reopened_user_id', COUNT(*) FROM fayxzvov_pos.daily_closure x LEFT JOIN fayxzvov_app.users p ON p.id = x.reopened_user_id WHERE x.reopened_user_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'history_log.user_id',            COUNT(*) FROM fayxzvov_pos.history_log   x LEFT JOIN fayxzvov_app.users p ON p.id = x.user_id          WHERE x.user_id          IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'payment.user_id',                COUNT(*) FROM fayxzvov_pos.payment       x LEFT JOIN fayxzvov_app.users p ON p.id = x.user_id          WHERE x.user_id          IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'payment.deleted_user_id',        COUNT(*) FROM fayxzvov_pos.payment       x LEFT JOIN fayxzvov_app.users p ON p.id = x.deleted_user_id  WHERE x.deleted_user_id  IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'receivable.user_id',             COUNT(*) FROM fayxzvov_pos.receivable    x LEFT JOIN fayxzvov_app.users p ON p.id = x.user_id          WHERE x.user_id          IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'receivable.deleted_user_id',     COUNT(*) FROM fayxzvov_pos.receivable    x LEFT JOIN fayxzvov_app.users p ON p.id = x.deleted_user_id  WHERE x.deleted_user_id  IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale.user_id',                   COUNT(*) FROM fayxzvov_pos.sale          x LEFT JOIN fayxzvov_app.users p ON p.id = x.user_id          WHERE x.user_id          IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale.edit_user_id',              COUNT(*) FROM fayxzvov_pos.sale          x LEFT JOIN fayxzvov_app.users p ON p.id = x.edit_user_id     WHERE x.edit_user_id     IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale.cancel_user_id',            COUNT(*) FROM fayxzvov_pos.sale          x LEFT JOIN fayxzvov_app.users p ON p.id = x.cancel_user_id   WHERE x.cancel_user_id   IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale.produced_user_id',          COUNT(*) FROM fayxzvov_pos.sale          x LEFT JOIN fayxzvov_app.users p ON p.id = x.produced_user_id WHERE x.produced_user_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'sale.discount_user_id',          COUNT(*) FROM fayxzvov_pos.sale          x LEFT JOIN fayxzvov_app.users p ON p.id = x.discount_user_id WHERE x.discount_user_id IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'turn.user_id',                   COUNT(*) FROM fayxzvov_pos.turn          x LEFT JOIN fayxzvov_app.users p ON p.id = x.user_id          WHERE x.user_id          IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'turn.close_user_id',             COUNT(*) FROM fayxzvov_pos.turn          x LEFT JOIN fayxzvov_app.users p ON p.id = x.close_user_id    WHERE x.close_user_id    IS NOT NULL AND p.id IS NULL
  UNION ALL SELECT 'turn.reopened_user_id',          COUNT(*) FROM fayxzvov_pos.turn          x LEFT JOIN fayxzvov_app.users p ON p.id = x.reopened_user_id WHERE x.reopened_user_id IS NOT NULL AND p.id IS NULL
) t
WHERE t.huerfanos > 0;


-- ---------------------------------------------------------------------
-- PASO 2: QUITAR LAS QUE YA EXISTEN
-- Solo si ya estan (en local si: las creo el script de creacion). Si no las
-- quitas, el PASO 3 falla con ERROR 1022 / errno 121: el nombre ya existe.
-- Si una linea marca "ERROR 1091 Can't DROP", esa llave no existia: sigue.
-- El indice de la columna NO se borra; el PASO 3 lo vuelve a usar.
-- ---------------------------------------------------------------------

ALTER TABLE fayxzvov_pos.card            DROP FOREIGN KEY card_ibfk_1;
ALTER TABLE fayxzvov_pos.card_type       DROP FOREIGN KEY card_type_ibfk_1;
ALTER TABLE fayxzvov_pos.category        DROP FOREIGN KEY category_ibfk_1;
ALTER TABLE fayxzvov_pos.customer        DROP FOREIGN KEY customer_ibfk_1;
ALTER TABLE fayxzvov_pos.daily_closure   DROP FOREIGN KEY daily_closure_ibfk_1, DROP FOREIGN KEY daily_closure_ibfk_2, DROP FOREIGN KEY daily_closure_ibfk_3;
ALTER TABLE fayxzvov_pos.discount_reason DROP FOREIGN KEY discount_reason_ibfk_1;
ALTER TABLE fayxzvov_pos.history_log     DROP FOREIGN KEY history_log_ibfk_1;
ALTER TABLE fayxzvov_pos.modifier_group  DROP FOREIGN KEY modifier_group_ibfk_1;
ALTER TABLE fayxzvov_pos.payment         DROP FOREIGN KEY payment_ibfk_1, DROP FOREIGN KEY payment_ibfk_2, DROP FOREIGN KEY payment_ibfk_3;
ALTER TABLE fayxzvov_pos.payment_method  DROP FOREIGN KEY payment_method_ibfk_1;
ALTER TABLE fayxzvov_pos.product         DROP FOREIGN KEY product_ibfk_1, DROP FOREIGN KEY product_ibfk_2;
ALTER TABLE fayxzvov_pos.receivable      DROP FOREIGN KEY receivable_ibfk_1, DROP FOREIGN KEY receivable_ibfk_2, DROP FOREIGN KEY receivable_ibfk_3;
ALTER TABLE fayxzvov_pos.sale            DROP FOREIGN KEY sale_ibfk_1, DROP FOREIGN KEY sale_ibfk_2, DROP FOREIGN KEY sale_ibfk_3, DROP FOREIGN KEY sale_ibfk_4, DROP FOREIGN KEY sale_ibfk_5, DROP FOREIGN KEY sale_ibfk_6;
ALTER TABLE fayxzvov_pos.sale_status     DROP FOREIGN KEY sale_status_ibfk_1;
ALTER TABLE fayxzvov_pos.sale_type       DROP FOREIGN KEY sale_type_ibfk_1;
ALTER TABLE fayxzvov_pos.subcategory     DROP FOREIGN KEY subcategory_ibfk_1;
ALTER TABLE fayxzvov_pos.turn            DROP FOREIGN KEY turn_ibfk_1, DROP FOREIGN KEY turn_ibfk_2, DROP FOREIGN KEY turn_ibfk_3, DROP FOREIGN KEY turn_ibfk_4;


-- ---------------------------------------------------------------------
-- PASO 3: CREAR LAS 32
-- Lo unico distinto a una llave normal: la tabla de destino lleva el nombre
-- de la base delante (fayxzvov_app.branches).
-- ---------------------------------------------------------------------

-- -- A companies (6) --

ALTER TABLE fayxzvov_pos.discount_reason
  ADD CONSTRAINT discount_reason_ibfk_1 FOREIGN KEY (company_id) REFERENCES fayxzvov_app.companies (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.modifier_group
  ADD CONSTRAINT modifier_group_ibfk_1  FOREIGN KEY (company_id) REFERENCES fayxzvov_app.companies (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.payment_method
  ADD CONSTRAINT payment_method_ibfk_1  FOREIGN KEY (company_id) REFERENCES fayxzvov_app.companies (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.sale_status
  ADD CONSTRAINT sale_status_ibfk_1     FOREIGN KEY (company_id) REFERENCES fayxzvov_app.companies (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.sale_type
  ADD CONSTRAINT sale_type_ibfk_1       FOREIGN KEY (company_id) REFERENCES fayxzvov_app.companies (id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- product lleva empresa Y sucursal
ALTER TABLE fayxzvov_pos.product
  ADD CONSTRAINT product_ibfk_1 FOREIGN KEY (company_id) REFERENCES fayxzvov_app.companies (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT product_ibfk_2 FOREIGN KEY (branch_id)  REFERENCES fayxzvov_app.branches  (id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- -- A branches (las 10 que faltan; product.branch_id ya va arriba) --

ALTER TABLE fayxzvov_pos.card
  ADD CONSTRAINT card_ibfk_1        FOREIGN KEY (branch_id) REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.card_type
  ADD CONSTRAINT card_type_ibfk_1   FOREIGN KEY (branch_id) REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.category
  ADD CONSTRAINT category_ibfk_1    FOREIGN KEY (branch_id) REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.subcategory
  ADD CONSTRAINT subcategory_ibfk_1 FOREIGN KEY (branch_id) REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.customer
  ADD CONSTRAINT customer_ibfk_1    FOREIGN KEY (branch_id) REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- -- Sucursal + usuarios en la misma tabla --

ALTER TABLE fayxzvov_pos.sale
  ADD CONSTRAINT sale_ibfk_1 FOREIGN KEY (branch_id)        REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT sale_ibfk_2 FOREIGN KEY (user_id)          REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT sale_ibfk_3 FOREIGN KEY (edit_user_id)     REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT sale_ibfk_4 FOREIGN KEY (cancel_user_id)   REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT sale_ibfk_5 FOREIGN KEY (produced_user_id) REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT sale_ibfk_6 FOREIGN KEY (discount_user_id) REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.payment
  ADD CONSTRAINT payment_ibfk_1 FOREIGN KEY (branch_id)       REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT payment_ibfk_2 FOREIGN KEY (user_id)         REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT payment_ibfk_3 FOREIGN KEY (deleted_user_id) REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.receivable
  ADD CONSTRAINT receivable_ibfk_1 FOREIGN KEY (branch_id)       REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT receivable_ibfk_2 FOREIGN KEY (user_id)         REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT receivable_ibfk_3 FOREIGN KEY (deleted_user_id) REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.turn
  ADD CONSTRAINT turn_ibfk_1 FOREIGN KEY (branch_id)        REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT turn_ibfk_2 FOREIGN KEY (user_id)          REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT turn_ibfk_3 FOREIGN KEY (close_user_id)    REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT turn_ibfk_4 FOREIGN KEY (reopened_user_id) REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE fayxzvov_pos.daily_closure
  ADD CONSTRAINT daily_closure_ibfk_1 FOREIGN KEY (branch_id)        REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT daily_closure_ibfk_2 FOREIGN KEY (user_id)          REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT daily_closure_ibfk_3 FOREIGN KEY (reopened_user_id) REFERENCES fayxzvov_app.users    (id) ON DELETE SET NULL ON UPDATE CASCADE;

-- -- Solo usuario --

ALTER TABLE fayxzvov_pos.history_log
  ADD CONSTRAINT history_log_ibfk_1 FOREIGN KEY (user_id) REFERENCES fayxzvov_app.users (id) ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- PASO 4: COMPROBAR
-- Primera consulta: branches 11, companies 6, users 15 (total 32).
-- Segunda: el detalle, una fila por llave.
-- ---------------------------------------------------------------------

SELECT k.REFERENCED_TABLE_NAME AS destino, COUNT(*) AS llaves
  FROM information_schema.KEY_COLUMN_USAGE k
 WHERE k.TABLE_SCHEMA = 'fayxzvov_pos'
   AND k.REFERENCED_TABLE_SCHEMA = 'fayxzvov_app'
 GROUP BY k.REFERENCED_TABLE_NAME;

SELECT k.TABLE_NAME, k.COLUMN_NAME, k.CONSTRAINT_NAME,
       CONCAT(k.REFERENCED_TABLE_SCHEMA, '.', k.REFERENCED_TABLE_NAME) AS destino,
       r.DELETE_RULE, r.UPDATE_RULE
  FROM information_schema.KEY_COLUMN_USAGE k
  JOIN information_schema.REFERENTIAL_CONSTRAINTS r
    ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
 WHERE k.TABLE_SCHEMA = 'fayxzvov_pos'
   AND k.REFERENCED_TABLE_SCHEMA = 'fayxzvov_app'
 ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME;
