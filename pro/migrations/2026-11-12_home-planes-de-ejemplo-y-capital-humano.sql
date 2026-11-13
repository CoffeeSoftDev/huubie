-- =====================================================================
-- Inicio de empresa: temas del navbar, modulo Capital Humano, ficha de
-- empleado y planes de EJEMPLO para revisar el rail por empresa
-- Fecha: 12/11/2026
-- BD:    la del .env de pro (DB_NAME, hoy fayxzvov_app)
-- Rollback: 2026-11-12_home-planes-de-ejemplo-y-capital-humano-rollback.sql
--
-- 1. modules
--      Pedidos           no tenia code ni icono: sin code el rail no puede
--                        nombrarlo y sin icono sale un cuadro.
--      Capital Humano    nuevo en el catalogo de venta. Todavia sin ruta ni
--                        secciones (igual que Inventarios o POS): en el rail
--                        sale como "Próximamente".
--
-- 2. employees
--      La ficha de la persona en Capital Humano. Un empleado NO es un
--      usuario: puede existir sin cuenta (user_id NULL) y la cuenta se le
--      liga despues. Mi perfil (app/perfil) lee y escribe aqui los datos
--      personales; puesto, area e ingreso son de Capital Humano y el perfil
--      solo los muestra.
--      ENGINE=InnoDB explicito: el servidor crea en MyISAM por defecto y sus
--      llaves foraneas no existirian.
--
-- 3. themes
--      Estaba vacia, asi que el selector de temas de la barra no tenia nada
--      que ofrecer. Entran los de inventory que aplican a Huubie. Regina's es
--      EXCLUSIVO: solo lo ve Reginas (company_themes).
--
-- 4. Planes de EJEMPLO (external_reference = 'ejemplo-2026-11-12')
--      CoffeeSoft   cs-empresarial  activa     Pedidos, Inventarios, Produccion, POS
--      Reginas      personalizado   activa     Pedidos, Lealtad, Capital Humano
--      Café Demo    starter         past_due   empresa SUSPENDIDA: entra al
--                                              inicio y solo ve el aviso de pago
--    Café Demo es una empresa nueva, sin usuarios: root entra a ella desde
--    Empresas y la ve como la veria su dueño.
--    El rollback regresa CoffeeSoft a starter/trial y Reginas a pro/active,
--    que es como estaban.
--
-- Se puede volver a correr: todo se busca por code, nombre o referencia.
-- =====================================================================

-- ---------- 1. Modulos ----------

UPDATE modules
   SET code  = 'pedidos',
       icon  = COALESCE(NULLIF(icon, ''), 'clipboard-list'),
       orden = COALESCE(orden, 1)
 WHERE name = 'Pedidos' AND (code IS NULL OR code = '');

INSERT INTO modules (name, code, icon, description, price, orden, is_active, created_at)
SELECT 'Capital Humano', 'capital-humano', 'users',
       'El expediente de tu equipo: datos personales, puesto, sucursal y fechas clave.',
       399.00, 6, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modules WHERE code = 'capital-humano');

-- ---------- 2. Ficha de empleado ----------

CREATE TABLE IF NOT EXISTS employees (
    id              INT(11) NOT NULL AUTO_INCREMENT,
    user_id         INT(11) NULL DEFAULT NULL COMMENT 'la cuenta con la que entra; NULL = empleado sin acceso',
    company_id      INT(11) NOT NULL,
    branch_id       INT(11) NULL DEFAULT NULL,
    full_name       VARCHAR(150) NULL DEFAULT NULL COMMENT 'solo sin cuenta: con user_id el nombre es el de users',
    job_title       VARCHAR(100) NULL DEFAULT NULL,
    department      VARCHAR(100) NULL DEFAULT NULL,
    hire_date       DATE NULL DEFAULT NULL,
    birth_date      DATE NULL DEFAULT NULL,
    phone           VARCHAR(20) NULL DEFAULT NULL,
    address         VARCHAR(255) NULL DEFAULT NULL,
    emergency_name  VARCHAR(120) NULL DEFAULT NULL,
    emergency_phone VARCHAR(20) NULL DEFAULT NULL,
    created_at      DATETIME NULL DEFAULT NULL,
    updated_at      DATETIME NULL DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY employees_user_unique (user_id),
    KEY company_id (company_id),
    KEY branch_id (branch_id),
    CONSTRAINT employees_ibfk_1 FOREIGN KEY (user_id)    REFERENCES users (id)     ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT employees_ibfk_2 FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE  ON UPDATE CASCADE,
    CONSTRAINT employees_ibfk_3 FOREIGN KEY (branch_id)  REFERENCES branches (id)  ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Una ficha por cada usuario que ya pertenece a una empresa. Los datos son de
-- ejemplo; el cumpleaños cae en el mes en que se corre para que el inicio
-- tenga algo que enseñar.
INSERT INTO employees (user_id, company_id, branch_id, job_title, department, hire_date, birth_date, created_at)
SELECT u.id, u.company_id, u.branch_id,
       IF(u.is_owner = 1, 'Dirección general', 'Colaborador'),
       IF(u.is_owner = 1, 'Dirección', 'Operación'),
       DATE(COALESCE(u.created_at, NOW())),
       DATE_SUB(DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL (u.id % 27) DAY), INTERVAL (24 + u.id % 12) YEAR),
       NOW()
FROM users u
WHERE u.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = u.id);

