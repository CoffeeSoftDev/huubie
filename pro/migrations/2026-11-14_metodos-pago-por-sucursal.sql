-- =============================================================================
-- Metodos de pago por sucursal
-- Fecha:     14/11/2026
-- BD:        fayxzvov_pos (lee empresas y sucursales de fayxzvov_app)
-- Requiere:  2026-11-06_migrar-reginas-a-pos.sql y 2026-11-13_foto-cortes-alpha.sql
--            (los pagos, cortes y cierres de Reginas ya cargados)
--            2026-11-13_icono-color-metodos-pago.sql (copia icon y color)
--            2026-11-14_metodo-monedero.sql
-- Rollback:  2026-11-14_metodos-pago-por-sucursal-rollback.sql
--
-- Antes:  payment_method era por empresa. Efectivo, Tarjeta, Transferencia y
--         Monedero eran plantilla de Huubie (company_id NULL): los veian todas
--         las empresas y nadie los editaba.
-- Despues payment_method.branch_id  cada sucursal da de alta los suyos,
--                                   Monedero incluido (code PUNTOS).
--         company_id NULL           metodo del sistema: no queda ninguno.
--
-- Los metodos que ya estaban son de Reginas:
--   1. Los 4 originales pasan a la Matriz de Reginas (su primera sucursal
--      activa) y CONSERVAN su id: los pagos de la Matriz no se tocan.
--   2. Cada otra sucursal de Reginas recibe su copia (mismo nombre, clave,
--      icono, color, comision, orden y si se ve al cobrar: Monedero sigue oculto).
--   3. Los pagos, cortes de turno, cierres del dia y abonos de esas otras
--      sucursales se apuntan a la copia de su sucursal. No cambia ningun
--      importe ni fecha (updated_at se deja igual).
--   Los pagos sin sucursal (branch_id NULL) se quedan con el metodo de la Matriz.
--
-- Las sucursales de otras empresas, y cualquier sucursal nueva, arrancan sin
-- metodos de pago: los dan de alta en Catalogo > Metodos de pago. Para cobrar
-- con monedero, la sucursal necesita un metodo con la clave PUNTOS.
--
-- Se puede volver a correr: la segunda vez no encuentra plantillas y no copia;
-- el paso 3 solo mueve lo que siga apuntando a la Matriz desde otra sucursal.
-- IMPORTANTE: correr ANTES de subir el codigo; sin branch_id fallan la pestana
-- Metodos de pago y las ventanas de cobro.
-- =============================================================================

-- -- Estructura --

SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND COLUMN_NAME = 'branch_id') > 0, 'DO 0',
              "ALTER TABLE fayxzvov_pos.payment_method
                   ADD COLUMN branch_id INT NULL DEFAULT NULL COMMENT 'sucursal duena; NULL con company_id NULL = metodo del sistema' AFTER company_id,
                   ADD KEY branch_id (branch_id)");
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

SET @sql = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
               WHERE CONSTRAINT_SCHEMA = 'fayxzvov_pos' AND TABLE_NAME = 'payment_method' AND CONSTRAINT_NAME = 'payment_method_ibfk_2') > 0, 'DO 0',
              'ALTER TABLE fayxzvov_pos.payment_method
                   ADD CONSTRAINT payment_method_ibfk_2 FOREIGN KEY (branch_id)
                   REFERENCES fayxzvov_app.branches (id) ON DELETE RESTRICT ON UPDATE CASCADE');
PREPARE st FROM @sql; EXECUTE st; DEALLOCATE PREPARE st;

-- -- Datos --

-- Antes de correr en prod: confirmar el id de Reginas en companies.
SET @company_id = (SELECT id FROM fayxzvov_app.companies WHERE name = 'Reginas' LIMIT 1);

-- Matriz = primera sucursal activa de la empresa, la misma regla del codigo (qFirstBranch).
SET @main = (SELECT id FROM fayxzvov_app.branches
             WHERE company_id = @company_id AND IFNULL(is_active, 1) = 1
             ORDER BY id LIMIT 1);

START TRANSACTION;

-- 2. Copia de cada plantilla para las otras sucursales de Reginas.
INSERT INTO fayxzvov_pos.payment_method
    (name, code, kind, icon, color, commission, sort, is_cash, is_visible, earns_points, company_id, branch_id, active)
SELECT m.name, m.code, m.kind, m.icon, m.color, m.commission, m.sort, m.is_cash, m.is_visible, m.earns_points, @company_id, b.id, m.active
FROM fayxzvov_pos.payment_method m
JOIN fayxzvov_app.branches b ON b.company_id = @company_id AND b.id <> @main
WHERE m.company_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM fayxzvov_pos.payment_method c WHERE c.branch_id = b.id AND c.name = m.name)
ORDER BY b.id, m.sort, m.id;

