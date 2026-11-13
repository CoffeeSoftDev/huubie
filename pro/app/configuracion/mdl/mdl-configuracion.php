<?php
require_once __DIR__ . '/../../developer/ctrl/core-developer.php';

/*  Las consultas de Configuración que no estaban ya en el modelo compartido.

    Cuelga de `core` (app/developer): ahi viven las de sucursales, usuarios,
    roles y permisos (qBranch, qInsertUser, qRolePermissions...), que son las
    mismas tablas que Developer administra para todas las empresas. Aqui solo
    va lo propio de esta pagina, y TODO se pide por la empresa de la sesion:
    nada de aqui cruza de una empresa a otra. */
class configMdl extends core {

    // Los datos fiscales (migracion 2026-11-13_datos-fiscales-empresa). Mientras
    // no se corra, la pagina trabaja sin ellos.
    const FISCAL = ['legal_name', 'tax_regime', 'zip_code', 'phone', 'email'];

    function hasFiscalColumns() {
        $r = $this->_Read("SHOW COLUMNS FROM {$this->bd}companies LIKE 'legal_name'");
        return is_array($r) && !empty($r);
    }

    // SELECT *: asi trae las columnas fiscales si existen, sin nombrarlas.
    function getCompany($array) {
        // [company_id]
        $r = $this->_Read("SELECT * FROM {$this->bd}companies WHERE id = ? LIMIT 1", $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // $fields: columna => valor, ya validados. Marca la empresa como configurada.
    function updateCompany($fields, $companyId) {
        $set = [];
        foreach (array_keys($fields) as $column) $set[] = "{$column} = ?";

        $query = "
            UPDATE {$this->bd}companies
               SET " . implode(', ', $set) . ", setup_done_at = COALESCE(setup_done_at, NOW())
             WHERE id = ?
        ";

        return $this->_CUD($query, array_merge(array_values($fields), [$companyId]));
    }

    function updateCompanyLogo($array) {
        // [logo, company_id]
        return $this->_CUD("UPDATE {$this->bd}companies SET logo = ? WHERE id = ?", $array);
    }

    // Los topes del plan vigente (la ultima suscripcion). NULL = sin tope.
    function getPlanLimits($array) {
        // [company_id]
        $query = "
            SELECT p.max_users, p.max_branches
            FROM {$this->bd}subscriptions s
            INNER JOIN {$this->bd}plans p ON p.id = s.plan_id
            WHERE s.id = (SELECT MAX(s2.id) FROM {$this->bd}subscriptions s2 WHERE s2.company_id = ?)
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : ['max_users' => null, 'max_branches' => null];
    }

    function countActiveUsers($array) {
        // [company_id]
        $r = $this->_Read("SELECT COUNT(*) AS total FROM {$this->bd}users WHERE company_id = ? AND status = 'active'", $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['total'] : 0;
    }

    // Sucursales con cuantas personas entran a cada una.
    function listBranches($array) {
        // [company_id]
        $query = "
            SELECT
                b.id, b.name, b.ubication, b.is_active,
                (SELECT COUNT(DISTINCT ub.user_id)
                   FROM {$this->bd}users_braches ub
                   INNER JOIN {$this->bd}users u ON u.id = ub.user_id AND u.status = 'active'
                  WHERE ub.branch_id = b.id) AS users
            FROM {$this->bd}branches b
            WHERE b.company_id = ?
            ORDER BY b.is_active DESC, b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Toda la gente de la empresa, activa o no. Primero los dueños.
    function listUsers($array) {
        // [company_id]
        $query = "
            SELECT u.id, u.name, u.last_name, u.email, u.status, u.is_owner, u.photo, u.color,
                   DATE_FORMAT(u.last_login_at, '%Y-%m-%d') AS last_login
            FROM {$this->bd}users u
            WHERE u.company_id = ?
            ORDER BY (u.status = 'active') DESC, u.is_owner DESC, u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // A que sucursal entra cada quien y con que rol.
    function listUsersAccess($array) {
        // [company_id]
        $query = "
            SELECT ub.user_id, ub.branch_id, ub.role_id, b.name AS branch, r.name AS role
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}users u    ON u.id = ub.user_id AND u.company_id = ?
            INNER JOIN {$this->bd}branches b ON b.id = ub.branch_id
            LEFT JOIN {$this->bd}roles r     ON r.id = ub.role_id
            ORDER BY b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    /*  Los roles que la empresa puede dar: los del sistema (de todas las
        empresas, no se editan aqui) y los suyos, activos o no. root no: darlo
        en una sucursal es dar acceso a toda la plataforma. `users` cuenta solo
        a la gente de ESTA empresa. */
    function listRoles($array) {
        // [company_id, company_id]
        $query = "
            SELECT
                r.id, r.name, r.code, r.is_system, r.is_active,
                (SELECT COUNT(DISTINCT ub.user_id)
                   FROM {$this->bd}users_braches ub
                   INNER JOIN {$this->bd}users u ON u.id = ub.user_id AND u.company_id = ?
                  WHERE ub.role_id = r.id) AS users
            FROM {$this->bd}roles r
            WHERE COALESCE(r.code, '') <> 'root'
              AND ((r.is_system = 1 AND r.is_active = 1) OR r.company_id = ?)
            ORDER BY r.is_system ASC, r.is_active DESC, r.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function listPayments($array) {
        // [company_id]
        $query = "
            SELECT
                ph.id, ph.amount, ph.currency, ph.status, ph.gateway, ph.invoice_url,
                DATE_FORMAT(COALESCE(ph.paid_at, ph.created_at), '%Y-%m-%d') AS day
            FROM {$this->bd}payment_history ph
            WHERE ph.company_id = ?
            ORDER BY COALESCE(ph.paid_at, ph.created_at) DESC, ph.id DESC
            LIMIT 60
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    /*  Los planes que un dueño puede elegir: los de Huubie. Un plan es de
        Huubie cuando esta en una clasificacion activa cuyo code lleva "huubie"
        (plans_classification: huubie-pedidos, huubie-eventos...). Los de otras
        marcas que comparten la base (CoffeeSoft: cs-*) no se ofrecen aqui. */
    function listHuubiePlans() {
        $query = "
            SELECT p.id, p.code, p.name, p.description, p.price, p.price_before, p.currency, p.billing_cycle,
                   p.max_users, p.max_branches, p.features, p.modules_mode, p.modules_pick, p.featured
            FROM {$this->bd}plans p
            WHERE p.is_active = 1
              AND EXISTS (
                    SELECT 1
                    FROM {$this->bd}classification_plan cp
                    INNER JOIN {$this->bd}plans_classification pc ON pc.id = cp.classification_id
                    WHERE cp.plan_id = p.id AND pc.active = 1 AND LOWER(pc.code) LIKE '%huubie%'
              )
            ORDER BY (p.price IS NULL) ASC, p.price ASC, p.id ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Los modulos que trae cada plan de paquete (modules_mode = included).
    function listPlanModules() {
        $query = "
            SELECT pm.plan_id, m.name
            FROM {$this->bd}plan_module pm
            INNER JOIN {$this->bd}modules m ON m.id = pm.module_id AND m.is_active = 1
            ORDER BY m.orden ASC, m.name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Los modulos que se venden sueltos, con su precio mensual sin IVA. Sin
    // precio no se pueden contratar por separado (Catálogo, Configuración).
    function listSellableModules() {
        $query = "
            SELECT id, name, icon, description, price
            FROM {$this->bd}modules
            WHERE is_active = 1 AND price IS NOT NULL AND (code IS NULL OR code <> 'developer')
            ORDER BY orden ASC, name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function getSubscription($array) {
        // [company_id]: la que manda, la ultima.
        $query = "
            SELECT s.id, s.plan_id, s.status, s.stripe_subscription_id,
                   DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') AS next
            FROM {$this->bd}subscriptions s
            WHERE s.id = (SELECT MAX(s2.id) FROM {$this->bd}subscriptions s2 WHERE s2.company_id = ?)
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function updateSubscriptionPlan($array) {
        // [plan_id, subscription_id, company_id]
        return $this->_CUD("UPDATE {$this->bd}subscriptions SET plan_id = ?, updated_at = NOW() WHERE id = ? AND company_id = ?", $array);
    }

    // Lo que suma un plan Personalizado, al precio con que se contrato.
    function getSubscriptionTotal($array) {
        // [subscription_id]
        $r = $this->_Read("SELECT SUM(price) AS total FROM {$this->bd}subscription_module WHERE subscription_id = ?", $array);
        return empty($r) || $r[0]['total'] === null ? null : (float) $r[0]['total'];
    }
}
