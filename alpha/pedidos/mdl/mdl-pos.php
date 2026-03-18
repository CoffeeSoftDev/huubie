<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MPos extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function lsMethodPay() {
        $query = "
            SELECT id, method_pay as valor
            FROM {$this->bd}method_pay
            ORDER BY id ASC
        ";
        return $this->_Read($query, null);
    }

    function getAllCategory($array) {
        $query = "
            SELECT id, classification as text, description
            FROM {$this->bd}order_category
            WHERE active = ?
        ";
        return $this->_Read($query, $array);
    }

    function lsProductos($array) {
        $query = "
            SELECT
                op.id, op.name as valor, op.price, op.description,
                op.image, oc.classification,
                DATE_FORMAT(op.date_creation, '%d %M %Y') as date_creation,
                op.active
            FROM {$this->bd}order_products op
            LEFT JOIN {$this->bd}order_category oc ON op.category_id = oc.id
            WHERE op.active = ? AND op.subsidiaries_id = ?
            ORDER BY op.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getOpenShiftBySubsidiary($array) {
        $query = "
            SELECT cs.*, u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE cs.subsidiary_id = ? AND cs.status = 'open' AND cs.active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getCashShiftById($id) {
        $query = "
            SELECT cs.*, u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE cs.id = ? AND cs.active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, [$id]);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getClientByName($array) {
        $query = "
            SELECT id FROM {$this->bd}order_clients
            WHERE name = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createClient($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function createOrder($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getMaxOrder() {
        $query = "SELECT MAX(id) as id FROM {$this->bd}`order`";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createProduct($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function addMethodPay($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_payments",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getSucursalByID($array) {
        $query = "
            SELECT
                fayxzvov_alpha.subsidiaries.id AS idSucursal,
                fayxzvov_admin.companies.id AS idCompany,
                fayxzvov_admin.companies.social_name as name,
                fayxzvov_alpha.subsidiaries.name as sucursal
            FROM fayxzvov_alpha.subsidiaries
            INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.subsidiaries.companies_id = fayxzvov_admin.companies.id
            WHERE subsidiaries.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createMovement($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}cash_shift_movements",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function listMovementsByShift($array) {
        $query = "
            SELECT m.*, u.fullname AS employee_name
            FROM {$this->bd}cash_shift_movements m
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = m.employee_id
            WHERE m.cash_shift_id = ? AND m.active = 1
            ORDER BY m.created_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function deleteMovementById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}cash_shift_movements",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function getMovementTotalsByShift($array) {
        $query = "
            SELECT
                COALESCE(SUM(CASE WHEN type = 'retiro' THEN amount ELSE 0 END), 0) as total_retiros,
                COALESCE(SUM(CASE WHEN type = 'deposito' THEN amount ELSE 0 END), 0) as total_depositos,
                COALESCE(SUM(CASE WHEN type = 'gasto' THEN amount ELSE 0 END), 0) as total_gastos
            FROM {$this->bd}cash_shift_movements
            WHERE cash_shift_id = ? AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : [
            'total_retiros' => 0, 'total_depositos' => 0, 'total_gastos' => 0
        ];
    }

    function getShiftSalesMetrics($array) {
        $startDate     = $array[0];
        $endDate       = $array[1];
        $subsidiary_id = $array[2];

        $queryOrders = "
            SELECT COUNT(*) as total_orders, COALESCE(SUM(total_pay), 0) as total_sales
            FROM {$this->bd}`order`
            WHERE date_creation >= ? AND date_creation < ?
            AND subsidiaries_id = ? AND status != 4
        ";
        $orders = $this->_Read($queryOrders, [$startDate, $endDate, $subsidiary_id]);
        $ordersData = is_array($orders) && !empty($orders) ? $orders[0] : ['total_orders' => 0, 'total_sales' => 0];

        $queryPayments = "
            SELECT pp.method_pay_id, SUM(pp.pay) as total_paid
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` po ON pp.order_id = po.id
            WHERE po.date_creation >= ? AND po.date_creation < ?
            AND po.subsidiaries_id = ? AND po.status != 4
            GROUP BY pp.method_pay_id
        ";
        $payments = $this->_Read($queryPayments, [$startDate, $endDate, $subsidiary_id]);

        $cash_sales = 0; $card_sales = 0; $transfer_sales = 0;
        if (is_array($payments)) {
            foreach ($payments as $p) {
                switch ($p['method_pay_id']) {
                    case 1: $cash_sales     = $p['total_paid']; break;
                    case 2: $card_sales     = $p['total_paid']; break;
                    case 3: $transfer_sales = $p['total_paid']; break;
                }
            }
        }

        $quotation_count = 0; $pending_count = 0; $cancelled_count = 0;
        $queryByStatus = "
            SELECT status, COUNT(*) as count
            FROM {$this->bd}`order`
            WHERE date_creation >= ? AND date_creation < ?
            AND subsidiaries_id = ?
            GROUP BY status
        ";
        $statuses = $this->_Read($queryByStatus, [$startDate, $endDate, $subsidiary_id]);
        if (is_array($statuses)) {
            foreach ($statuses as $s) {
                switch ($s['status']) {
                    case 1: $quotation_count = $s['count']; break;
                    case 2: $pending_count   = $s['count']; break;
                    case 4: $cancelled_count = $s['count']; break;
                }
            }
        }

        return [
            'total_orders'    => $ordersData['total_orders'],
            'total_sales'     => $ordersData['total_sales'],
            'cash_sales'      => $cash_sales,
            'card_sales'      => $card_sales,
            'transfer_sales'  => $transfer_sales,
            'quotation_count' => $quotation_count,
            'pending_count'   => $pending_count,
            'cancelled_count' => $cancelled_count
        ];
    }

    function getShiftDiscountTotal($array) {
        $query = "
            SELECT COALESCE(SUM(discount), 0) as total_discount
            FROM {$this->bd}`order`
            WHERE date_creation >= ? AND date_creation < ?
            AND subsidiaries_id = ? AND status != 4
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total_discount' => 0];
    }

    function getShiftCancelledTotal($array) {
        $query = "
            SELECT COALESCE(SUM(total_pay), 0) as total_cancelled
            FROM {$this->bd}`order`
            WHERE date_creation >= ? AND date_creation < ?
            AND subsidiaries_id = ? AND status = 4
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total_cancelled' => 0];
    }

    function createCorteXLog($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}corte_x_log",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function listCorteXByShift($array) {
        $query = "
            SELECT * FROM {$this->bd}corte_x_log
            WHERE cash_shift_id = ?
            ORDER BY generated_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function closeCashShiftZ($array) {
        $query = "
            UPDATE {$this->bd}cash_shift
            SET closed_at = ?, status = 'closed',
                total_sales = ?, total_cash = ?, total_card = ?,
                total_transfer = ?, total_orders = ?,
                closing_cash_counted = ?, cash_difference = ?,
                folio_z = ?, total_discount = ?, total_cancelled = ?
            WHERE id = ? AND status = 'open'
        ";
        return $this->_CUD($query, $array);
    }

    function createShiftPayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}shift_payment",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateOrdersCashShift($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET cash_shift_id = ?
            WHERE date_creation >= ? AND date_creation < ?
            AND subsidiaries_id = ?
            AND (cash_shift_id IS NULL OR cash_shift_id = 0)
        ";
        return $this->_CUD($query, $array);
    }

    function getCorteZCountByDate($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}cash_shift
            WHERE DATE(closed_at) = ? AND subsidiary_id = ?
            AND status = 'closed' AND folio_z IS NOT NULL
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['count' => 0];
    }

    function getShiftTopProducts($array) {
        $query = "
            SELECT
                COALESCE(p.name, oc.name) as name,
                SUM(op.quantity) as quantity,
                SUM(op.quantity * COALESCE(p.price, oc.price_real)) as total
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}`order` o ON op.pedidos_id = o.id
            LEFT JOIN {$this->bd}order_products p ON op.product_id = p.id
            LEFT JOIN {$this->bd}order_custom oc ON op.custom_id = oc.id
            WHERE o.date_creation >= ? AND o.date_creation < ?
            AND o.subsidiaries_id = ? AND o.status != 4
            GROUP BY COALESCE(p.name, oc.name)
            ORDER BY quantity DESC
            LIMIT 10
        ";
        return $this->_Read($query, $array);
    }

    function getShiftDetailedOrders($array) {
        $query = "
            SELECT o.id, o.total_pay, o.status, o.date_creation, o.order_type,
                   c.name AS client_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            WHERE o.date_creation >= ? AND o.date_creation < ?
            AND o.subsidiaries_id = ? AND o.status != 4
            ORDER BY o.date_creation ASC
        ";
        return $this->_Read($query, $array);
    }
}