-- 1. Las plantillas (Monedero incluido) pasan a la Matriz con su mismo id.
UPDATE fayxzvov_pos.payment_method
SET company_id = @company_id, branch_id = @main
WHERE company_id IS NULL
    AND @company_id IS NOT NULL
    AND @main IS NOT NULL;

-- 3. Lo cobrado en otra sucursal apunta al metodo de esa sucursal (mismo nombre).
UPDATE fayxzvov_pos.payment p
JOIN fayxzvov_pos.payment_method m ON m.id = p.payment_method_id AND m.company_id = @company_id AND m.branch_id = @main
JOIN fayxzvov_pos.payment_method c ON c.company_id = @company_id AND c.branch_id = p.branch_id AND c.name = m.name
SET p.payment_method_id = c.id, p.updated_at = p.updated_at
WHERE p.branch_id <> @main;

UPDATE fayxzvov_pos.turn_payment tp
JOIN fayxzvov_pos.turn t           ON t.id = tp.turn_id
JOIN fayxzvov_pos.payment_method m ON m.id = tp.payment_method_id AND m.company_id = @company_id AND m.branch_id = @main
JOIN fayxzvov_pos.payment_method c ON c.company_id = @company_id AND c.branch_id = t.branch_id AND c.name = m.name
SET tp.payment_method_id = c.id, tp.updated_at = tp.updated_at
WHERE t.branch_id <> @main;

UPDATE fayxzvov_pos.daily_closure_payment dp
JOIN fayxzvov_pos.daily_closure d  ON d.id = dp.daily_closure_id
JOIN fayxzvov_pos.payment_method m ON m.id = dp.payment_method_id AND m.company_id = @company_id AND m.branch_id = @main
JOIN fayxzvov_pos.payment_method c ON c.company_id = @company_id AND c.branch_id = d.branch_id AND c.name = m.name
SET dp.payment_method_id = c.id, dp.updated_at = dp.updated_at
WHERE d.branch_id <> @main;

UPDATE fayxzvov_pos.receivable r
JOIN fayxzvov_pos.payment_method m ON m.id = r.payment_method_id AND m.company_id = @company_id AND m.branch_id = @main
JOIN fayxzvov_pos.payment_method c ON c.company_id = @company_id AND c.branch_id = r.branch_id AND c.name = m.name
SET r.payment_method_id = c.id, r.updated_at = r.updated_at
WHERE r.branch_id <> @main;

COMMIT;

-- -- Comprobacion --

-- Cada sucursal de Reginas con sus 4 metodos; ninguno sin empresa ni sucursal.
SELECT pm.id, pm.name, pm.code, pm.company_id, pm.branch_id, b.name AS branch, pm.is_visible, pm.active
FROM fayxzvov_pos.payment_method pm
LEFT JOIN fayxzvov_app.branches b ON b.id = pm.branch_id
ORDER BY pm.branch_id IS NULL, pm.branch_id, pm.sort, pm.id;

-- Debe dar 0 en los cuatro: nada cobrado en una sucursal con el metodo de otra.
SELECT 'payment' AS tabla, COUNT(*) AS cruzados
FROM fayxzvov_pos.payment p
JOIN fayxzvov_pos.payment_method pm ON pm.id = p.payment_method_id
WHERE pm.branch_id IS NOT NULL AND p.branch_id IS NOT NULL AND pm.branch_id <> p.branch_id
UNION ALL
SELECT 'turn_payment', COUNT(*)
FROM fayxzvov_pos.turn_payment tp
JOIN fayxzvov_pos.turn t            ON t.id = tp.turn_id
JOIN fayxzvov_pos.payment_method pm ON pm.id = tp.payment_method_id
WHERE pm.branch_id IS NOT NULL AND t.branch_id IS NOT NULL AND pm.branch_id <> t.branch_id
UNION ALL
SELECT 'daily_closure_payment', COUNT(*)
FROM fayxzvov_pos.daily_closure_payment dp
JOIN fayxzvov_pos.daily_closure d   ON d.id = dp.daily_closure_id
JOIN fayxzvov_pos.payment_method pm ON pm.id = dp.payment_method_id
WHERE pm.branch_id IS NOT NULL AND d.branch_id IS NOT NULL AND pm.branch_id <> d.branch_id
UNION ALL
SELECT 'receivable', COUNT(*)
FROM fayxzvov_pos.receivable r
JOIN fayxzvov_pos.payment_method pm ON pm.id = r.payment_method_id
WHERE pm.branch_id IS NOT NULL AND r.branch_id IS NOT NULL AND pm.branch_id <> r.branch_id;
