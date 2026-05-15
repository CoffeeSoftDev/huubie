<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function lsSucursales() {
        $query = "
            SELECT id, name AS valor
            FROM fayxzvov_alpha.subsidiaries
            WHERE active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, [1]);
    }

    function lsCashShifts($array) {
        $query = "
            SELECT cs.id, CONCAT('Turno #', cs.id, ' - ', DATE_FORMAT(cs.opened_at, '%d/%m/%Y')) AS valor
            FROM {$this->bd}cash_shift cs
            WHERE cs.subsidiary_id = ?
            AND cs.active = 1
            AND cs.status = 'open'
            AND cs.closed_at IS NULL
            ORDER BY cs.opened_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function listVentas($array) {
        $where = '1=1';
        $data  = [];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND o.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }

        if (!empty($array['cash_shift_id'])) {
            $where .= ' AND o.cash_shift_id = ?';
            $data[] = $array['cash_shift_id'];
        }

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(o.date_order) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        if (!empty($array['status'])) {
            $where .= ' AND o.status = ?';
            $data[] = $array['status'];
        }

        $query = "
            SELECT
                o.id,
                o.status,
                o.total_pay,
                o.discount,
                o.note,
                o.date_order,
                o.time_order,
                o.order_type,
                o.cancelled_at,
                o.client_id,
                o.cash_shift_id,
                oc.name  AS client_name,
                oc.phone AS client_phone,
                GROUP_CONCAT(DISTINCT mp.method_pay ORDER BY mp.method_pay SEPARATOR ', ') AS payment_methods
            FROM {$this->bd}order o
            LEFT JOIN {$this->bd}order_clients oc ON o.client_id = oc.id
            LEFT JOIN {$this->bd}order_payments op ON o.id = op.order_id
            LEFT JOIN {$this->bd}method_pay mp ON op.method_pay_id = mp.id
            WHERE {$where}
            GROUP BY o.id
            ORDER BY o.date_order DESC, o.time_order DESC
        ";
        $result = $this->_Read($query, $data);
        return is_array($result) ? $result : [];
    }

    function getVentaById($array) {
        $query = "
            SELECT
                o.id,
                o.status,
                o.total_pay,
                o.discount,
                o.note,
                o.date_order,
                o.time_order,
                o.order_type,
                o.cancelled_at,
                o.cancelled_by,
                o.cash_shift_id,
                o.daily_closure_id,
                o.subsidiaries_id,
                oc.name  AS client_name,
                oc.phone AS client_phone,
                oc.email AS client_email,
                s.name   AS sucursal_name
            FROM {$this->bd}order o
            LEFT JOIN {$this->bd}order_clients oc ON o.client_id = oc.id
            LEFT JOIN fayxzvov_alpha.subsidiaries s ON o.subsidiaries_id = s.id
            WHERE o.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getVentaItems($array) {
        $query = "
            SELECT
                op.id,
                op.quantity,
                op.price,
                op.status,
                op.order_details,
                op.dedication,
                op.product_id,
                op.modifier_id
            FROM {$this->bd}order_package op
            WHERE op.pedidos_id = ?
            ORDER BY op.id ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getVentaPagos($array) {
        $query = "
            SELECT
                op.id,
                op.pay              AS amount,
                op.pay              AS tendered_amount,
                0                   AS change_amount,
                op.date_pay         AS paid_at,
                op.method_pay_id    AS payment_code,
                mp.method_pay       AS payment_name
            FROM {$this->bd}order_payments op
            LEFT JOIN {$this->bd}method_pay mp ON op.method_pay_id = mp.id
            WHERE op.order_id = ?
            ORDER BY op.id ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getVentaCounts($array) {
        $where = '1=1';
        $data  = [];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND o.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }

        if (!empty($array['cash_shift_id'])) {
            $where .= ' AND o.cash_shift_id = ?';
            $data[] = $array['cash_shift_id'];
        }

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(o.date_order) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(o.id)                                                          AS total_ventas,
                IFNULL(SUM(CASE WHEN o.status != 4 THEN o.total_pay ELSE 0 END), 0)  AS total_monto,
                IFNULL(SUM(CASE WHEN o.status != 4 THEN o.discount  ELSE 0 END), 0)  AS total_descuentos,
                COUNT(CASE WHEN o.status = 4 THEN 1 END)                             AS total_canceladas
            FROM {$this->bd}order o
            WHERE {$where}
        ";
        $result = $this->_Read($query, $data);
        return !empty($result) ? $result[0] : [
            'total_ventas'      => 0,
            'total_monto'       => 0,
            'total_descuentos'  => 0,
            'total_canceladas'  => 0
        ];
    }

    function updateVenta($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }
}
