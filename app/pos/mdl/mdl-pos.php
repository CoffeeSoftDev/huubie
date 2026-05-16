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

    // =========================================================================
    // Catálogos / Init
    // =========================================================================

    function lsSucursales() {
        $query = "
            SELECT
                s.id AS id,
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

    // Productos — usa order_products + order_category (tablas reales del schema)
    function lsProducts($array) {
        $leftjoin = [
            $this->bd . 'order_category' => 'order_products.category_id = order_category.id'
        ];
        return $this->_Select([
            'table'    => $this->bd . 'order_products',
            'values'   => 'order_products.id, order_products.name, order_products.price, order_products.description, order_products.image, order_category.classification AS category',
            'leftjoin' => $leftjoin,
            'where'    => 'order_products.active = 1 AND order_products.subsidiaries_id = ?',
            'order'    => ['ASC' => 'order_category.id, order_products.name'],
            'data'     => $array
        ]);
    }

    // Tipos de pago POS — pos_payment_type (columnas: code, name)
    function lsPaymentTypes() {
        $query = "
            SELECT id, code, name
            FROM {$this->bd}pos_payment_type
            WHERE active = 1
            ORDER BY id
        ";
        return $this->_Read($query, null);
    }

    // Motivos de descuento — pos_discount_reason (columnas: id, name)
    function lsDiscountReasons() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}pos_discount_reason
            WHERE active = 1
            ORDER BY name
        ";
        return $this->_Read($query, null);
    }

    // Clientes — order_clients usa subsidiaries_id (no subsidiary_id)
    function lsClients($array) {
        $query = "
            SELECT id, name, phone, email
            FROM {$this->bd}order_clients
            WHERE active = 1 AND subsidiaries_id = ?
            ORDER BY name
        ";
        return $this->_Read($query, $array);
    }

    function searchClients($array) {
        $term  = '%' . $array[1] . '%';
        $query = "
            SELECT id, name, phone, email
            FROM {$this->bd}order_clients
            WHERE active = 1
              AND subsidiaries_id = ?
              AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
            ORDER BY name
            LIMIT 10
        ";
        return $this->_Read($query, [$array[0], $term, $term, $term]);
    }

    // =========================================================================
    // Turno (cash_shift) — subsidiary_id es el nombre real en cash_shift
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

    // order.status es INT → join status_process para filtrar por label
    function getShiftMetrics($array) {
        $query = "
            SELECT
                COUNT(*)                    AS total_orders,
                COALESCE(SUM(o.total_pay), 0) AS total_sales
            FROM {$this->bd}`order` o
            INNER JOIN {$this->bd}status_process sp ON o.status = sp.id
            WHERE o.cash_shift_id = ?
              AND sp.status != 'cancelada'
              AND o.is_pos = 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total_orders' => 0, 'total_sales' => 0];
    }

    function getMaxOrderFolio() {
        $query = "SELECT COALESCE(MAX(id), 0) + 1 AS next_folio FROM {$this->bd}`order` WHERE is_pos = 1";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? (int)$result[0]['next_folio'] : 1;
    }

    // =========================================================================
    // Ventas — listado
    // =========================================================================

    // order.status es INT → join status_process para devolver el label al ctrl
    function listVentas($data) {
        $params = [
            $data['fi'] . ' 00:00:00',
            $data['ff'] . ' 23:59:59'
        ];

        $query = "
            SELECT
                o.id,
                o.total_pay,
                o.discount,
                o.note,
                o.date_order,
                o.time_order,
                o.cash_shift_id,
                o.daily_closure_id,
                sp.status                                              AS status,
                oc.id                                                  AS client_id,
                oc.name                                                AS client_name,
                oc.phone                                               AS client_phone,
                oc.email                                               AS client_email,
                s.name                                                 AS sucursal_name,
                GROUP_CONCAT(pt.code ORDER BY pt.id SEPARATOR ' / ')  AS payment_methods
            FROM {$this->bd}`order` o
            INNER JOIN {$this->bd}status_process sp         ON o.status          = sp.id
            LEFT JOIN  {$this->bd}order_clients  oc         ON o.client_id       = oc.id
            LEFT JOIN  fayxzvov_alpha.subsidiaries s         ON o.subsidiaries_id = s.id
            LEFT JOIN  {$this->bd}pos_order_payment pop      ON pop.order_id      = o.id
            LEFT JOIN  {$this->bd}pos_payment_type  pt       ON pop.pos_payment_type_id = pt.id
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
            $query   .= ' AND sp.status = ?';
            $params[] = $data['status'];
        }

        $query .= ' GROUP BY o.id ORDER BY o.date_order DESC, o.time_order DESC';

        return $this->_Read($query, $params);
    }

    // Conteos — join status_process para filtrar por label string
    function getVentaCounts($data) {
        $params = [
            $data['fi'] . ' 00:00:00',
            $data['ff'] . ' 23:59:59'
        ];

        $query = "
            SELECT
                COUNT(*)                                                                              AS total,
                SUM(sp.status = 'pagada')                                                            AS pagadas,
                SUM(sp.status = 'cancelada')                                                         AS canceladas,
                SUM(sp.status = 'abierta')                                                           AS abiertas,
                COALESCE(SUM(CASE WHEN sp.status != 'cancelada' THEN o.total_pay ELSE 0 END), 0)    AS total_ventas,
                COALESCE(SUM(CASE WHEN sp.status != 'cancelada' THEN o.discount  ELSE 0 END), 0)    AS total_descuentos
            FROM {$this->bd}`order` o
            INNER JOIN {$this->bd}status_process sp ON o.status = sp.id
            WHERE o.is_pos = 1 AND o.date_order BETWEEN ? AND ?
        ";

        if (!empty($data['subsidiaries_id']) && $data['subsidiaries_id'] != 0) {
            $query   .= ' AND o.subsidiaries_id = ?';
            $params[] = $data['subsidiaries_id'];
        }

        if (!empty($data['cash_shift_id']) && $data['cash_shift_id'] != 0) {
            $query   .= ' AND o.cash_shift_id = ?';
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
                o.total_pay,
                o.discount,
                o.note,
                o.date_order,
                o.time_order,
                o.cash_shift_id,
                o.daily_closure_id,
                sp.status               AS status,
                oc.id                   AS client_id,
                oc.name                 AS client_name,
                oc.phone                AS client_phone,
                oc.email                AS client_email,
                s.name                  AS sucursal_name
            FROM {$this->bd}`order` o
            INNER JOIN {$this->bd}status_process    sp ON o.status          = sp.id
            LEFT JOIN  {$this->bd}order_clients     oc ON o.client_id       = oc.id
            LEFT JOIN  fayxzvov_alpha.subsidiaries   s  ON o.subsidiaries_id = s.id
            WHERE o.id = ? AND o.is_pos = 1
            LIMIT 1
        ";
        return $this->_Read($query, $array);
    }

    // Items — usa order_package (pedidos_id = order_id) + order_products
    function getVentaItems($array) {
        $query = "
            SELECT
                pkg.id,
                pkg.quantity,
                pkg.price,
                pkg.dedication,
                pkg.order_details,
                pkg.product_id,
                p.name AS product_name
            FROM {$this->bd}order_package pkg
            LEFT JOIN {$this->bd}order_products p ON pkg.product_id = p.id
            WHERE pkg.pedidos_id = ?
            ORDER BY pkg.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // Pagos POS — pos_order_payment usa pos_payment_type_id (no payment_type_id)
    function getVentaPagos($array) {
        $query = "
            SELECT
                pt.code AS payment_code,
                pt.name AS payment_name,
                pop.amount,
                pop.tendered_amount,
                pop.change_amount
            FROM {$this->bd}pos_order_payment pop
            INNER JOIN {$this->bd}pos_payment_type pt ON pop.pos_payment_type_id = pt.id
            WHERE pop.order_id = ? AND pop.active = 1
            ORDER BY pop.id ASC
        ";
        return $this->_Read($query, $array);
    }

    // =========================================================================
    // Crear / Actualizar orden
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
    // Items del ticket — order_package con pedidos_id como FK a order
    // =========================================================================

    function createOrderItem($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateOrderItem($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    // Eliminar todos los items de una orden por pedidos_id
    function deleteOrderItems($array) {
        $query = "DELETE FROM {$this->bd}order_package WHERE pedidos_id = ?";
        return $this->_CUD($query, $array);
    }

    // =========================================================================
    // Pagos POS — pos_order_payment
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
            WHERE order_id = ? AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? (float)$result[0]['total_paid'] : 0.0;
    }

    // =========================================================================
    // Descuentos POS — pos_order_discount
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
    // Clientes — order_clients
    // =========================================================================

    function createClient($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getClientById($array) {
        $query = "
            SELECT id, name, phone, email
            FROM {$this->bd}order_clients
            WHERE id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }
}
