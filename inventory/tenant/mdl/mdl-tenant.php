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

    // Orígenes de entrada, motivos de salida y estados de traspaso del inventario son por
    // empresa (2026-10-18_catalogos-por-empresa.sql). La empresa con ese nombre que aún no
    // tiene los de una tabla recibe la copia de la plantilla (filas sin companies_id).
    // Se puede repetir: la que ya los tiene no recibe otra copia.
    function qSeedInventoryCatalogs($array) {
        // [company name]
        $inv = 'fayxzvov_inventory.';

        $this->_CUD("
            INSERT INTO {$inv}inflow_origin
                (code, name, description, icon, color_hex, bg_hex, requires_supplier, sort_order, active, companies_id)
            SELECT t.code, t.name, t.description, t.icon, t.color_hex, t.bg_hex, t.requires_supplier, t.sort_order, t.active, c.id
            FROM {$inv}inflow_origin t
            CROSS JOIN {$this->bd}companies c
            WHERE t.companies_id IS NULL
            AND c.name = ?
            AND NOT EXISTS (SELECT 1 FROM {$inv}inflow_origin x WHERE x.companies_id = c.id)
        ", $array);

        $this->_CUD("
            INSERT INTO {$inv}shrinkage_reason
                (code, name, icon, color_hex, bg_hex, sort_order, active, companies_id)
            SELECT t.code, t.name, t.icon, t.color_hex, t.bg_hex, t.sort_order, t.active, c.id
            FROM {$inv}shrinkage_reason t
            CROSS JOIN {$this->bd}companies c
            WHERE t.companies_id IS NULL
            AND c.name = ?
            AND NOT EXISTS (SELECT 1 FROM {$inv}shrinkage_reason x WHERE x.companies_id = c.id)
        ", $array);

        return $this->_CUD("
            INSERT INTO {$inv}transfer_status
                (code, name, name_out, name_in, order_index, is_terminal, color_hex, bg_hex, active, companies_id)
            SELECT t.code, t.name, t.name_out, t.name_in, t.order_index, t.is_terminal, t.color_hex, t.bg_hex, t.active, c.id
            FROM {$inv}transfer_status t
            CROSS JOIN {$this->bd}companies c
            WHERE t.companies_id IS NULL
            AND c.name = ?
            AND NOT EXISTS (SELECT 1 FROM {$inv}transfer_status x WHERE x.companies_id = c.id)
        ", $array);
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
        $query = "SELECT id, name, code, icon, description, route, orden, is_active FROM {$this->bd}modules WHERE id = ? LIMIT 1";
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

    function qRenameSubmodule($array) {
        // [name, id]
        $query = "UPDATE {$this->bd}submodules SET name = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetSubmoduleActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}submodules SET is_active = ? WHERE id = ?";
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
        $query = "
            SELECT id, name, icon, is_active
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

    function qRenameSection($array) {
        // [name, id]
        $query = "UPDATE {$this->bd}sections SET name = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetSectionActive($array) {
        // [is_active, id]
        $query = "UPDATE {$this->bd}sections SET is_active = ? WHERE id = ?";
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

    function qRoles($array) {
        // [is_active] · actions/sections: acciones vigentes del rol y en cuántas secciones caen
        $query = "
            SELECT
                r.id, r.code, r.name, r.is_system, r.is_active,
                COUNT(c.id)                  AS actions,
                COUNT(DISTINCT c.section_id) AS sections
            FROM {$this->bd}roles r
            LEFT JOIN {$this->bd}permissions_roles pr ON pr.role_id = r.id
            LEFT JOIN (
                SELECT p.id, p.section_id
                FROM {$this->bd}permissions p
                JOIN {$this->bd}type_permissions tp ON tp.id = p.type_permission_id AND tp.is_active = 1
                JOIN {$this->bd}sections s          ON s.id = p.section_id AND s.is_active = 1
                JOIN {$this->bd}modules m           ON m.id = s.module_id AND m.is_active = 1
                WHERE p.is_active = 1
            ) AS c ON c.id = pr.permission_id
            WHERE r.is_active = ?
            GROUP BY r.id, r.code, r.name, r.is_system, r.is_active
            ORDER BY r.id ASC
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
        // [code, name, company_id] · sin empresa no saldría en Configuración > Accesos
        $query = "INSERT INTO {$this->bd}roles (code, name, is_system, is_active, company_id, created_at) VALUES (?, ?, 0, 1, ?, NOW())";
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

    // Secciones encendidas de módulos encendidos: las filas de la pestaña Permisos.
    function qCatalogSections() {
        $query = "
            SELECT
                s.id, s.name, s.icon, s.route, s.module_id,
                m.name AS module_name,
                m.icon AS module_icon
            FROM {$this->bd}sections s
            JOIN {$this->bd}modules m ON m.id = s.module_id AND m.is_active = 1
            WHERE s.is_active = 1
            ORDER BY m.orden ASC, m.id ASC, s.orden ASC, s.id ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

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

    // Empresas activas con el resumen de sus sucursales, para el selector de empresa.
    function qCompaniesBranchSummary() {
        $query = "
            SELECT
                c.id,
                c.name,
                COUNT(b.id) AS total_branches,
                COALESCE(SUM(b.is_active = 1), 0) AS active_branches,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}users_braches ub
                    INNER JOIN {$this->bd}branches b2 ON b2.id = ub.branch_id
                    WHERE b2.company_id = c.id
                ) AS assignments
            FROM {$this->bd}companies c
            LEFT JOIN {$this->bd}branches b ON b.company_id = c.id
            WHERE c.status = 'active'
            GROUP BY c.id, c.name
            ORDER BY c.name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qBranches($array) {
        // [company_id]
        $query = "
            SELECT
                b.id, b.name, b.ubication, b.is_active,
                DATE_FORMAT(b.created_at, '%d/%m/%Y') AS created,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}users_braches ub
                    WHERE ub.branch_id = b.id
                ) AS users
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

    // Una fila por asignación (usuario + rol) de todas las sucursales de la empresa.
    function qBranchAssignments($array) {
        // [company_id]
        $query = "
            SELECT
                ub.id        AS assignment_id,
                ub.branch_id AS branch_id,
                ub.role_id   AS role_id,
                u.id         AS user_id,
                u.name, u.last_name, u.email,
                r.name       AS role_name
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}branches b ON b.id = ub.branch_id
            INNER JOIN {$this->bd}users u    ON u.id = ub.user_id
            LEFT JOIN {$this->bd}roles r     ON r.id = ub.role_id
            WHERE b.company_id = ?
            ORDER BY u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Usuarios activos de la empresa: candidatos del modal "Añadir usuario".
    function qUsersForBranchAssign($array) {
        // [company_id]
        $query = "
            SELECT id, TRIM(CONCAT(name, ' ', COALESCE(last_name, ''))) AS valor
            FROM {$this->bd}users
            WHERE company_id = ? AND status = 'active'
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
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

    function qAssignment($array) {
        // [id]
        $query = "
            SELECT ub.id, ub.user_id, ub.branch_id, ub.role_id, b.company_id
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}branches b ON b.id = ub.branch_id
            WHERE ub.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
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

    // Sucursales activas de una empresa, para selects de asignación. La Matriz
    // (sucursal del almacén principal, en la BD de inventario) va primero.
    function qBranchesForSelect($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY id IN (SELECT branch_id FROM fayxzvov_inventory.warehouse WHERE is_main = 1 AND active = 1) DESC, name ASC
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

    /* ===== CRUD de usuarios (mismo juego que admin/accesos, con rol) ===== */

    // Una fila por usuario. Las sucursales y los roles se concatenan en
    // subconsultas porque users_braches tiene una fila por usuario+sucursal:
    // sin esto la tabla repetiria al usuario tantas veces como sucursales tenga.
    function qUsersFull($array) {
        // [company_id, status]
        $query = "
            SELECT
                u.id,
                u.name,
                u.last_name,
                u.email,
                u.status,
                u.is_owner,
                u.color,
                (
                    SELECT GROUP_CONCAT(DISTINCT br.name ORDER BY br.name ASC SEPARATOR ', ')
                    FROM {$this->bd}users_braches ub
                    INNER JOIN {$this->bd}branches br ON br.id = ub.branch_id
                    WHERE ub.user_id = u.id
                ) AS branch_names,
                (
                    SELECT GROUP_CONCAT(DISTINCT r.name ORDER BY r.name ASC SEPARATOR ', ')
                    FROM {$this->bd}users_braches ub2
                    INNER JOIN {$this->bd}roles r ON r.id = ub2.role_id
                    WHERE ub2.user_id = u.id
                ) AS role_names
            FROM {$this->bd}users u
            WHERE u.company_id = ? AND u.status = ?
            ORDER BY u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qUserFull($array) {
        // [id, company_id]
        $query = "
            SELECT id, name, last_name, email, branch_id, is_owner, status, color, photo
            FROM {$this->bd}users
            WHERE id = ? AND company_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qUpdateUserPhoto($array) {
        // [photo, id, company_id]
        $query = "UPDATE {$this->bd}users SET photo = ?, updated_at = NOW() WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qUserBranchIds($array) {
        // [user_id]
        $query = "
            SELECT branch_id
            FROM {$this->bd}users_braches
            WHERE user_id = ?
            ORDER BY branch_id ASC
        ";
        $r = $this->_Read($query, $array);
        if (!is_array($r) || empty($r)) return [];
        return array_column($r, 'branch_id');
    }

    // El modal captura UN rol por usuario, asi que se lee el primero que tenga
    // asignado. Si por datos viejos tuviera roles distintos por sucursal, el
    // guardado los uniforma al que quede seleccionado.
    function qUserMainRole($array) {
        // [user_id]
        $query = "
            SELECT role_id
            FROM {$this->bd}users_braches
            WHERE user_id = ? AND role_id IS NOT NULL
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return (is_array($r) && !empty($r)) ? (int) $r[0]['role_id'] : 0;
    }

    function qBranchInCompany($array) {
        // [branch_id, company_id]
        $query = "SELECT id FROM {$this->bd}branches WHERE id = ? AND company_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qUserEmailExists($array) {
        // [email, company_id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND company_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qUserEmailExistsExcept($array) {
        // [email, company_id, id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND company_id = ? AND id <> ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qInsertUser($array) {
        // [name, last_name, email, password, branch_id, company_id, color]
        $query = "
            INSERT INTO {$this->bd}users
                (name, last_name, email, password, branch_id, company_id, color, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qLastInsertId() {
        $r = $this->_Read("SELECT LAST_INSERT_ID() AS id", []);
        return (is_array($r) && !empty($r)) ? (int) $r[0]['id'] : 0;
    }

    function qUpdateUser($array) {
        // [name, last_name, email, branch_id, color, id, company_id]
        $query = "
            UPDATE {$this->bd}users
            SET name = ?, last_name = ?, email = ?, branch_id = ?, color = ?, updated_at = NOW()
            WHERE id = ? AND company_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qDeleteUserBranches($array) {
        // [user_id]
        $query = "DELETE FROM {$this->bd}users_braches WHERE user_id = ?";
        return $this->_CUD($query, $array);
    }

    function qUpdateUserPassword($array) {
        // [password, id, company_id]
        $query = "UPDATE {$this->bd}users SET password = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetUserStatus($array) {
        // [status, id, company_id]
        $query = "UPDATE {$this->bd}users SET status = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
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
