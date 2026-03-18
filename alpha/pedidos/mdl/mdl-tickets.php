<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MTickets extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function getTicketConfigBySubsidiary($array) {
        $query = "
            SELECT *
            FROM {$this->bd}ticket_config
            WHERE subsidiary_id = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createTicketConfig($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}ticket_config",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateTicketConfig($array) {
        return $this->_Update([
            'table'  => "{$this->bd}ticket_config",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function getOrderById($array) {
        $query = "
            SELECT o.*, c.name AS client_name, c.phone AS client_phone,
                   c.email AS client_email, c.address AS client_address
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE o.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getOrderItemsById($array) {
        $query = "
            SELECT op.*,
                   COALESCE(p.name, oc.name) AS product_name,
                   COALESCE(p.price, oc.price_real) AS unit_price
            FROM {$this->bd}order_package op
            LEFT JOIN {$this->bd}order_products p ON op.product_id = p.id
            LEFT JOIN {$this->bd}order_custom oc ON op.custom_id = oc.id
            WHERE op.pedidos_id = ?
        ";
        return $this->_Read($query, $array);
    }

    function getOrderPaymentsById($array) {
        $query = "
            SELECT op.*, mp.method_pay
            FROM {$this->bd}order_payments op
            LEFT JOIN {$this->bd}method_pay mp ON op.method_pay_id = mp.id
            WHERE op.order_id = ?
            ORDER BY op.date_pay ASC
        ";
        return $this->_Read($query, $array);
    }

    function getSucursalById($array) {
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

    function createTicketLog($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}ticket_log",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function listTicketLogByOrder($array) {
        $query = "
            SELECT tl.*, u.fullname AS employee_name
            FROM {$this->bd}ticket_log tl
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = tl.employee_id
            WHERE tl.order_id = ?
            ORDER BY tl.printed_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function updateOrderFolio($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET folio_ticket = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function getTicketCountByDate($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}ticket_log
            WHERE DATE(printed_at) = ? AND subsidiary_id = ? AND type = 'venta'
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['count' => 0];
    }

    function listSalesByShift($array) {
        $query = "
            SELECT o.id, o.total_pay, o.status, o.date_creation, o.order_type,
                   o.folio_ticket, c.name AS client_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            WHERE o.cash_shift_id = ? AND o.status != 4
            ORDER BY o.date_creation DESC
        ";
        return $this->_Read($query, $array);
    }

    function listSalesByDate($array) {
        $query = "
            SELECT o.id, o.total_pay, o.status, o.date_creation, o.order_type,
                   o.folio_ticket, c.name AS client_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ?
            ORDER BY o.date_creation DESC
        ";
        return $this->_Read($query, $array);
    }
}
