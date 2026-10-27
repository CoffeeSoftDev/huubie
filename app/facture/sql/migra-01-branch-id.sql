-- ============================================================================
--  Migracion 01 — subsidiaries_id  ->  branch_id
--
--  Lleva un esquema fayxzvov_facturacion creado con la version ANTERIOR del DDL
--  (aislamiento por subsidiaries_id + FK cross-schema a fayxzvov_alpha.subsidiaries)
--  al esquema que ya espera el codigo PHP: aislamiento por branch_id con FK a la
--  tabla local `branch`, y jerarquia propia company (1) --< branch (N).
--
--  Equivalente a ddl-facturacion.sql, pero sin borrar los catalogos existentes.
--  NO es idempotente: correr una sola vez.
-- ============================================================================

USE fayxzvov_facturacion;

SET FOREIGN_KEY_CHECKS = 0;


-- ── 1. company: nueva raiz corporativa ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS company (
  id              INT NOT NULL AUTO_INCREMENT,
  business_name   VARCHAR(200) NOT NULL,
  rfc             VARCHAR(13) NULL,
  fiscal_address  VARCHAR(255) NULL,
  phone           VARCHAR(20) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  active          TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_company_name (business_name(150))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO company (business_name) VALUES ('COMIENDO EN CHIAPAS');


-- ── 2. branch: subsidiaries_id -> company_id ────────────────────────────────
ALTER TABLE branch DROP FOREIGN KEY fk_branch_subsidiary;

ALTER TABLE branch
  DROP INDEX uk_branch_subsidiary,
  CHANGE subsidiaries_id company_id INT NULL;

UPDATE branch
   SET company_id = (SELECT id FROM company WHERE business_name = 'COMIENDO EN CHIAPAS')
 WHERE company_id IS NULL;

ALTER TABLE branch
  MODIFY company_id INT NOT NULL,
  ADD UNIQUE KEY uk_branch_name (business_name(150), company_id),
  ADD KEY idx_branch_company (company_id),
  ADD CONSTRAINT fk_branch_company FOREIGN KEY (company_id)
    REFERENCES company (id) ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── 3. payment_method ───────────────────────────────────────────────────────
ALTER TABLE payment_method DROP FOREIGN KEY fk_payment_method_subsidiary;

ALTER TABLE payment_method
  DROP INDEX fk_payment_method_subsidiary,
  DROP INDEX uk_payment_method_name,
  CHANGE subsidiaries_id branch_id INT NULL;

UPDATE payment_method
   SET branch_id = (SELECT MIN(id) FROM branch)
 WHERE branch_id IS NULL;

ALTER TABLE payment_method
  ADD UNIQUE KEY uk_payment_method_name (name, branch_id),
  ADD KEY idx_payment_method_branch (branch_id),
  ADD CONSTRAINT fk_payment_method_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE;


-- ── 4. product ──────────────────────────────────────────────────────────────
ALTER TABLE product DROP FOREIGN KEY fk_product_subsidiary;

ALTER TABLE product
  DROP INDEX fk_product_subsidiary,
  DROP INDEX uk_product_code,
  CHANGE subsidiaries_id branch_id INT NULL;

ALTER TABLE product
  ADD UNIQUE KEY uk_product_code (code, branch_id),
  ADD KEY idx_product_branch (branch_id),
  ADD CONSTRAINT fk_product_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE;


-- ── 5. waiter ───────────────────────────────────────────────────────────────
ALTER TABLE waiter DROP FOREIGN KEY fk_waiter_subsidiary;

ALTER TABLE waiter
  DROP INDEX fk_waiter_subsidiary,
  DROP INDEX uk_waiter_code,
  CHANGE subsidiaries_id branch_id INT NULL;

ALTER TABLE waiter
  ADD UNIQUE KEY uk_waiter_code (code, branch_id),
  ADD KEY idx_waiter_branch (branch_id),
  ADD CONSTRAINT fk_waiter_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE;


-- ── 6. import_batch ─────────────────────────────────────────────────────────
ALTER TABLE import_batch DROP FOREIGN KEY fk_import_batch_subsidiary;

ALTER TABLE import_batch
  DROP INDEX idx_import_subsidiary,
  CHANGE subsidiaries_id branch_id INT NULL;

ALTER TABLE import_batch
  ADD KEY idx_import_branch (branch_id),
  ADD CONSTRAINT fk_import_batch_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE;


-- ── 7. sale ─────────────────────────────────────────────────────────────────
ALTER TABLE sale DROP FOREIGN KEY fk_sale_subsidiary;

ALTER TABLE sale
  DROP INDEX idx_sale_subsidiary,
  DROP INDEX uk_sale_folio,
  DROP INDEX uk_sale_billing_code,
  CHANGE subsidiaries_id branch_id INT NULL;

ALTER TABLE sale
  ADD UNIQUE KEY uk_sale_folio (folio, branch_id),
  ADD UNIQUE KEY uk_sale_billing_code (billing_code, branch_id),
  ADD KEY idx_sale_branch (branch_id),
  ADD CONSTRAINT fk_sale_branch FOREIGN KEY (branch_id)
    REFERENCES branch (id) ON DELETE SET NULL ON UPDATE CASCADE;


-- ── 8. virtual_ticket: ya tiene branch_id, se retira subsidiaries_id ────────
-- branch_id se queda NULL. El DDL lo declara NOT NULL, pero su FK fk_vt_branch
-- es ON DELETE SET NULL y MySQL 8 rechaza esa pareja (error 1830). Corregirlo de
-- verdad es cambiar la FK a RESTRICT en el DDL, no es tarea de esta migracion.
ALTER TABLE virtual_ticket DROP FOREIGN KEY fk_vt_subsidiary;

ALTER TABLE virtual_ticket
  DROP INDEX idx_vt_subsidiary,
  DROP INDEX uk_virtual_ticket_note,
  DROP COLUMN subsidiaries_id;

ALTER TABLE virtual_ticket
  ADD UNIQUE KEY uk_virtual_ticket_note (issue_date, note_number, branch_id);


SET FOREIGN_KEY_CHECKS = 1;
