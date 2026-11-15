-- =============================================================================
-- Rollback: Metodos de pago por sucursal
-- Fecha:     14/11/2026
-- BD:        fayxzvov_pos (lee empresas y sucursales de fayxzvov_app)
-- Deshace:   2026-11-14_metodos-pago-por-sucursal.sql
--
-- Regresa payment_method a "por empresa, con plantillas de Huubie":
--   1. Lo cobrado en las otras sucursales de Reginas vuelve a apuntar al
--      metodo de la Matriz con el mismo nombre (updated_at se deja igual).
--   2. Se borran las copias de esas sucursales, ya sin pagos que las usen.
--   3. Efectivo, Tarjeta, Transferencia y Monedero de la Matriz vuelven a ser
--      plantilla (company_id NULL). Se reconocen por su clave: CASH, CARD,
--      TRANSFER, PUNTOS. Si alguien se la cambio, ese metodo se queda como
--      propio de Reginas.
--   4. Se quita payment_method.branch_id con su llave e indice.
--
-- Lo que NO se recupera: un metodo que una sucursal dio de alta despues queda
-- como metodo de toda su empresa (conserva company_id). Si en otra sucursal de
-- Reginas se llama igual que uno de la Matriz, se funde con el de la Matriz.
--
-- Bajar ANTES el codigo que lee branch_id, o fallan la pestana Metodos de pago
-- y las ventanas de cobro.
-- Se puede volver a correr: si la columna ya no existe, no hace nada.
-- =============================================================================

SET @has = (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND COLUMN_NAME = 'branch_id');

-- Antes de correr en prod: confirmar el id de Reginas en companies.
SET @company_id = (SELECT id FROM fayxzvov_app.companies WHERE name = 'Reginas' LIMIT 1);

-- Matriz = primera sucursal activa de la empresa, la misma regla del codigo (qFirstBranch).
SET @main = (SELECT id FROM fayxzvov_app.branches
             WHERE company_id = @company_id AND IFNULL(is_active, 1) = 1
             ORDER BY id LIMIT 1);

START TRANSACTION;

-- 1. Lo cobrado con la copia de una sucursal vuelve al metodo de la Matriz.
SET @sql = IF(@has = 0, 'DO 0',
    'UPDATE fayxzvov_pos.payment p
     JOIN fayxzvov_pos.payment_method c ON c.id = p.payment_method_id AND c.company_id = @company_id AND c.branch_id <> @main
     JOIN fayxzvov_pos.payment_method m ON m.company_id = @company_id AND m.branch_id = @main AND m.name = c.name
     SET p.payment_method_id = m.id, p.updated_at = p.updated_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@has = 0, 'DO 0',
    'UPDATE fayxzvov_pos.turn_payment tp
     JOIN fayxzvov_pos.payment_method c ON c.id = tp.payment_method_id AND c.company_id = @company_id AND c.branch_id <> @main
     JOIN fayxzvov_pos.payment_method m ON m.company_id = @company_id AND m.branch_id = @main AND m.name = c.name
     SET tp.payment_method_id = m.id, tp.updated_at = tp.updated_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@has = 0, 'DO 0',
    'UPDATE fayxzvov_pos.daily_closure_payment dp
     JOIN fayxzvov_pos.payment_method c ON c.id = dp.payment_method_id AND c.company_id = @company_id AND c.branch_id <> @main
     JOIN fayxzvov_pos.payment_method m ON m.company_id = @company_id AND m.branch_id = @main AND m.name = c.name
     SET dp.payment_method_id = m.id, dp.updated_at = dp.updated_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@has = 0, 'DO 0',
    'UPDATE fayxzvov_pos.receivable r
     JOIN fayxzvov_pos.payment_method c ON c.id = r.payment_method_id AND c.company_id = @company_id AND c.branch_id <> @main
     JOIN fayxzvov_pos.payment_method m ON m.company_id = @company_id AND m.branch_id = @main AND m.name = c.name
     SET r.payment_method_id = m.id, r.updated_at = r.updated_at');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 2. Las copias, ya sin pagos que las usen.
SET @sql = IF(@has = 0, 'DO 0',
    'DELETE c
     FROM fayxzvov_pos.payment_method c
     JOIN fayxzvov_pos.payment_method m ON m.company_id = @company_id AND m.branch_id = @main AND m.name = c.name
     WHERE c.company_id = @company_id AND c.branch_id <> @main');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- 3. Los 4 originales de la Matriz vuelven a ser plantilla de Huubie.
SET @sql = IF(@has = 0, 'DO 0',
    "UPDATE fayxzvov_pos.payment_method
     SET company_id = NULL
     WHERE company_id = @company_id AND branch_id = @main AND code IN ('CASH', 'CARD', 'TRANSFER', 'PUNTOS')");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

COMMIT;

-- 4. Llave, indice y columna.
SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
               WHERE CONSTRAINT_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND CONSTRAINT_NAME = 'payment_method_ibfk_2') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.payment_method DROP FOREIGN KEY payment_method_ibfk_2');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND INDEX_NAME = 'branch_id') = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.payment_method DROP INDEX branch_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF(@has = 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.payment_method DROP COLUMN branch_id');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- Comprobacion: las plantillas de Huubie con company_id NULL.
SELECT id, name, code, company_id, is_visible, active
FROM fayxzvov_pos.payment_method
ORDER BY IFNULL(sort, 99), id;
