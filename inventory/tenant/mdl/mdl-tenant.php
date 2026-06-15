<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Modelo del Administrador del Tenant: super-admin global sobre fayxzvov_erp.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    /* ===== Empresas (companies) ===== */

    function qCompanies($array) {
        // [status]
        $query = "
            SELECT
                id, name, database_name, ubication, rfc, logo, status,
                DATE_FORMAT(created_at, '%d/%m/%Y') AS created
            FROM {$this->bd}companies
            WHERE status = ?
            ORDER BY id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Empresas activas en formato {id, valor} para selects (suscripciones).
    function qCompaniesForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}companies
            WHERE status = 'active'
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qCompany($array) {
        // [id]
        $query = "
            SELECT id, name, database_name, ubication, rfc, logo, status
            FROM {$this->bd}companies
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertCompany($array) {
        // [name, database_name, ubication, rfc, status]
        $query = "
            INSERT INTO {$this->bd}companies
                (name, database_name, ubication, rfc, status, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateCompany($array) {
        // [name, database_name, ubication, rfc, id]
        $query = "
            UPDATE {$this->bd}companies
            SET name = ?, database_name = ?, ubication = ?, rfc = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetCompanyStatus($array) {
        // [status, id]
        $query = "UPDATE {$this->bd}companies SET status = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Planes (plans) ===== */

    function qPlans($array) {
        // [is_active]
        $query = "
            SELECT
                id, code, name, price, currency, billing_cycle,
                max_users, max_branches, trial_days, is_active,
                DATE_FORMAT(created_at, '%d/%m/%Y') AS created
            FROM {$this->bd}plans
            WHERE is_active = ?
            ORDER BY id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Planes activos en formato {id, valor} para selects (suscripciones).
    function qPlansForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}plans
            WHERE is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qPlan($array) {
        // [id]
        $query = "
            SELECT id, code, name, price, currency, billing_cycle,
                   max_users, max_branches, trial_days, is_active
            FROM {$this->bd}plans
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertPlan($array) {
        // [code, name, price, currency, billing_cycle, max_users, max_branches, trial_days]
        $query = "
            INSERT INTO {$this->bd}plans
                (code, name, price, currency, billing_cycle, max_users, max_branches, trial_days, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdatePlan($array) {
        // [code, name, price, currency, billing_cycle, max_users, max_branches, trial_days, id]
        $query = "
            UPDATE {$this->bd}plans
            SET code = ?, name = ?, price = ?, currency = ?, billing_cycle = ?,
                max_users = ?, max_branches = ?, trial_days = ?, update_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetPlanActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}plans SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Suscripciones (subscriptions) ===== */

    function qSubscriptions($array) {
        // [status]
        $query = "
            SELECT
                s.id, s.company_id, s.plan_id, s.status,
                s.external_reference,
                DATE_FORMAT(s.starts_at, '%d/%m/%Y')          AS starts,
                DATE_FORMAT(s.ends_at, '%d/%m/%Y')            AS ends,
                DATE_FORMAT(s.next_billing_date, '%d/%m/%Y')  AS next_billing,
                c.name AS company_name,
                p.name AS plan_name
            FROM {$this->bd}subscriptions s
            LEFT JOIN {$this->bd}companies c ON c.id = s.company_id
            LEFT JOIN {$this->bd}plans p     ON p.id = s.plan_id
            WHERE s.status = ?
            ORDER BY s.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qSubscription($array) {
        // [id]
        $query = "
            SELECT id, company_id, plan_id, status,
                   starts_at, ends_at, next_billing_date, external_reference
            FROM {$this->bd}subscriptions
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertSubscription($array) {
        // [company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference]
        $query = "
            INSERT INTO {$this->bd}subscriptions
                (company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateSubscription($array) {
        // [company_id, plan_id, status, starts_at, ends_at, next_billing_date, external_reference, id]
        $query = "
            UPDATE {$this->bd}subscriptions
            SET company_id = ?, plan_id = ?, status = ?, starts_at = ?, ends_at = ?,
                next_billing_date = ?, external_reference = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetSubscriptionStatus($array) {
        // [status, id]
        $query = "UPDATE {$this->bd}subscriptions SET status = ?, updated_at = NOW() WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qCompanyHasSubscription($array) {
        // [company_id] — valida que la empresa exista
        $query = "SELECT id FROM {$this->bd}companies WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qPlanExists($array) {
        // [plan_id]
        $query = "SELECT id FROM {$this->bd}plans WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    // Suscripciones para selects (pagos): "Empresa - Plan (#id)".
    function qSubscriptionsForSelect() {
        $query = "
            SELECT
                s.id,
                CONCAT(COALESCE(c.name, '?'), ' - ', COALESCE(p.name, '?'), ' (#', s.id, ')') AS valor
            FROM {$this->bd}subscriptions s
            LEFT JOIN {$this->bd}companies c ON c.id = s.company_id
            LEFT JOIN {$this->bd}plans p     ON p.id = s.plan_id
            ORDER BY s.id DESC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    /* ===== Pagos (payment_history) ===== */

    function qPayments($array) {
        // [status]
        $query = "
            SELECT
                ph.id, ph.amount, ph.currency, ph.status, ph.gateway,
                ph.transaction_id, ph.invoice_url, ph.subscription_id, ph.company_id,
                DATE_FORMAT(ph.paid_at, '%d/%m/%Y')    AS paid,
                DATE_FORMAT(ph.created_at, '%d/%m/%Y') AS created,
                c.name AS company_name
            FROM {$this->bd}payment_history ph
            LEFT JOIN {$this->bd}companies c ON c.id = ph.company_id
            WHERE ph.status = ?
            ORDER BY ph.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qPayment($array) {
        // [id]
        $query = "
            SELECT id, company_id, subscription_id, amount, currency, status,
                   gateway, transaction_id, paid_at, invoice_url
            FROM {$this->bd}payment_history
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertPayment($array) {
        // [company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url]
        $query = "
            INSERT INTO {$this->bd}payment_history
                (company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdatePayment($array) {
        // [company_id, subscription_id, amount, currency, status, gateway, transaction_id, paid_at, invoice_url, id]
        $query = "
            UPDATE {$this->bd}payment_history
            SET company_id = ?, subscription_id = ?, amount = ?, currency = ?, status = ?,
                gateway = ?, transaction_id = ?, paid_at = ?, invoice_url = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetPaymentStatus($array) {
        // [status, id]
        $query = "UPDATE {$this->bd}payment_history SET status = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Cupones (coupons) ===== */

    function qCoupons($array) {
        // [is_active]
        $query = "
            SELECT
                id, code, description, discount_type, discount_value,
                max_redemptions, times_redeemed, is_active,
                DATE_FORMAT(valid_from, '%d/%m/%Y') AS valid_from,
                DATE_FORMAT(valid_to, '%d/%m/%Y')   AS valid_to
            FROM {$this->bd}coupons
            WHERE is_active = ?
            ORDER BY id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qCoupon($array) {
        // [id]
        $query = "
            SELECT id, code, description, discount_type, discount_value,
                   max_redemptions, times_redeemed, valid_from, valid_to, is_active
            FROM {$this->bd}coupons
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertCoupon($array) {
        // [code, description, discount_type, discount_value, max_redemptions, valid_from, valid_to]
        $query = "
            INSERT INTO {$this->bd}coupons
                (code, description, discount_type, discount_value, max_redemptions, valid_from, valid_to, times_redeemed, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateCoupon($array) {
        // [code, description, discount_type, discount_value, max_redemptions, valid_from, valid_to, id]
        $query = "
            UPDATE {$this->bd}coupons
            SET code = ?, description = ?, discount_type = ?, discount_value = ?,
                max_redemptions = ?, valid_from = ?, valid_to = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetCouponActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}coupons SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qCodeExists($array) {
        // [code]
        $query = "SELECT id FROM {$this->bd}coupons WHERE LOWER(code) = LOWER(?)";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qCodeExistsExcept($array) {
        // [code, id]
        $query = "SELECT id FROM {$this->bd}coupons WHERE LOWER(code) = LOWER(?) AND id <> ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    /* ===== Canjes de cupón (coupon_redemptions) ===== */

    function qRedemptions($array) {
        // [] — historial global de canjes
        $query = "
            SELECT
                cr.id, cr.coupon_id, cr.company_id, cr.subscription_id,
                DATE_FORMAT(cr.redeemed_at, '%d/%m/%Y %H:%i') AS redeemed,
                co.code AS coupon_code,
                c.name  AS company_name
            FROM {$this->bd}coupon_redemptions cr
            LEFT JOIN {$this->bd}coupons   co ON co.id = cr.coupon_id
            LEFT JOIN {$this->bd}companies c  ON c.id  = cr.company_id
            ORDER BY cr.id DESC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    /* ===== Módulos (modules) ===== */

    function qModules($array) {
        // [is_active]
        $query = "
            SELECT id, name, code, route, orden, is_active
            FROM {$this->bd}modules
            WHERE is_active = ?
            ORDER BY orden ASC, id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qModulesForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}modules
            WHERE is_active = 1
            ORDER BY orden ASC, name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qModule($array) {
        // [id]
        $query = "SELECT id, name, code, icon, description, route, orden, is_active FROM {$this->bd}modules WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertModule($array) {
        // [name, code, icon, description, route, orden]
        $query = "
            INSERT INTO {$this->bd}modules (name, code, icon, description, route, orden, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateModule($array) {
        // [name, code, icon, description, route, orden, id]
        $query = "UPDATE {$this->bd}modules SET name = ?, code = ?, icon = ?, description = ?, route = ?, orden = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetModuleActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}modules SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Submódulos (submodules) ===== */

    function qSubmodules($array) {
        // [is_active]
        $query = "
            SELECT
                sm.id, sm.name, sm.code, sm.route, sm.orden, sm.is_active, sm.module_id,
                m.name AS module_name
            FROM {$this->bd}submodules sm
            LEFT JOIN {$this->bd}modules m ON m.id = sm.module_id
            WHERE sm.is_active = ?
            ORDER BY sm.orden ASC, sm.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qSubmodulesForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}submodules
            WHERE is_active = 1
            ORDER BY orden ASC, name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qSubmodule($array) {
        // [id]
        $query = "SELECT id, name, code, icon, description, route, orden, is_active, module_id FROM {$this->bd}submodules WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertSubmodule($array) {
        // [name, code, icon, description, route, orden, module_id]
        $query = "
            INSERT INTO {$this->bd}submodules (name, code, icon, description, route, orden, module_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateSubmodule($array) {
        // [name, code, icon, description, route, orden, module_id, id]
        $query = "UPDATE {$this->bd}submodules SET name = ?, code = ?, icon = ?, description = ?, route = ?, orden = ?, module_id = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetSubmoduleActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}submodules SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Secciones (sections) ===== */

    function qSections($array) {
        // [is_active]
        $query = "
            SELECT
                s.id, s.name, s.code, s.route, s.orden, s.is_active, s.module_id, s.submodule_id,
                m.name  AS module_name,
                sm.name AS submodule_name
            FROM {$this->bd}sections s
            LEFT JOIN {$this->bd}modules    m  ON m.id  = s.module_id
            LEFT JOIN {$this->bd}submodules sm ON sm.id = s.submodule_id
            WHERE s.is_active = ?
            ORDER BY s.orden ASC, s.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qSectionsForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}sections
            WHERE is_active = 1
            ORDER BY orden ASC, name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qSection($array) {
        // [id]
        $query = "SELECT id, name, code, icon, route, orden, is_active, module_id, submodule_id FROM {$this->bd}sections WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertSection($array) {
        // [name, code, icon, route, orden, module_id, submodule_id]
        $query = "
            INSERT INTO {$this->bd}sections (name, code, icon, route, orden, module_id, submodule_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateSection($array) {
        // [name, code, icon, route, orden, module_id, submodule_id, id]
        $query = "
            UPDATE {$this->bd}sections
            SET name = ?, code = ?, icon = ?, route = ?, orden = ?, module_id = ?, submodule_id = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetSectionActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}sections SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Tipos de permiso (type_permissions) ===== */

    function qTypePermissions($array) {
        // [is_active]
        $query = "
            SELECT id, name, is_active
            FROM {$this->bd}type_permissions
            WHERE is_active = ?
            ORDER BY id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qTypePermissionsForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}type_permissions
            WHERE is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qTypePermission($array) {
        // [id]
        $query = "SELECT id, name, is_active FROM {$this->bd}type_permissions WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertTypePermission($array) {
        // [name]
        $query = "INSERT INTO {$this->bd}type_permissions (name, is_active, created_at) VALUES (?, 1, NOW())";
        return $this->_CUD($query, $array);
    }

    function qUpdateTypePermission($array) {
        // [name, id]
        $query = "UPDATE {$this->bd}type_permissions SET name = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetTypePermissionActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}type_permissions SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Roles (roles) ===== */

    function qRoles($array) {
        // [is_active]
        $query = "
            SELECT id, code, name, is_system, is_active
            FROM {$this->bd}roles
            WHERE is_active = ?
            ORDER BY id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qRolesForSelect() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}roles
            WHERE is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qRole($array) {
        // [id]
        $query = "SELECT id, code, name, is_system, is_active FROM {$this->bd}roles WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertRole($array) {
        // [code, name]
        $query = "INSERT INTO {$this->bd}roles (code, name, is_system, is_active, created_at) VALUES (?, ?, 0, 1, NOW())";
        return $this->_CUD($query, $array);
    }

    function qUpdateRole($array) {
        // [code, name, id]
        $query = "UPDATE {$this->bd}roles SET code = ?, name = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetRoleActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}roles SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Permisos (permissions) ===== */

    function qPermissions($array) {
        // [is_active]
        $query = "
            SELECT
                p.id, p.is_active, p.role_id, p.section_id, p.type_permission_id,
                r.name  AS role_name,
                s.name  AS section_name,
                tp.name AS type_name
            FROM {$this->bd}permissions p
            LEFT JOIN {$this->bd}roles            r  ON r.id  = p.role_id
            LEFT JOIN {$this->bd}sections         s  ON s.id  = p.section_id
            LEFT JOIN {$this->bd}type_permissions tp ON tp.id = p.type_permission_id
            WHERE p.is_active = ?
            ORDER BY r.name ASC, s.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qPermission($array) {
        // [id]
        $query = "SELECT id, role_id, section_id, type_permission_id, is_active FROM {$this->bd}permissions WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qPermissionExists($array) {
        // [role_id, section_id, type_permission_id]
        $query = "
            SELECT id FROM {$this->bd}permissions
            WHERE role_id = ? AND section_id = ? AND type_permission_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qInsertPermission($array) {
        // [role_id, section_id, type_permission_id]
        $query = "
            INSERT INTO {$this->bd}permissions (role_id, section_id, type_permission_id, is_active, created_at)
            VALUES (?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qSetPermissionActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}permissions SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Matriz de acceso (rol x seccion) ===== */

    // Tipo de permiso "Acceso" (modelo binario). Se asume el primero activo.
    function qAccessTypeId() {
        $query = "SELECT id FROM {$this->bd}type_permissions WHERE is_active = 1 ORDER BY id ASC LIMIT 1";
        $r = $this->_Read($query, null);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : 0;
    }

    // Todas las secciones activas con su módulo y submódulo, marcando si el rol tiene acceso.
    function qAccessMatrix($array) {
        // [role_id, type_permission_id]
        $query = "
            SELECT
                s.id          AS section_id,
                s.name        AS section_name,
                s.module_id   AS module_id,
                m.name        AS module_name,
                s.submodule_id AS submodule_id,
                sm.name       AS submodule_name,
                p.id          AS permission_id,
                COALESCE(p.is_active, 0) AS has_access
            FROM {$this->bd}sections s
            LEFT JOIN {$this->bd}modules    m  ON m.id  = s.module_id
            LEFT JOIN {$this->bd}submodules sm ON sm.id = s.submodule_id
            LEFT JOIN {$this->bd}permissions p
                   ON p.section_id = s.id
                  AND p.role_id = ?
                  AND p.type_permission_id = ?
            WHERE s.is_active = 1
            ORDER BY m.orden ASC, m.id ASC, s.orden ASC, s.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Roles activos con su conteo de accesos efectivos (para la lista lateral del editor).
    // Total de secciones activas y cuántas tiene concedidas cada rol.
    function qRolesWithAccessCount($array) {
        // [type_permission_id]
        $query = "
            SELECT
                r.id, r.code, r.name, r.is_system,
                (SELECT COUNT(*) FROM {$this->bd}sections WHERE is_active = 1) AS total_sections,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}permissions p
                    JOIN {$this->bd}sections s ON s.id = p.section_id AND s.is_active = 1
                    WHERE p.role_id = r.id
                      AND p.type_permission_id = ?
                      AND p.is_active = 1
                ) AS granted
            FROM {$this->bd}roles r
            WHERE r.is_active = 1
            ORDER BY r.is_system DESC, r.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // IDs de secciones activas de un módulo concreto (para conceder/retirar en bloque).
    function qSectionIdsByModule($array) {
        // [module_id]
        $query = "SELECT id FROM {$this->bd}sections WHERE module_id = ? AND is_active = 1";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Todas las secciones activas (para conceder/retirar todo el rol).
    function qAllSectionIds() {
        $query = "SELECT id FROM {$this->bd}sections WHERE is_active = 1";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Localiza el permiso de un trío para decidir entre insertar o reactivar.
    function qFindPermission($array) {
        // [role_id, section_id, type_permission_id]
        $query = "
            SELECT id, is_active FROM {$this->bd}permissions
            WHERE role_id = ? AND section_id = ? AND type_permission_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qSectionPermissionTypes($array) {
        // [role_id, section_id]
        $query = "
            SELECT
                tp.id,
                tp.name,
                COALESCE(p.is_active, 0) AS granted
            FROM {$this->bd}type_permissions tp
            LEFT JOIN {$this->bd}permissions p
                   ON p.type_permission_id = tp.id
                  AND p.role_id    = ?
                  AND p.section_id = ?
            WHERE tp.is_active = 1
            ORDER BY tp.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    /* ===== Usuarios y su rol por sucursal (users_braches) ===== */

    // Usuarios de una empresa con su asignación (sucursal + rol) si existe.
    function qUsersWithRole($array) {
        // [company_id]
        $query = "
            SELECT
                u.id, u.name, u.last_name, u.email, u.status,
                ub.id        AS assignment_id,
                ub.branch_id AS branch_id,
                b.name       AS branch_name,
                ub.role_id   AS role_id,
                r.name       AS role_name
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}users_braches ub ON ub.user_id = u.id
            LEFT JOIN {$this->bd}branches b        ON b.id = ub.branch_id
            LEFT JOIN {$this->bd}roles r           ON r.id = ub.role_id
            WHERE u.company_id = ?
            ORDER BY u.id ASC, b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Sucursales activas de una empresa, para selects de asignación.
    function qBranchesForSelect($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qUserBranchAssignment($array) {
        // [user_id, branch_id]
        $query = "SELECT id, role_id FROM {$this->bd}users_braches WHERE user_id = ? AND branch_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertUserBranchRole($array) {
        // [user_id, branch_id, role_id]
        $query = "INSERT INTO {$this->bd}users_braches (user_id, branch_id, role_id) VALUES (?, ?, ?)";
        return $this->_CUD($query, $array);
    }

    function qSetUserBranchRole($array) {
        // [role_id, id]
        $query = "UPDATE {$this->bd}users_braches SET role_id = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qDeleteUserBranchRole($array) {
        // [id]
        $query = "DELETE FROM {$this->bd}users_braches WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qUserExistsInCompany($array) {
        // [user_id, company_id]
        $query = "SELECT id FROM {$this->bd}users WHERE id = ? AND company_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    // Secciones a las que el usuario tiene acceso efectivo en una sucursal concreta
    // (resuelve users_braches -> roles -> permissions). Base para proteger el menú.
    function qUserAccessibleSections($array) {
        // [user_id, branch_id]
        $query = "
            SELECT DISTINCT
                s.id, s.name, s.code, s.icon, s.route,
                m.name AS module_name
            FROM {$this->bd}users_braches ub
            JOIN {$this->bd}permissions p ON p.role_id = ub.role_id AND p.is_active = 1
            JOIN {$this->bd}sections s    ON s.id = p.section_id AND s.is_active = 1
            LEFT JOIN {$this->bd}modules m ON m.id = s.module_id
            WHERE ub.user_id = ? AND ub.branch_id = ?
            ORDER BY m.name ASC, s.orden ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }
}
