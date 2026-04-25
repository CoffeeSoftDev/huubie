<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MReportes extends CRUD {
    protected $util;
    protected $bd;
    protected $bdAlpha;

    public function __construct() {
        $this->util    = new Utileria;
        $this->bd      = 'fayxzvov_reginas.';
        $this->bdAlpha = 'fayxzvov_alpha.';
    }

    function listTickets($array) {
        $query = "
            SELECT
                o.id as folio_cuenta,
                o.date_creation as fecha,
                c.name as cuenta,
                o.order_type,
                COALESCE(o.discount, 0) as descuento_importe,
                COALESCE(o.total_pay, 0) as importe,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 1 THEN pp.pay ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 2 THEN pp.pay ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 3 THEN pp.pay ELSE 0 END), 0) as transferencia,
                o.status,
                o.cash_shift_id
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND (o.subsidiaries_id = ? OR ? = '0')
            GROUP BY o.id
            ORDER BY o.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listShifts($array) {
        $query = "
            SELECT
                cs.id, cs.shift_name, cs.opened_at, cs.closed_at,
                cs.opening_amount, cs.total_sales,
                COALESCE(cs.cash, 0) as total_cash,
                COALESCE(cs.card, 0) as total_card,
                COALESCE(cs.transfer, 0) as total_transfer,
                cs.total_orders, cs.status,
                u.fullname as employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN {$this->bdAlpha}usr_users u ON u.id = cs.employee_id
            WHERE (cs.subsidiary_id = ? OR ? = '0')
            AND DATE(cs.opened_at) BETWEEN ? AND ?
            ORDER BY cs.opened_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function getShiftDetailById($array) {
        $query = "
            SELECT
                cs.id, cs.shift_name, cs.opened_at, cs.closed_at,
                cs.opening_amount, cs.total_sales,
                COALESCE(cs.cash, 0) as total_cash,
                COALESCE(cs.card, 0) as total_card,
                COALESCE(cs.transfer, 0) as total_transfer,
                cs.total_orders, cs.status,
                u.fullname as employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN {$this->bdAlpha}usr_users u ON u.id = cs.employee_id
            WHERE cs.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getShiftTickets($array) {
        $query = "
            SELECT
                o.id as folio_cuenta,
                o.date_creation as fecha,
                c.name as cuenta,
                o.order_type,
                COALESCE(o.discount, 0) as descuento_importe,
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

    function listDailyTickets($array) {
        $query = "
            SELECT
                DATE(o.date_creation) as fecha,
                COUNT(*) as total_tickets,
                COALESCE(SUM(o.total_pay), 0) as importe,
                COALESCE(SUM(o.discount), 0) as descuento,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 1 THEN pp.pay ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 2 THEN pp.pay ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 3 THEN pp.pay ELSE 0 END), 0) as transferencia
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_payments pp ON pp.order_id = o.id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND (o.subsidiaries_id = ? OR ? = '0')
            AND o.status != 4
            GROUP BY DATE(o.date_creation)
            ORDER BY fecha ASC
        ";
        return $this->_Read($query, $array);
    }

    function getShiftSummary($array) {
        $query = "
            SELECT
                COALESCE(SUM(cs.total_sales), 0) as venta_bruta,
                COALESCE(SUM(cs.cash), 0) as total_efectivo,
                COALESCE(SUM(cs.card), 0) as total_tarjeta,
                COALESCE(SUM(cs.transfer), 0) as total_transferencia,
                COALESCE(SUM(cs.total_orders), 0) as total_tickets,
                COALESCE(SUM(cs.opening_amount), 0) as efectivo_inicial
            FROM {$this->bd}cash_shift cs
            WHERE (cs.subsidiary_id = ? OR ? = '0')
            AND DATE(cs.opened_at) BETWEEN ? AND ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getOrderStats($array) {
        $query = "
            SELECT
                COUNT(*) as total_cuentas,
                SUM(CASE WHEN o.status = 1 THEN 1 ELSE 0 END) as cotizaciones,
                SUM(CASE WHEN o.status = 2 THEN 1 ELSE 0 END) as pendientes,
                SUM(CASE WHEN o.status = 3 THEN 1 ELSE 0 END) as pagadas,
                SUM(CASE WHEN o.status = 4 THEN 1 ELSE 0 END) as canceladas,
                SUM(CASE WHEN o.discount > 0 THEN 1 ELSE 0 END) as con_descuento,
                COALESCE(SUM(o.discount), 0) as importe_descuentos,
                COALESCE(AVG(CASE WHEN o.status != 4 THEN o.total_pay ELSE NULL END), 0) as cuenta_promedio,
                MIN(o.id) as folio_inicial,
                MAX(o.id) as folio_final
            FROM {$this->bd}`order` o
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND (o.subsidiaries_id = ? OR ? = '0')
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getPaymentBreakdown($array) {
        $query = "
            SELECT
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 1 THEN pp.pay ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 2 THEN pp.pay ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(CASE WHEN pp.method_pay_id = 3 THEN pp.pay ELSE 0 END), 0) as transferencia
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` o ON o.id = pp.order_id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND (o.subsidiaries_id = ? OR ? = '0')
            AND o.status != 4
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getSalesByCategory($array) {
        $query = "
            SELECT
                CASE
                    WHEN op.custom_id IS NOT NULL AND op.product_id IS NULL THEN 'Personalizado'
                    WHEN op.product_id IS NOT NULL THEN COALESCE(oc.classification, 'Sin Categoria')
                    ELSE 'Otros'
                END as categoria,
                COALESCE(SUM(
                    CASE
                        WHEN op.custom_id IS NOT NULL AND op.product_id IS NULL THEN COALESCE(ocust.price, 0) * op.quantity
                        WHEN op.product_id IS NOT NULL THEN COALESCE(pr.price, 0) * op.quantity
                        ELSE 0
                    END
                ), 0) as total
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}`order` o ON o.id = op.pedidos_id
            LEFT JOIN {$this->bd}order_products pr ON pr.id = op.product_id
            LEFT JOIN {$this->bd}order_category oc ON oc.id = pr.category_id
            LEFT JOIN {$this->bd}order_custom ocust ON ocust.id = op.custom_id
            WHERE DATE(o.date_creation) BETWEEN ? AND ?
            AND (o.subsidiaries_id = ? OR ? = '0')
            AND o.status != 4
            GROUP BY categoria
            ORDER BY total DESC
        ";
        $result = $this->_Read($query, $array);
        $data = [];

        if (is_array($result) && !empty($result)) {
            foreach ($result as $row) {
                $data[] = [
                    'categoria' => $row['categoria'],
                    'total'     => floatval($row['total'])
                ];
            }
        }

        return $data;
    }

    function getProductsByOrder($array) {
        $query = "
            SELECT
                COALESCE(pr.name, oc.name, 'Sin producto') as nombre,
                op.quantity
            FROM {$this->bd}order_package op
            LEFT JOIN {$this->bd}order_products pr ON pr.id = op.product_id
            LEFT JOIN {$this->bd}order_custom oc ON oc.id = op.custom_id
            WHERE op.pedidos_id = ?
        ";
        return $this->_Read($query, $array);
    }

    function getSubsidiariesByCompany($array) {
        $query = "
            SELECT id, name as valor
            FROM {$this->bdAlpha}subsidiaries
            WHERE companies_id = ?
            ORDER BY name
        ";
        return $this->_Read($query, $array);
    }
}
