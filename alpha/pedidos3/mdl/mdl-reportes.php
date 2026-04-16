<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MReportes extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function getSalesByHour($array) {
        $query = "
            SELECT HOUR(o.date_creation) as hora,
                   COUNT(*) as total_orders,
                   COALESCE(SUM(o.total_pay), 0) as total_sales
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY HOUR(o.date_creation)
            ORDER BY hora ASC
        ";
        return $this->_Read($query, $array);
    }

    function getSalesByProduct($array) {
        $query = "
            SELECT
                COALESCE(p.name, oc.name) as product_name,
                COALESCE(p.category_id, 0) as category_id,
                SUM(op.quantity) as total_qty,
                SUM(op.quantity * COALESCE(op.price, p.price, oc.price_real)) as total_amount
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}`order` o ON op.pedidos_id = o.id
            LEFT JOIN {$this->bd}order_products p ON op.product_id = p.id
            LEFT JOIN {$this->bd}order_custom oc ON op.custom_id = oc.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY product_name, category_id
            ORDER BY total_qty DESC
        ";
        return $this->_Read($query, $array);
    }

    function getSalesByCategory($array) {
        $query = "
            SELECT
                COALESCE(cat.classification, 'Personalizado') as category_name,
                COUNT(DISTINCT o.id) as total_orders,
                SUM(op.quantity) as total_qty,
                SUM(op.quantity * COALESCE(op.price, p.price, oc.price_real)) as total_amount
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}`order` o ON op.pedidos_id = o.id
            LEFT JOIN {$this->bd}order_products p ON op.product_id = p.id
            LEFT JOIN {$this->bd}order_custom oc ON op.custom_id = oc.id
            LEFT JOIN {$this->bd}order_category cat ON p.category_id = cat.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY category_name
            ORDER BY total_amount DESC
        ";
        return $this->_Read($query, $array);
    }

    function getSalesByEmployee($array) {
        $query = "
            SELECT
                u.fullname as employee_name,
                COUNT(DISTINCT o.id) as total_orders,
                COALESCE(SUM(o.total_pay), 0) as total_sales,
                COALESCE(SUM(pp.tip), 0) as total_tips
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = o.user_id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY u.id, u.fullname
            ORDER BY total_sales DESC
        ";
        return $this->_Read($query, $array);
    }

    function getComparativePeriod($array) {
        $query = "
            SELECT
                DATE(o.date_creation) as fecha,
                COUNT(*) as total_orders,
                COALESCE(SUM(o.total_pay), 0) as total_sales
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY DATE(o.date_creation)
            ORDER BY fecha ASC
        ";
        return $this->_Read($query, $array);
    }

    function getPaymentMethodSummary($array) {
        $query = "
            SELECT
                mp.method_pay,
                COUNT(DISTINCT pp.order_id) as total_orders,
                COALESCE(SUM(pp.pay), 0) as total_amount
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            LEFT JOIN {$this->bd}method_pay mp ON pp.method_pay_id = mp.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY mp.id, mp.method_pay
            ORDER BY total_amount DESC
        ";
        return $this->_Read($query, $array);
    }

    function listCancellations($array) {
        $query = "
            SELECT
                o.id, o.total_pay, o.date_creation, o.cancelled_at,
                o.discount, o.discount_reason,
                c.name as client_name,
                u.fullname as cancelled_by_name,
                cr.reason as cancel_reason
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = o.cancelled_by
            LEFT JOIN {$this->bd}cancellation_reasons cr ON cr.order_id = o.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status = 4
            ORDER BY o.date_creation DESC
        ";
        return $this->_Read($query, $array);
    }

    function getDiscountsSummary($array) {
        $query = "
            SELECT
                o.id, o.total_pay, o.discount, o.discount_reason,
                o.date_creation, c.name as client_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            AND o.discount > 0
            ORDER BY o.discount DESC
        ";
        return $this->_Read($query, $array);
    }

    function getCancellationCounts($array) {
        $query = "
            SELECT
                COUNT(*) as total_cancelled,
                COALESCE(SUM(total_pay), 0) as total_amount
            FROM {$this->bd}`order`
            WHERE DATE(date_creation) BETWEEN ? AND ?
            AND subsidiaries_id = ? AND status = 4
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total_cancelled' => 0, 'total_amount' => 0];
    }

    function getDiscountCounts($array) {
        $query = "
            SELECT
                COUNT(*) as total_with_discount,
                COALESCE(SUM(discount), 0) as total_discount
            FROM {$this->bd}`order`
            WHERE DATE(date_creation) BETWEEN ? AND ?
            AND subsidiaries_id = ? AND status != 4 AND discount > 0
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total_with_discount' => 0, 'total_discount' => 0];
    }

    function getTipsByEmployee($array) {
        $query = "
            SELECT
                u.fullname as employee_name,
                COUNT(DISTINCT pp.order_id) as total_orders,
                COALESCE(SUM(pp.tip), 0) as total_tips
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = o.user_id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND o.status != 4
            AND pp.tip > 0
            GROUP BY u.id, u.fullname
            ORDER BY total_tips DESC
        ";
        return $this->_Read($query, $array);
    }

    function getTipsByShift($array) {
        $query = "
            SELECT
                cs.id as shift_id,
                cs.shift_name,
                cs.opened_at,
                cs.closed_at,
                u.fullname as employee_name,
                COALESCE(SUM(pp.tip), 0) as total_tips
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            INNER JOIN {$this->bd}cash_shift cs ON o.cash_shift_id = cs.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ? AND pp.tip > 0
            GROUP BY cs.id, cs.shift_name, cs.opened_at, cs.closed_at, u.fullname
            ORDER BY cs.opened_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function getAccountsReceivable($array) {
        $query = "
            SELECT
                o.id, o.total_pay, o.date_creation,
                COALESCE(SUM(pp.pay), 0) as total_paid,
                (o.total_pay - COALESCE(SUM(pp.pay), 0)) as balance,
                c.name as client_name, c.phone as client_phone,
                DATEDIFF(NOW(), o.date_creation) as days_overdue
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE o.subsidiaries_id = ? AND o.status IN (1, 2)
            GROUP BY o.id
            HAVING balance > 0
            ORDER BY days_overdue DESC
        ";
        return $this->_Read($query, $array);
    }

    function getAccountsReceivableTotals($array) {
        $query = "
            SELECT
                COUNT(*) as total_accounts,
                COALESCE(SUM(sub.balance), 0) as total_balance
            FROM (
                SELECT
                    o.id,
                    (o.total_pay - COALESCE(SUM(pp.pay), 0)) as balance
                FROM {$this->bd}`order` o
                LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
                WHERE o.subsidiaries_id = ? AND o.status IN (1, 2)
                GROUP BY o.id
                HAVING balance > 0
            ) sub
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total_accounts' => 0, 'total_balance' => 0];
    }

    function listCorteZHistory($array) {
        $query = "
            SELECT
                cs.id, cs.folio_z, cs.opened_at, cs.closed_at,
                cs.total_sales, cs.total_cash, cs.total_card, cs.total_transfer,
                cs.total_orders, cs.opening_amount, cs.closing_cash_counted,
                cs.cash_difference, cs.total_discount, cs.total_cancelled,
                u.fullname as employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE cs.subsidiary_id = ?
            AND cs.status = 'closed' AND cs.folio_z IS NOT NULL
            AND DATE(cs.closed_at) BETWEEN ? AND ?
            ORDER BY cs.closed_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function getGeneralSalesSummary($array) {
        $query = "
            SELECT
                COUNT(*) as total_orders,
                COALESCE(SUM(total_pay), 0) as total_sales,
                COALESCE(SUM(discount), 0) as total_discount,
                COALESCE(AVG(total_pay), 0) as avg_ticket
            FROM {$this->bd}`order`
            WHERE DATE(date_creation) BETWEEN ? AND ?
            AND subsidiaries_id = ? AND status != 4
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : [
            'total_orders' => 0, 'total_sales' => 0, 'total_discount' => 0, 'avg_ticket' => 0
        ];
    }

    function lsSubsidiaries() {
        $query = "
            SELECT id, name as valor
            FROM fayxzvov_alpha.subsidiaries
            WHERE active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, null);
    }
}
