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

    function listTickets($array) {
        $query = "
            SELECT
                o.id as folio_cuenta,
                o.folio_ticket as folio_nota,
                o.date_creation as fecha,
                c.name as cuenta,
                o.order_type,
                COALESCE(o.discount, 0) as descuento_importe,
                COALESCE(SUM(pp.tip), 0) as propina,
                COALESCE(o.total_pay, 0) as importe,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 1 THEN pp.pay ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 2 THEN pp.pay ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 3 THEN pp.pay ELSE 0 END), 0) as transferencia,
                o.status
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND o.subsidiaries_id = ?
            GROUP BY o.id
            ORDER BY o.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listShifts($array) {
        $query = "
            SELECT
                cs.id, cs.shift_name, cs.opened_at, cs.closed_at,
                cs.opening_amount, cs.total_sales, cs.total_cash,
                cs.total_card, cs.total_transfer, cs.total_orders,
                cs.closing_cash_counted, cs.cash_difference,
                cs.total_discount, cs.total_cancelled, cs.total_tips,
                cs.folio_z, cs.status,
                u.fullname as employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE cs.subsidiary_id = ?
            AND DATE(cs.opened_at) BETWEEN ? AND ?
            ORDER BY cs.opened_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function getShiftDetailById($array) {
        $query = "
            SELECT
                cs.id, cs.shift_name, cs.opened_at, cs.closed_at,
                cs.opening_amount, cs.total_sales, cs.total_cash,
                cs.total_card, cs.total_transfer, cs.total_orders,
                cs.closing_cash_counted, cs.cash_difference,
                cs.total_discount, cs.total_cancelled, cs.total_tips,
                cs.folio_z, cs.status,
                u.fullname as employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE cs.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getShiftTickets($array) {
        $query = "
            SELECT
                o.id as folio_cuenta,
                o.folio_ticket as folio_nota,
                o.date_creation as fecha,
                c.name as cuenta,
                o.order_type,
                COALESCE(o.discount, 0) as descuento_importe,
                COALESCE(SUM(pp.tip), 0) as propina,
                COALESCE(o.total_pay, 0) as importe,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 1 THEN pp.pay ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 2 THEN pp.pay ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 3 THEN pp.pay ELSE 0 END), 0) as transferencia,
                o.status
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            WHERE o.cash_shift_id = ?
            GROUP BY o.id
            ORDER BY o.id ASC
        ";
        return $this->_Read($query, $array);
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
