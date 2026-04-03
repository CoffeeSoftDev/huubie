<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MCierre extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function getSubsidiaryName($array) {
        $query = "
            SELECT s.name as sucursal, c.social_name as company
            FROM fayxzvov_alpha.subsidiaries s
            INNER JOIN fayxzvov_admin.companies c ON s.companies_id = c.id
            WHERE s.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getDailyClosureByDate($array) {
        $query = "
            SELECT dc.*, u.fullname AS closed_by_name
            FROM {$this->bd}daily_closure dc
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
            WHERE dc.closure_date = ? AND dc.subsidiary_id = ? AND dc.is_legacy = 0 AND dc.status = 0 AND dc.active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getConsolidatedMetrics($array) {
        $query = "
            SELECT
                COUNT(*) as total_shifts,
                COALESCE(SUM(cs.total_orders), 0) as total_orders,
                COALESCE(SUM(cs.total_sales), 0) as total_sales,
                COALESCE(SUM(cs.cash), 0) as total_cash,
                COALESCE(SUM(cs.card), 0) as total_card,
                COALESCE(SUM(cs.transfer), 0) as total_transfer
            FROM {$this->bd}cash_shift cs
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.status = 'closed' AND cs.active = 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : [
            'total_shifts' => 0, 'total_orders' => 0, 'total_sales' => 0,
            'total_cash' => 0, 'total_card' => 0, 'total_transfer' => 0
        ];
    }

    function listOpenShifts($array) {
        $query = "
            SELECT cs.id, cs.opened_at, cs.shift_name, u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.status = 'open' AND cs.active = 1
            ORDER BY cs.opened_at ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function listOrphanOrders($array) {
        $query = "
            SELECT o.id, o.id as folio, o.date_creation, o.total_pay, o.status
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND (o.cash_shift_id IS NULL OR o.cash_shift_id = 0)
              AND o.status != 4 AND o.is_legacy = 0
            ORDER BY o.date_creation ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function listPendingBalance($array) {
        $query = "
            SELECT
                o.id, o.id as folio, o.date_creation, o.total_pay,
                COALESCE(SUM(pp.pay), 0) as total_paid,
                (o.total_pay - COALESCE(SUM(pp.pay), 0)) as pending_balance
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY o.id
            HAVING pending_balance > 0.01
            ORDER BY pending_balance DESC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getConsolidatedPayments($array) {
        $query = "
            SELECT
                pp.method_pay_id,
                SUM(pp.pay) as total_paid
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON pp.order_id = o.id
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.status != 4 AND o.is_legacy = 0
            GROUP BY pp.method_pay_id
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getConsolidatedStatuses($array) {
        $query = "
            SELECT o.status, COUNT(*) as count
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.is_legacy = 0
            GROUP BY o.status
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getDiscountTotal($array) {
        $query = "
            SELECT COALESCE(SUM(o.discount), 0) as total_discount
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) = ? AND o.subsidiaries_id = ?
              AND o.status != 4 AND o.is_legacy = 0
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? floatval($result[0]['total_discount']) : 0;
    }

    function createClosure($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}daily_closure",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getMaxClosureId() {
        $query = "SELECT MAX(id) as id FROM {$this->bd}daily_closure";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createClosurePayments($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}closure_payment",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function createClosureStatuses($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}closure_status_proccess",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateOrdersClosure($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET daily_closure_id = ?
            WHERE DATE(date_creation) = ? AND subsidiaries_id = ?
              AND is_legacy = 0
              AND (daily_closure_id IS NULL OR daily_closure_id = 0)
        ";
        return $this->_CUD($query, $array);
    }

    function listShiftsDetail($array) {
        $query = "
            SELECT
                cs.id, cs.shift_name, cs.opened_at, cs.closed_at, cs.status,
                cs.total_sales, cs.total_orders, cs.cash as total_cash, cs.card as total_card, cs.transfer as total_transfer,
                u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.active = 1
            ORDER BY cs.opened_at ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function updateClosureReopen($array) {
        $query = "
            UPDATE {$this->bd}daily_closure
            SET status = 1, reopened_by = ?, reopen_reason = ?, reopened_at = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdersUnlink($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET daily_closure_id = NULL
            WHERE daily_closure_id = ? AND is_legacy = 0
        ";
        return $this->_CUD($query, $array);
    }

    function getClosureById($array) {
        $query = "
            SELECT dc.*, u.fullname AS closed_by_name, ur.fullname AS reopened_by_name
            FROM {$this->bd}daily_closure dc
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
            LEFT JOIN fayxzvov_alpha.usr_users ur ON ur.id = dc.reopened_by
            WHERE dc.id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }
}