-- ---------- 3. Temas ----------

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'light', 'Claro', 'color', '#FFFFFF', '#EA8A66', '#C05A40', '#91B2E8', NULL, 'light', 'light', NULL, 1, 1, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'light');

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'huubie-claro', 'Huubie Claro', 'color', '#FFFFFF', '#1C64F2', '#1C64F2', '#7C3AED', NULL, 'light', 'light', NULL, 0, 2, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'huubie-claro');

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'huubie', 'Huubie', 'color', '#141D2B', '#1C64F2', '#1C64F2', '#7C3AED', NULL, 'huubie', 'dark', NULL, 0, 3, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'huubie');

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'marino', 'Marino', 'color', '#003360', '#2563EB', '#003360', '#003360', '#003360', 'light', 'dark', NULL, 0, 4, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'marino');

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'midnight', 'Midnight Blue', 'color', '#101B29', '#38BDF8', '#0284C7', '#38BDF8', NULL, 'midnight', 'dark', NULL, 0, 5, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'midnight');

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'eclipse', 'Eclipse', 'color', '#1E293B', '#D97B5F', '#B0553E', '#A96A52', NULL, 'midnight', 'dark', NULL, 0, 6, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'eclipse');

INSERT INTO themes (code, name, tipo, color, accent, primary_color, secondary_color, sidebar_color, scheme, mode, badge, is_default, orden, is_active, created_at)
SELECT 'regina-s', 'Regina''s', 'color', '#F9D2D9', '#E3779D', '#F5A3B2', '#E3779D', NULL, 'light', 'light', 'EXCLUSIVO', 0, 7, 1, NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM themes WHERE code = 'regina-s');

-- Cada empresa ve el de por defecto (siempre) y los que tenga asignados.
-- CoffeeSoft: los generales. Reginas: los generales y el suyo. Café Demo se
-- queda solo con el de por defecto.
INSERT INTO company_themes (company_id, theme_id, created_at)
SELECT c.id, t.id, NOW()
FROM companies c
INNER JOIN themes t ON t.code IN ('huubie-claro', 'huubie', 'marino', 'midnight', 'eclipse')
                    OR (t.code = 'regina-s' AND c.name = 'Reginas')
WHERE c.name IN ('CoffeeSoft', 'Reginas')
  AND NOT EXISTS (SELECT 1 FROM company_themes ct WHERE ct.company_id = c.id AND ct.theme_id = t.id);

-- ---------- 4. Planes de ejemplo ----------

-- CoffeeSoft: el kit Empresarial, activo.
UPDATE subscriptions s
INNER JOIN companies c ON c.id = s.company_id AND c.name = 'CoffeeSoft'
INNER JOIN plans p     ON p.code = 'cs-empresarial'
   SET s.plan_id = p.id, s.status = 'active',
       s.starts_at = DATE_FORMAT(CURDATE(), '%Y-%m-01'),
       s.ends_at = DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH),
       s.next_billing_date = DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH),
       s.external_reference = 'ejemplo-2026-11-12', s.updated_at = NOW();

INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT c.id, p.id, 'active', DATE_FORMAT(CURDATE(), '%Y-%m-01'),
       DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH),
       DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH), 'ejemplo-2026-11-12', NOW()
FROM companies c
INNER JOIN plans p ON p.code = 'cs-empresarial'
WHERE c.name = 'CoffeeSoft'
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = c.id);

-- Reginas: Personalizado, activo, con los modulos que "eligio".
UPDATE subscriptions s
INNER JOIN companies c ON c.id = s.company_id AND c.name = 'Reginas'
INNER JOIN plans p     ON p.code = 'personalizado'
   SET s.plan_id = p.id, s.status = 'active',
       s.external_reference = 'ejemplo-2026-11-12', s.updated_at = NOW();

INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT c.id, p.id, 'active', DATE_FORMAT(CURDATE(), '%Y-%m-01'),
       DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH),
       DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH), 'ejemplo-2026-11-12', NOW()
FROM companies c
INNER JOIN plans p ON p.code = 'personalizado'
WHERE c.name = 'Reginas'
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = c.id);

-- El precio se congela al contratar (subscription_module.price): el de hoy.
INSERT INTO subscription_module (subscription_id, module_id, price, created_at)
SELECT s.id, m.id, COALESCE(m.price, 0), NOW()
FROM subscriptions s
INNER JOIN companies c ON c.id = s.company_id AND c.name = 'Reginas'
INNER JOIN modules m   ON m.code IN ('pedidos', 'lealtad', 'capital-humano')
WHERE s.external_reference = 'ejemplo-2026-11-12'
  AND NOT EXISTS (SELECT 1 FROM subscription_module sm WHERE sm.subscription_id = s.id AND sm.module_id = m.id);

-- Café Demo: la empresa que NO esta al corriente. Suspendida y con el pago vencido.
INSERT INTO companies (name, ubication, status, created_at)
SELECT 'Café Demo', 'Empresa de ejemplo · pago pendiente', 'suspended', NOW()
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'Café Demo');

INSERT INTO branches (name, ubication, company_id, is_active, created_at)
SELECT 'Café Demo Centro', 'Sucursal de ejemplo', c.id, 1, NOW()
FROM companies c
WHERE c.name = 'Café Demo'
  AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.company_id = c.id);

INSERT INTO subscriptions (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
SELECT c.id, p.id, 'past_due',
       DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH),
       DATE_FORMAT(CURDATE(), '%Y-%m-01'), DATE_FORMAT(CURDATE(), '%Y-%m-01'), 'ejemplo-2026-11-12', NOW()
FROM companies c
INNER JOIN plans p ON p.code = 'starter'
WHERE c.name = 'Café Demo'
  AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.company_id = c.id);
