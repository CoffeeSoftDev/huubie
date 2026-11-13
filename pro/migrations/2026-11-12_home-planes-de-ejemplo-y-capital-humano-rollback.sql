-- =====================================================================
-- Rollback de 2026-11-12_home-planes-de-ejemplo-y-capital-humano.sql
--
-- Regresa las suscripciones a como estaban (CoffeeSoft starter/trial,
-- Reginas pro/active), quita Café Demo, los temas, la ficha de empleado y
-- Capital Humano. Los DELETE van con IN (SELECT ...) y no con JOIN: el
-- DELETE multitabla de MySQL 5.7 falla si el script corre sin USE.
--
-- OJO: si ya se capturaron empleados o temas de verdad, este rollback se los
-- lleva. Revisa antes de correrlo.
-- =====================================================================

-- ---------- 4. Planes de ejemplo ----------

DELETE FROM subscription_module
 WHERE subscription_id IN (SELECT id FROM (SELECT id FROM subscriptions WHERE external_reference = 'ejemplo-2026-11-12') x);

DELETE FROM companies WHERE name = 'Café Demo';   -- en cascada: su sucursal y su suscripcion

UPDATE subscriptions s
INNER JOIN companies c ON c.id = s.company_id AND c.name = 'CoffeeSoft'
INNER JOIN plans p     ON p.code = 'starter'
   SET s.plan_id = p.id, s.status = 'trial',
       s.starts_at = '2026-10-31 00:00:00', s.ends_at = '2026-11-02 00:00:00',
       s.next_billing_date = '2026-10-31 00:00:00',
       s.external_reference = NULL, s.updated_at = NULL
 WHERE s.external_reference = 'ejemplo-2026-11-12';

UPDATE subscriptions s
INNER JOIN companies c ON c.id = s.company_id AND c.name = 'Reginas'
INNER JOIN plans p     ON p.code = 'pro'
   SET s.plan_id = p.id, s.status = 'active',
       s.external_reference = NULL, s.updated_at = NULL
 WHERE s.external_reference = 'ejemplo-2026-11-12';

-- ---------- 3. Temas ----------

UPDATE users SET theme_code = NULL
 WHERE theme_code IN ('light', 'huubie-claro', 'huubie', 'marino', 'midnight', 'eclipse', 'regina-s');

DELETE FROM themes
 WHERE code IN ('light', 'huubie-claro', 'huubie', 'marino', 'midnight', 'eclipse', 'regina-s');   -- en cascada: company_themes

-- ---------- 2. Ficha de empleado ----------

DROP TABLE IF EXISTS employees;

-- ---------- 1. Modulos ----------

DELETE FROM modules WHERE code = 'capital-humano';

UPDATE modules SET code = NULL, icon = NULL, orden = NULL WHERE code = 'pedidos' AND name = 'Pedidos';
