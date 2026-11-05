<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

// Modelo del modulo Developer: lo comparten los ctrl de sus secciones (Accesos,
// Facturacion). Portado de inventory/tenant/mdl/mdl-tenant.php.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
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
        // module_ids: los de plan_module (solo cuentan si modules_mode = 'included').
        // Del más barato al más caro; Personalizado (sin precio fijo) al final.
        $query = "
            SELECT
                p.id, p.code, p.name, p.price, p.price_before, p.currency, p.billing_cycle,
                p.max_users, p.max_branches, p.trial_days, p.is_active, p.features, p.modules_mode,
                DATE_FORMAT(p.created_at, '%d/%m/%Y') AS created,
                (
                    SELECT GROUP_CONCAT(pm.module_id)
                    FROM {$this->bd}plan_module pm
                    WHERE pm.plan_id = p.id
                ) AS module_ids
            FROM {$this->bd}plans p
            WHERE p.is_active = ?
            ORDER BY p.price IS NULL, p.price ASC, p.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Planes activos en formato {id, valor} para selects (suscripciones).
    // modules_mode: el formulario de suscripción pide módulos solo al Personalizado.
    function qPlansForSelect() {
        $query = "
            SELECT id, name AS valor, modules_mode
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
            SELECT id, code, name, price, price_before, currency, billing_cycle,
                   max_users, max_branches, trial_days, is_active, features, modules_mode
            FROM {$this->bd}plans
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertPlan($array) {
        // [code, name, price, price_before, currency, billing_cycle, max_users, max_branches, trial_days, features, modules_mode]
        $query = "
            INSERT INTO {$this->bd}plans
                (code, name, price, price_before, currency, billing_cycle, max_users, max_branches,
                 trial_days, features, modules_mode, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdatePlan($array) {
        // [code, name, price, price_before, currency, billing_cycle, max_users, max_branches, trial_days, features, modules_mode, id]
        $query = "
            UPDATE {$this->bd}plans
            SET code = ?, name = ?, price = ?, price_before = ?, currency = ?, billing_cycle = ?,
                max_users = ?, max_branches = ?, trial_days = ?, features = ?, modules_mode = ?,
                update_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qPlanModuleIds($array) {
        // [plan_id]
        $r = $this->_Read("SELECT module_id FROM {$this->bd}plan_module WHERE plan_id = ?", $array);
        return is_array($r) ? array_map('intval', array_column($r, 'module_id')) : [];
    }

    function qDeletePlanModules($array) {
        // [plan_id]
        return $this->_CUD("DELETE FROM {$this->bd}plan_module WHERE plan_id = ?", $array);
    }

    function qInsertPlanModule($array) {
        // [plan_id, module_id]
        return $this->_CUD("INSERT INTO {$this->bd}plan_module (plan_id, module_id) VALUES (?, ?)", $array);
    }

    /*  Los módulos que se venden: encendidos y sin Developer, que es la
        administración de la plataforma. Son los de "todos los módulos" y los que
        se eligen en un plan Personalizado. price: su precio mensual sin IVA. */
    function qSellableModules() {
        $query = "
            SELECT id, name AS valor, price
            FROM {$this->bd}modules
            WHERE is_active = 1 AND (code IS NULL OR code <> 'developer')
            ORDER BY orden ASC, name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
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
                p.name AS plan_name, p.price AS plan_price, p.currency, p.modules_mode,
                (
                    SELECT GROUP_CONCAT(m.name ORDER BY m.orden, m.name SEPARATOR ', ')
                    FROM {$this->bd}subscription_module sm
                    INNER JOIN {$this->bd}modules m ON m.id = sm.module_id
                    WHERE sm.subscription_id = s.id
                ) AS module_names,
                (
                    SELECT SUM(sm.price)
                    FROM {$this->bd}subscription_module sm
                    WHERE sm.subscription_id = s.id
                ) AS modules_price
            FROM {$this->bd}subscriptions s
            LEFT JOIN {$this->bd}companies c ON c.id = s.company_id
            LEFT JOIN {$this->bd}plans p     ON p.id = s.plan_id
            WHERE s.status = ?
            ORDER BY s.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Los módulos que eligió una suscripción Personalizada, con el precio contratado.
    function qSubscriptionModules($array) {
        // [subscription_id]
        $r = $this->_Read("SELECT module_id, price FROM {$this->bd}subscription_module WHERE subscription_id = ?", $array);
        return is_array($r) ? $r : [];
    }

    function qDeleteSubscriptionModules($array) {
        // [subscription_id]
        return $this->_CUD("DELETE FROM {$this->bd}subscription_module WHERE subscription_id = ?", $array);
    }

    function qInsertSubscriptionModule($array) {
        // [subscription_id, module_id, price]
        $query = "
            INSERT INTO {$this->bd}subscription_module (subscription_id, module_id, price, created_at)
            VALUES (?, ?, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qSubscription($array) {
        // [id]
        // El JOIN con companies es solo para el titulo del modal de edicion:
        // la suscripcion no tiene nombre propio, se identifica por su empresa.
        $query = "
            SELECT s.id, s.company_id, s.plan_id, s.status,
                   s.starts_at, s.ends_at, s.next_billing_date, s.external_reference,
                   c.name AS company_name
            FROM {$this->bd}subscriptions s
            LEFT JOIN {$this->bd}companies c ON c.id = s.company_id
            WHERE s.id = ?
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
        // Igual que en qSubscription: el pago no tiene nombre propio, el titulo
        // del modal lo identifica por la empresa a la que pertenece.
        $query = "
            SELECT p.id, p.company_id, p.subscription_id, p.amount, p.currency, p.status,
                   p.gateway, p.transaction_id, p.paid_at, p.invoice_url,
                   c.name AS company_name
            FROM {$this->bd}payment_history p
            LEFT JOIN {$this->bd}companies c ON c.id = p.company_id
            WHERE p.id = ?
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
        $query = "SELECT id, name, code, icon, description, price, route, orden, is_active FROM {$this->bd}modules WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Siguiente orden disponible para un módulo nuevo (MAX(orden)+1 lo resuelve el ctrl).
    function qModulesMaxOrden() {
        $query = "SELECT COALESCE(MAX(orden), 0) AS max_orden FROM {$this->bd}modules";
        $r = $this->_Read($query, null);
        return is_array($r) && !empty($r) ? (int) $r[0]['max_orden'] : 0;
    }

    function qInsertModule($array) {
        // [name, code, icon, description, price, route, orden]
        $query = "
            INSERT INTO {$this->bd}modules (name, code, icon, description, price, route, orden, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateModule($array) {
        // [name, code, icon, description, price, route, orden, id]
        $query = "UPDATE {$this->bd}modules SET name = ?, code = ?, icon = ?, description = ?, price = ?, route = ?, orden = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetModuleActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}modules SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Submódulos (submodules) ===== */

    // module_id: el modal de sección solo ofrece los submódulos del módulo elegido.
    function qSubmodulesForSelect() {
        $query = "
            SELECT id, name AS valor, module_id
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

    // Antes de borrar el submódulo: sections.submodule_id es ON DELETE CASCADE y
    // sin esto se llevaría sus secciones (y sus permisos) con él.
    function qDetachSubmoduleSections($array) {
        // [submodule_id]
        $query = "UPDATE {$this->bd}sections SET submodule_id = NULL WHERE submodule_id = ?";
        return $this->_CUD($query, $array);
    }

    function qDeleteSubmodule($array) {
        // [id]
        $query = "DELETE FROM {$this->bd}submodules WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Secciones (sections) ===== */

    function qSections($array) {
        // [is_active] · con [] trae activas e inactivas (Estado = Todos)
        // duplicate_of: nombre de otra sección ACTIVA con el mismo nombre y la misma
        // ruta; encender esta pintaría dos items idénticos en el menú.
        $where = $array ? 'WHERE s.is_active = ?' : '';
        $query = "
            SELECT
                s.id, s.name, s.code, s.icon, s.route, s.orden, s.is_active, s.module_id, s.submodule_id,
                m.name  AS module_name,
                sm.name AS submodule_name,
                (
                    SELECT d.name
                    FROM {$this->bd}sections d
                    WHERE d.id <> s.id
                      AND d.is_active = 1
                      AND LOWER(d.name) = LOWER(s.name)
                      AND d.route <=> s.route
                    LIMIT 1
                ) AS duplicate_of
            FROM {$this->bd}sections s
            LEFT JOIN {$this->bd}modules    m  ON m.id  = s.module_id
            LEFT JOIN {$this->bd}submodules sm ON sm.id = s.submodule_id
            {$where}
            ORDER BY s.orden ASC, s.id ASC
        ";
        $r = $this->_Read($query, $array ?: null);
        return is_array($r) ? $r : [];
    }

    // Todos los módulos (activos y apagados) para el panel de Secciones.
    function qModulesCatalog() {
        // code: el panel no ofrece apagar Developer (ver toggleModule del ctrl).
        // description: el texto de la tarjeta del módulo.
        $query = "
            SELECT id, name, code, icon, description, is_active
            FROM {$this->bd}modules
            ORDER BY orden ASC, id ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Todos los submódulos con su módulo, para armar los acordeones de Secciones.
    function qSubmodulesCatalog() {
        $query = "
            SELECT id, name, module_id, is_active
            FROM {$this->bd}submodules
            ORDER BY orden ASC, id ASC
        ";
        $r = $this->_Read($query, null);
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

    function qDeleteSection($array) {
        // [id] · primero sus permisos, luego la sección
        $query = "DELETE FROM {$this->bd}permissions WHERE section_id = ?";
        if (!$this->_CUD($query, $array)) return false;

        $query = "DELETE FROM {$this->bd}sections WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Los tipos de permiso encendidos en la sección: lo que muestra el select del modal.
    function qSectionTypeIds($array) {
        // [section_id]
        $query = "SELECT type_permission_id FROM {$this->bd}permissions WHERE section_id = ? AND is_active = 1";
        $r = $this->_Read($query, $array);
        return is_array($r) ? array_map('intval', array_column($r, 'type_permission_id')) : [];
    }

    function qSetSectionActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}sections SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qMoveSection($array) {
        // [submodule_id (NULL = sin submódulo), id]
        $query = "UPDATE {$this->bd}sections SET submodule_id = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSortSections($array) {
        // [[id, orden], ...]
        $query = "UPDATE {$this->bd}sections SET orden = ? WHERE id = ?";
        foreach ($array as $pair) {
            if (!$this->_CUD($query, [$pair[1], $pair[0]])) return false;
        }
        return true;
    }

    /* ===== Tipos de permiso (type_permissions) ===== */

    function qTypePermissions($array) {
        // [is_active]
        $query = "
            SELECT id, name, code, is_active
            FROM {$this->bd}type_permissions
            WHERE is_active = ?
            ORDER BY type_permissions.order ASC
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
        $query = "SELECT id, name, code, is_active FROM {$this->bd}type_permissions WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qTypeCodeExists($array) {
        // [code]
        $query = "SELECT id FROM {$this->bd}type_permissions WHERE code = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    function qInsertTypePermission($array) {
        // [name, code] · al final del orden: así se acomodan las columnas de Permisos y las acciones del rol
        $query = "
            INSERT INTO {$this->bd}type_permissions (name, code, `order`, is_active, created_at)
            SELECT ?, ?, COALESCE(MAX(`order`), 0) + 1, 1, NOW()
            FROM {$this->bd}type_permissions
        ";
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

    // FK permissions.type_permission_id -> type_permissions.id tiene ON DELETE SET NULL:
    // sin este conteo, borrar el tipo no truena por FK, solo deja permisos huérfanos con type_permission_id NULL.
    function qCountPermissionsByType($array) {
        // [type_permission_id]
        $query = "SELECT COUNT(*) AS total FROM {$this->bd}permissions WHERE type_permission_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['total'] : 0;
    }

    function qDeleteTypePermission($array) {
        // [id]
        $query = "DELETE FROM {$this->bd}type_permissions WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Roles (roles) ===== */

    function qRoles($array, $scope) {
        // [is_active] o [is_active, company_id] · $scope: all | system | company
        // actions/sections: acciones vigentes del rol y en cuántas secciones caen.
        // Primero los del sistema y luego cada empresa con sus roles juntos.
        $filters = [
            'all'     => '',
            'system'  => 'AND r.is_system = 1',
            'company' => 'AND r.is_system = 0 AND r.company_id = ?'
        ];
        $query = "
            SELECT
                r.id, r.code, r.name, r.is_system, r.is_active, r.company_id,
                co.name                      AS company_name,
                COUNT(c.id)                  AS actions,
                COUNT(DISTINCT c.section_id) AS sections
            FROM {$this->bd}roles r
            LEFT JOIN {$this->bd}companies co ON co.id = r.company_id
            LEFT JOIN {$this->bd}permissions_roles pr ON pr.role_id = r.id
            LEFT JOIN (
                SELECT p.id, p.section_id
                FROM {$this->bd}permissions p
                JOIN {$this->bd}type_permissions tp ON tp.id = p.type_permission_id AND tp.is_active = 1
                JOIN {$this->bd}sections s          ON s.id = p.section_id AND s.is_active = 1
                JOIN {$this->bd}modules m           ON m.id = s.module_id AND m.is_active = 1
                WHERE p.is_active = 1
            ) AS c ON c.id = pr.permission_id
            WHERE r.is_active = ? {$filters[$scope]}
            GROUP BY r.id, r.code, r.name, r.is_system, r.is_active, r.company_id, co.name
            ORDER BY r.is_system DESC, co.name ASC, r.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Roles que se pueden dar en las sucursales de una empresa: los del sistema y los suyos.
    // root no: tenerlo en cualquier sucursal da acceso total a todas las empresas.
    function qRolesForCompany($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor, code, is_system, company_id
            FROM {$this->bd}roles
            WHERE is_active = 1 AND (is_system = 1 OR company_id = ?)
              AND COALESCE(code, '') <> 'root'
            ORDER BY is_system DESC, name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qRole($array) {
        // [id]
        $query = "
            SELECT r.id, r.code, r.name, r.is_system, r.is_active, r.company_id, co.name AS company_name
            FROM {$this->bd}roles r
            LEFT JOIN {$this->bd}companies co ON co.id = r.company_id
            WHERE r.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qRoleNameExists($array) {
        // [name, company_id (NULL = entre los del sistema), id que se excluye (0 = ninguno)]
        // <=> y no =: con NULL, `company_id = ?` nunca coincide y dejaría repetir nombres del sistema.
        $query = "SELECT id FROM {$this->bd}roles WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND company_id <=> ? AND id <> ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    function qInsertRole($array) {
        // [code, name, is_system, company_id] · del sistema: company_id NULL y se puede dar
        // en las sucursales de cualquier empresa; de empresa: solo en las suyas.
        $query = "INSERT INTO {$this->bd}roles (code, name, is_system, is_active, company_id, created_at) VALUES (?, ?, ?, 1, ?, NOW())";
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

    /* ===== Permisos: acciones de cada sección (permissions) ===== */

    // Todo el catálogo (encendido y apagado) con cuántos roles tiene cada acción.
    function qPermissionsCatalog() {
        $query = "
            SELECT
                p.id, p.section_id, p.type_permission_id, p.is_active,
                (SELECT COUNT(*) FROM {$this->bd}permissions_roles pr WHERE pr.permission_id = p.id) AS roles
            FROM {$this->bd}permissions p
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // La acción de una sección, para decidir entre insertarla o encenderla/apagarla.
    function qFindPermission($array) {
        // [section_id, type_permission_id]
        $query = "
            SELECT
                p.id, p.section_id, p.type_permission_id, p.is_active,
                (SELECT COUNT(*) FROM {$this->bd}permissions_roles pr WHERE pr.permission_id = p.id) AS roles
            FROM {$this->bd}permissions p
            WHERE p.section_id = ? AND p.type_permission_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertPermission($array) {
        // [section_id, type_permission_id]
        $query = "
            INSERT INTO {$this->bd}permissions (section_id, type_permission_id, is_active, created_at)
            VALUES (?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qSetPermissionActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}permissions SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Acciones de cada rol (permissions_roles) ===== */

    // Acciones vigentes del catálogo (acción, tipo, sección y módulo encendidos),
    // marcando las que tiene el rol. role_id = 0 (rol nuevo) las trae sin marcar.
    function qRolePermissions($array) {
        // [role_id]
        $query = "
            SELECT
                p.id    AS permission_id,
                s.id    AS section_id,
                s.name  AS section_name,
                s.icon  AS section_icon,
                m.id    AS module_id,
                m.name  AS module_name,
                m.icon  AS module_icon,
                tp.name AS type_name,
                (pr.id IS NOT NULL) AS granted
            FROM {$this->bd}permissions p
            JOIN {$this->bd}type_permissions tp ON tp.id = p.type_permission_id AND tp.is_active = 1
            JOIN {$this->bd}sections s          ON s.id = p.section_id AND s.is_active = 1
            JOIN {$this->bd}modules m           ON m.id = s.module_id AND m.is_active = 1
            LEFT JOIN {$this->bd}permissions_roles pr ON pr.permission_id = p.id AND pr.role_id = ?
            WHERE p.is_active = 1
            ORDER BY m.orden ASC, m.id ASC, s.orden ASC, s.id ASC, tp.order ASC, tp.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qInsertRolePermission($array) {
        // [role_id, permission_id]
        $query = "INSERT INTO {$this->bd}permissions_roles (role_id, permission_id) VALUES (?, ?)";
        return $this->_CUD($query, $array);
    }

    function qDeleteRolePermission($array) {
        // [role_id, permission_id]
        $query = "DELETE FROM {$this->bd}permissions_roles WHERE role_id = ? AND permission_id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Sucursales (branches) ===== */

    function qBranches($array) {
        // [company_id]
        $query = "
            SELECT
                b.id, b.name, b.ubication, b.is_active,
                DATE_FORMAT(b.created_at, '%Y-%m-%d') AS created
            FROM {$this->bd}branches b
            WHERE b.company_id = ?
            ORDER BY b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qBranch($array) {
        // [id]
        $query = "SELECT id, name, ubication, is_active, company_id FROM {$this->bd}branches WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qBranchNameExists($array) {
        // [name, company_id]
        $query = "SELECT id FROM {$this->bd}branches WHERE LOWER(name) = LOWER(?) AND company_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qBranchNameExistsExcept($array) {
        // [name, company_id, id]
        $query = "SELECT id FROM {$this->bd}branches WHERE LOWER(name) = LOWER(?) AND company_id = ? AND id <> ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qCountActiveBranches($array) {
        // [company_id]
        $query = "SELECT COUNT(*) AS total FROM {$this->bd}branches WHERE company_id = ? AND is_active = 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['total'] : 0;
    }

    function qCountBranchAssignments($array) {
        // [branch_id]
        $query = "SELECT COUNT(*) AS total FROM {$this->bd}users_braches WHERE branch_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['total'] : 0;
    }

    // Plan vigente de la empresa: el de su suscripción activa o en prueba más reciente.
    // INNER JOIN a propósito: una suscripción que apunta a un plan borrado cuenta como "sin plan".
    function qPlanActiveByCompany($array) {
        // [company_id]
        $query = "
            SELECT p.id, p.name, p.max_branches
            FROM {$this->bd}subscriptions s
            INNER JOIN {$this->bd}plans p ON p.id = s.plan_id
            WHERE s.company_id = ? AND s.status IN ('active', 'trial')
            ORDER BY s.id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertBranch($array) {
        // [name, ubication, company_id]
        $query = "
            INSERT INTO {$this->bd}branches (name, ubication, company_id, is_active, created_at)
            VALUES (?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateBranch($array) {
        // [name, ubication, id]
        $query = "UPDATE {$this->bd}branches SET name = ?, ubication = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetBranchActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}branches SET is_active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
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

    // Todas las sucursales de una empresa, también las apagadas: el modal de
    // usuario reescribe sus accesos y no debe perder los que tenga en una inactiva.
    function qBranchesByCompany($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor, is_active
            FROM {$this->bd}branches
            WHERE company_id = ?
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qInsertUserBranchRole($array) {
        // [user_id, branch_id, role_id]
        $query = "INSERT INTO {$this->bd}users_braches (user_id, branch_id, role_id) VALUES (?, ?, ?)";
        return $this->_CUD($query, $array);
    }

    function qUserExistsInCompany($array) {
        // [user_id, company_id]
        $query = "SELECT id FROM {$this->bd}users WHERE id = ? AND company_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    /* ===== CRUD de usuarios de todas las empresas ===== */

    // Filtros de qUsers y qUsersAccess. $byCompany: con [status, company_id] filtra
    // la empresa; con [status] trae todas. $owners: solo los dueños (is_owner), que
    // son quienes pagan la suscripción.
    private function usersWhere($byCompany, $owners) {
        return ($byCompany ? ' AND u.company_id = ?' : '') . ($owners ? ' AND u.is_owner = 1' : '');
    }

    // Una fila por usuario con su empresa y la sucursal a la que pertenece
    // (users.branch_id). Sus accesos llegan aparte en qUsersAccess.
    // Primero los de plataforma (sin empresa, como root) y luego cada empresa junta.
    function qUsers($array, $byCompany, $owners = false) {
        $company = $this->usersWhere($byCompany, $owners);
        $query = "
            SELECT
                u.id, u.name, u.last_name, u.email, u.status, u.is_owner, u.color,
                u.company_id, u.branch_id,
                co.name AS company_name,
                hb.name AS branch_name
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies co ON co.id = u.company_id
            LEFT JOIN {$this->bd}branches hb  ON hb.id = u.branch_id
            WHERE u.status = ? {$company}
            ORDER BY (u.company_id IS NULL) DESC, co.name ASC, u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Una fila por sucursal a la que entra cada usuario de qUsers (mismos filtros).
    function qUsersAccess($array, $byCompany, $owners = false) {
        $company = $this->usersWhere($byCompany, $owners);
        $query = "
            SELECT
                ub.user_id, ub.branch_id, ub.role_id,
                b.name AS branch_name,
                r.name AS role_name,
                r.code AS role_code
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}users u    ON u.id = ub.user_id
            INNER JOIN {$this->bd}branches b ON b.id = ub.branch_id
            LEFT JOIN {$this->bd}roles r     ON r.id = ub.role_id
            WHERE u.status = ? {$company}
            ORDER BY b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qUser($array) {
        // [id]
        $query = "
            SELECT id, name, last_name, email, company_id, branch_id, is_owner, status, color, photo
            FROM {$this->bd}users
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qUserAccess($array) {
        // [user_id]
        $query = "
            SELECT branch_id, role_id
            FROM {$this->bd}users_braches
            WHERE user_id = ?
            ORDER BY branch_id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Con el rol root en cualquier sucursal el usuario es de plataforma (ver getRootRole del login).
    function qUserIsRoot($array) {
        // [user_id]
        $query = "
            SELECT ub.id
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}roles r ON r.id = ub.role_id
            WHERE ub.user_id = ? AND r.code = 'root'
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    // El login busca el correo en toda la plataforma: no se repite entre empresas.
    function qUserEmailTaken($array) {
        // [email, id que se excluye (0 = ninguno)]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r);
    }

    function qUpdateUserPhoto($array) {
        // [photo, id]
        $query = "UPDATE {$this->bd}users SET photo = ?, updated_at = NOW() WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qBranchInCompany($array) {
        // [branch_id, company_id]
        $query = "SELECT id FROM {$this->bd}branches WHERE id = ? AND company_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qInsertUser($array) {
        // [name, last_name, email, password, branch_id, company_id, color, is_owner]
        $query = "
            INSERT INTO {$this->bd}users
                (name, last_name, email, password, branch_id, company_id, color, is_owner, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qLastInsertId() {
        $r = $this->_Read("SELECT LAST_INSERT_ID() AS id", []);
        return (is_array($r) && !empty($r)) ? (int) $r[0]['id'] : 0;
    }

    function qUpdateUser($array) {
        // [name, last_name, email, company_id, branch_id, color, is_owner, id]
        $query = "
            UPDATE {$this->bd}users
            SET name = ?, last_name = ?, email = ?, company_id = ?, branch_id = ?, color = ?, is_owner = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qDeleteUserBranches($array) {
        // [user_id]
        $query = "DELETE FROM {$this->bd}users_braches WHERE user_id = ?";
        return $this->_CUD($query, $array);
    }

    function qUpdateUserPassword($array) {
        // [password, id]
        $query = "UPDATE {$this->bd}users SET password = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetUserStatus($array) {
        // [status, id]
        $query = "UPDATE {$this->bd}users SET status = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    /* ===== Empresa: la cartera de clientes del developer ===== */

    // Las empresas con su consumo: sucursales, usuarios y dueños (is_owner).
    function qPanelCompanies($array) {
        // [company_id, company_id] · 0 = todas
        $query = "
            SELECT
                c.id, c.name, c.rfc, c.ubication, c.status, c.database_name,
                DATE_FORMAT(c.created_at, '%Y-%m-%d') AS created,
                (SELECT COUNT(*) FROM {$this->bd}branches b WHERE b.company_id = c.id) AS branches,
                (SELECT COUNT(*) FROM {$this->bd}branches b WHERE b.company_id = c.id AND b.is_active = 1) AS branches_active,
                (SELECT COUNT(*) FROM {$this->bd}users u WHERE u.company_id = c.id) AS users,
                (SELECT COUNT(*) FROM {$this->bd}users u WHERE u.company_id = c.id AND u.status = 'active') AS users_active,
                (
                    SELECT GROUP_CONCAT(TRIM(CONCAT(u.name, ' ', COALESCE(u.last_name, ''))) ORDER BY u.name SEPARATOR ', ')
                    FROM {$this->bd}users u
                    WHERE u.company_id = c.id AND u.is_owner = 1
                ) AS owners
            FROM {$this->bd}companies c
            WHERE (? = 0 OR c.id = ?)
            ORDER BY c.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Suscripciones con su plan, de la más nueva a la más vieja por empresa.
    function qPanelSubscriptions($array) {
        // [company_id, company_id] · 0 = todas
        $query = "
            SELECT
                s.id, s.company_id, s.plan_id, s.status, s.external_reference,
                DATE_FORMAT(s.starts_at, '%Y-%m-%d')         AS starts,
                DATE_FORMAT(s.ends_at, '%Y-%m-%d')           AS ends,
                DATE_FORMAT(s.next_billing_date, '%Y-%m-%d') AS next_billing,
                DATE_FORMAT(s.created_at, '%Y-%m-%d')        AS created,
                p.name AS plan_name, p.code AS plan_code, p.price, p.currency, p.billing_cycle,
                p.max_users, p.max_branches, p.modules_mode,
                (
                    SELECT SUM(sm.price)
                    FROM {$this->bd}subscription_module sm
                    WHERE sm.subscription_id = s.id
                ) AS modules_price
            FROM {$this->bd}subscriptions s
            LEFT JOIN {$this->bd}plans p ON p.id = s.plan_id
            WHERE (? = 0 OR s.company_id = ?)
            ORDER BY s.company_id ASC, s.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qPanelPayments($array) {
        // [company_id, company_id] · 0 = todas
        $query = "
            SELECT
                ph.id, ph.company_id, ph.subscription_id, ph.amount, ph.currency, ph.status,
                ph.gateway, ph.transaction_id, ph.invoice_url,
                DATE_FORMAT(ph.paid_at, '%Y-%m-%d')    AS paid,
                DATE_FORMAT(ph.created_at, '%Y-%m-%d') AS created,
                c.name AS company_name,
                p.name AS plan_name
            FROM {$this->bd}payment_history ph
            LEFT JOIN {$this->bd}companies c     ON c.id = ph.company_id
            LEFT JOIN {$this->bd}subscriptions s ON s.id = ph.subscription_id
            LEFT JOIN {$this->bd}plans p         ON p.id = s.plan_id
            WHERE (? = 0 OR ph.company_id = ?)
            ORDER BY COALESCE(ph.paid_at, ph.created_at) DESC, ph.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Cobranza por empresa, para el listado.
    function qPanelPaymentTotals() {
        $query = "
            SELECT
                company_id,
                COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0)    AS paid_total,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount END), 0) AS pending_total,
                DATE_FORMAT(MAX(CASE WHEN status = 'paid' THEN paid_at END), '%Y-%m-%d') AS last_paid
            FROM {$this->bd}payment_history
            GROUP BY company_id
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Los usuarios de la empresa con su último acceso (user_sessions).
    function qPanelUsers($array) {
        // [company_id]
        $query = "
            SELECT
                u.id, u.name, u.last_name, u.email, u.status, u.is_owner, u.color, u.branch_id,
                (
                    SELECT DATE_FORMAT(MAX(us.last_activity), '%Y-%m-%d %H:%i')
                    FROM {$this->bd}user_sessions us
                    WHERE us.user_id = u.id
                ) AS last_activity
            FROM {$this->bd}users u
            WHERE u.company_id = ?
            ORDER BY u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // A qué sucursales de la empresa entra cada quien y con qué rol.
    function qPanelAccess($array) {
        // [company_id]
        $query = "
            SELECT ub.user_id, ub.branch_id, b.name AS branch_name, r.name AS role_name, r.code AS role_code
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}branches b ON b.id = ub.branch_id AND b.company_id = ?
            LEFT JOIN {$this->bd}roles r     ON r.id = ub.role_id
            ORDER BY b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Lo que trae cada plan (plan_module): los módulos que se pagan.
    function qPlanModulesAll() {
        $query = "SELECT plan_id, module_id FROM {$this->bd}plan_module";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    /* ===== Facturación › Módulos ===== */

    // m.* y no columnas sueltas: features (qué ofrece) solo existe si ya se
    // aplicó 2026-10-31_modulos-que-ofrece.sql, y sin ella la consulta no truena.
    function qModulesBilling() {
        $query = "SELECT * FROM {$this->bd}modules ORDER BY orden ASC, id ASC";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qModulesHaveFeatures() {
        $query = "
            SELECT COUNT(*) AS n
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'features'
        ";
        $r = $this->_Read($query, null);
        return is_array($r) && !empty($r) && (int) $r[0]['n'] > 0;
    }

    function qUpdateModuleBilling($array) {
        // [price, description, id]
        return $this->_CUD("UPDATE {$this->bd}modules SET price = ?, description = ? WHERE id = ?", $array);
    }

    function qUpdateModuleFeatures($array) {
        // [features, id]
        return $this->_CUD("UPDATE {$this->bd}modules SET features = ? WHERE id = ?", $array);
    }

    // Lo que deja cada módulo al mes en suscripciones Personalizado activas.
    function qCustomModuleRevenue() {
        $query = "
            SELECT sm.module_id, SUM(sm.price) AS total, COUNT(DISTINCT sm.subscription_id) AS subs
            FROM {$this->bd}subscription_module sm
            INNER JOIN {$this->bd}subscriptions s ON s.id = sm.subscription_id AND s.status = 'active'
            GROUP BY sm.module_id
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    // Lo que eligió cada suscripción Personalizada.
    function qSubscriptionModulesAll() {
        $query = "SELECT subscription_id, module_id FROM {$this->bd}subscription_module";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    /*  Los módulos que la empresa tiene habilitados: los que sus usuarios pueden
        abrir porque algún rol suyo tiene una acción vigente en una de sus secciones
        (la misma regla de Permission::section). sections = cuántas. No hay una
        tabla de licencias por empresa: esto es lo que de verdad usan. */
    function qPanelEnabledModules($array) {
        // [company_id, company_id] · 0 = todas
        $query = "
            SELECT u.company_id, s.module_id, COUNT(DISTINCT s.id) AS sections
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}users u              ON u.id = ub.user_id AND u.company_id IS NOT NULL
            INNER JOIN {$this->bd}roles r              ON r.id = ub.role_id AND r.is_active = 1
            INNER JOIN {$this->bd}permissions_roles pr ON pr.role_id = r.id
            INNER JOIN {$this->bd}permissions p        ON p.id = pr.permission_id AND p.is_active = 1
            INNER JOIN {$this->bd}type_permissions tp  ON tp.id = p.type_permission_id AND tp.is_active = 1
            INNER JOIN {$this->bd}sections s           ON s.id = p.section_id AND s.is_active = 1
            WHERE (? = 0 OR u.company_id = ?)
            GROUP BY u.company_id, s.module_id
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qPanelRedemptions($array) {
        // [company_id]
        $query = "
            SELECT
                cr.id, DATE_FORMAT(cr.redeemed_at, '%Y-%m-%d') AS redeemed,
                co.code, co.description, co.discount_type, co.discount_value
            FROM {$this->bd}coupon_redemptions cr
            LEFT JOIN {$this->bd}coupons co ON co.id = cr.coupon_id
            WHERE cr.company_id = ?
            ORDER BY cr.redeemed_at DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    /* ===== Temas por empresa (company_themes) ===== */

    // Temas asignables: activos y sin el de por defecto, que toda empresa ve siempre.
    function lsAssignableThemes() {
        $query = "
            SELECT id, name AS valor, code, color, accent
            FROM {$this->bd}themes
            WHERE is_active = 1
                AND COALESCE(is_default, 0) = 0
            ORDER BY orden ASC, id ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function listCompanyThemes($array) {
        // [company_id]
        $query = "
            SELECT theme_id
            FROM {$this->bd}company_themes
            WHERE company_id = ?
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function createCompanyTheme($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}company_themes",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteCompanyThemesById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}company_themes",
            'where' => $array['where'],
            'data'  => $array['data']
        ]);
    }
}
