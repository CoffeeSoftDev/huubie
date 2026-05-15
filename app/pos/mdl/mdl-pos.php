<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'rfwsmqex_reginas.';
    }

    // =========================================================================
    // Catálogos / Init
    // =========================================================================

    function lsSucursales() {
        $query = "
            SELECT
                s.id   AS id,
                CONCAT(c.social_name, ' — ', s.name) AS valor,
                s.name AS sucursal,
                c.social_name AS company
            FROM fayxzvov_alpha.subsidiaries s
            INNER JOIN fayxzvov_admin.companies c ON s.companies_id = c.id
            WHERE s.active = 1
            ORDER BY c.social_name, s.name
        ";
        return $this->_Read($query, null);
    }

    function lsProducts($array) {
        $query = "
            SELECT
                p.id,
                p.name,
                p.price,
                p.stock,
                p.image,
                p.icon,
                c.classification AS category
            FROM {$this->bd}pos_products p
            LEFT JOIN {$this->bd}pos_category c ON p.category_id = c.id
            WHERE p.active = 1 AND p.subsidiary_id = ?
            ORDER BY c.id, p.name
        ";
        return $this->_Read($query, $array);
    }

    function lsPaymentTypes() {
        return $this->_Select([
            'table'  => "{$this->bd}pos_payment_type",
            'values' => 'id, code AS payment_code, name AS payment_name',
            'where'  => 'active = 1',
            'order'  => ['ASC' => 'id']
        ]);
    }

    function lsDiscountReasons() {
        return $this->_Select([
            'table'  => "{$this->bd}pos_discount_reason",
            'values' => 'id, name AS valor',
            'where'  => 'active = 1',
            'order'  => ['ASC' => 'name']
        ]);
    }

    function lsClients($array) {
        $query = "
            SELECT id, name, phone, email
            FROM {$this->bd}order_clients
            WHERE active = 1 AND subsidiary_id = ?
            ORDER BY name
        ";
        return $this->_Read($query, $array);
    }

    function searchClients($array) {
        $query = "
            SELECT id, name, phone, email
            FROM {$this->bd}order_clients
            WHERE active = 1
              AND subsidiary_id = ?
              AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
            ORDER BY name
            LIMIT 10
        ";
        $term = '%' . $array[1] . '%';
        return $this->_Read($query, [$array[0], $term, $term, $term]);
    }

    // =========================================================================
    // Turno (cash_shift) — compartido con Pedidos
    // =========================================================================

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

    function getShiftMetrics($array) {
        $shift_id = $array[0];

        $query = "
            SELECT
                COUNT(*)               AS total_orders,
                COALESCE(SUM(total_pay), 0) AS total_sales
            FROM {$this->bd}`order`
            WHERE cash_shift_id = ? AND status != 'cancelada' AND is_pos = 1
        ";
        $result = $this->_Read($query, [$shift_id]);
        return is_array($result) && !empty($result) ? $result[0] : ['total_orders' => 0, 'total_sales' => 0];
    }

    function getMaxOrderFolio() {
        $query = "SELECT COALESCE(MAX(id), 0) + 1 AS next_folio FROM {$this->bd}`order` WHERE is_pos = 1";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? (int)$result[0]['next_folio'] : 1;
    }

    // =========================================================================
    // Ventas (consulta / listado)
    // =========================================================================

    function listVentas($data) {
        $params = [
            $data['fi'] . ' 00:00:00',
            $data['ff'] . ' 23:59:59'
        ];

        $query = "
            SELECT
                o.id,
                o.status,
                o.total_pay,
                o.discount,
                o.note,
                o.date_order,
                o.time_order,
                o.cash_shift_id,
                o.daily_closure_id,
                oc.id    AS client_id,
                oc.name  AS client_name,
                oc.phone AS client_phone,
                oc.email AS client_email,
                s.name   AS sucursal_name,
                GROUP_CONCAT(pt.code ORDER BY pt.id SEPARATOR ' / ') AS payment_methods
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients  oc ON o.client_id       = oc.id
            LEFT JOIN fayxzvov_alpha.subsidiaries s ON o.subsidiaries_id = s.id
            LEFT JOIN {$this->bd}pos_order_payment pop ON pop.order_id  = o.id
            LEFT JOIN {$this->bd}pos_payment_type  pt  ON pop.payment_type_id = pt.id
            WHERE o.is_pos = 1
              AND o.date_order BETWEEN ? AND ?
        ";

        if (!empty($data['subsidiaries_id']) && $data['subsidiaries_id'] != 0) {
            $query   .= ' AND o.subsidiaries_id = ?';
            $params[] = $data['subsidiaries_id'];
        }

        if (!empty($data['cash_shift_id']) && $data['cash_shift_id'] != 0) {
            $query   .= ' AND o.cash_shift_id = ?';
            $params[] = $data['cash_shift_id'];
        }

        if (!empty($data['status'])) {
            $query   .= ' AND o.status = ?';
            $params[] = $data['status'];
        }

        $query .= ' GROUP BY o.id ORDER BY o.date_order DESC, o.time_order DESC';

        return $this->_Read($query, $params);
    }

    function getVentaCounts($data) {
        $params = [
            $data['fi'] . ' 00:00:00',
            $data['ff'] . ' 23:59:59'
        ];

        $query = "
            SELECT
                COUNT(*)                                              AS total,
                SUM(status = 'pagada')                               AS pagadas,
                SUM(status = 'cancelada')                            AS canceladas,
                SUM(status = 'abierta')                              AS abiertas,
                COALESCE(SUM(CASE WHEN status != 'cancelada' THEN total_pay ELSE 0 END), 0) AS total_ventas,
                COALESCE(SUM(CASE WHEN status != 'cancelada' THEN discount  ELSE 0 END), 0) AS total_descuentos
            FROM {$this->bd}`order`
            WHERE is_pos = 1 AND date_order BETWEEN ? AND ?
        ";

        if (!empty($data['subsidiaries_id']) && $data['subsidiaries_id'] != 0) {
            $query   .= ' AND subsidiaries_id = ?';
            $params[] = $data['subsidiaries_id'];
        }

        if (!empty($data['cash_shift_id']) && $data['cash_shift_id'] != 0) {
            $query   .= ' AND cash_shift_id = ?';
            $params[] = $data['cash_shift_id'];
        }

        $result = $this->_Read($query, $params);
        return is_array($result) && !empty($result) ? $result[0] : [];
    }

    // =========================================================================
    // Venta individual
    // =========================================================================

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
                o.cash_shift_id,
                o.daily_closure_id,
                oc.id    AS client_id,
                oc.name  AS client_name,
                oc.phone AS client_phone,
                oc.email AS client_email,
                s.name   AS sucursal_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients    oc ON o.client_id       = oc.id
            LEFT JOIN fayxzvov_alpha.subsidiaries  s  ON o.subsidiaries_id = s.id
            WHERE o.id = ? AND o.is_pos = 1
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    function getVentaItems($array) {
        $query = "
            SELECT
                oi.id,
                oi.quantity,
                oi.price,
                oi.dedication,
                oi.order_details,
                oi.product_id,
                p.name AS product_name
            FROM {$this->bd}pos_order_items oi
            LEFT JOIN {$this->bd}pos_products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
            ORDER BY oi.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getVentaPagos($array) {
        $query = "
            SELECT
                pt.code           AS payment_code,
                pt.name           AS payment_name,
                pop.amount,
                pop.tendered_amount,
                pop.change_amount
            FROM {$this->bd}pos_order_payment pop
            INNER JOIN {$this->bd}pos_payment_type pt ON pop.payment_type_id = pt.id
            WHERE pop.order_id = ?
            ORDER BY pop.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // =========================================================================
    // Crear / Actualizar venta
    // =========================================================================

    function createVenta($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}`order`",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateVenta($array) {
        return $this->_Update([
            'table'  => "{$this->bd}`order`",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function getMaxOrderId() {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}`order`";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    // =========================================================================
    // Items del ticket
    // =========================================================================

    function createOrderItem($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}pos_order_items",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateOrderItem($array) {
        return $this->_Update([
            'table'  => "{$this->bd}pos_order_items",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function deleteOrderItems($array) {
        $query = "DELETE FROM {$this->bd}pos_order_items WHERE order_id = ?";
        return $this->_CUD($query, $array);
    }

    // =========================================================================
    // Pagos del ticket (HU-03)
    // =========================================================================

    function createOrderPayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}pos_order_payment",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteOrderPayments($array) {
        $query = "DELETE FROM {$this->bd}pos_order_payment WHERE order_id = ?";
        return $this->_CUD($query, $array);
    }

    function getTotalPaid($array) {
        $query = "
            SELECT COALESCE(SUM(amount), 0) AS total_paid
            FROM {$this->bd}pos_order_payment
            WHERE order_id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? (float)$result[0]['total_paid'] : 0.0;
    }

    // =========================================================================
    // Descuentos (HU-04)
    // =========================================================================

    function createOrderDiscount($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}pos_order_discount",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteOrderDiscounts($array) {
        $query = "DELETE FROM {$this->bd}pos_order_discount WHERE order_id = ?";
        return $this->_CUD($query, $array);
    }

    // =========================================================================
    // Clientes
    // =========================================================================

    function createClient($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getClientById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_clients",
            'values' => 'id, name, phone, email',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0] ?? null;
    }
}
