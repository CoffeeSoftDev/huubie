<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MPedidos extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    // init

    function lsStatus(){
        $query = "SELECT
            id as id,
            status as valor
        FROM
           {$this->bd}status_process ";
        return $this->_Read($query, null);
    }

    function lsSucursales(){
        $query = "SELECT
            s.id as id,
            CONCAT(c.social_name, ' - ', s.name) as valor,
            s.name as sucursal,
            c.social_name as company
        FROM
            fayxzvov_alpha.subsidiaries s
        INNER JOIN fayxzvov_admin.companies c ON s.companies_id = c.id
        WHERE s.active = 1
        ORDER BY c.social_name, s.name";
        return $this->_Read($query, null);
    }

    function getSubsidiariesByCompany($array){
        $query = "SELECT
            id,
            name as valor
            
        FROM
            fayxzvov_alpha.subsidiaries
        WHERE 
            companies_id = ?
        ORDER BY name";
        return $this->_Read($query, $array);
    }


    public function getAdvancedPay($array) {
        return $this->_Select([
            'table' => "{$this->bd}eventos_pagos",
            'values' => "SUM(monto) AS totalPay",
            'where' => "eventos_id = ?",
            'data' => $array
        ])[0];
    }

    public function getSubEventsByEventId($array) {
        return $this->_Select([
            'table'  => "{$this->bd}sub_eventos",
            'values' => "*",
            'where'  => "eventos_id = ?",
            'data'   => $array
        ]);
    }

    // Order.

    function getSucursalByID($array){
        $query = "SELECT
            fayxzvov_alpha.subsidiaries.id AS idSucursal,
            fayxzvov_admin.companies.id AS idCompany,
            fayxzvov_admin.companies.social_name as name,
            fayxzvov_alpha.subsidiaries.`name` as sucursal
        FROM
            fayxzvov_alpha.subsidiaries
        INNER JOIN fayxzvov_admin.companies ON fayxzvov_alpha.subsidiaries.companies_id = fayxzvov_admin.companies.id
        where subsidiaries.id = ?";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getOrderID($array){
        $sql = "
        SELECT
            order_clients.name,
            order_clients.phone,
            order.id,
            order.id as folio,
            order.date_creation,
            email,
            order.note,
            order.discount,
            order.status,
            order.delivery_type,
            order.is_delivered,
            order.total_pay,
            order.subsidiaries_id,
            DATE_FORMAT(date_order, '%d/%m/%Y') AS date_order,
            DATE_FORMAT(time_order, '%h:%i %p') AS time_order
        FROM
            {$this->bd}order
        INNER JOIN {$this->bd}order_clients ON order.client_id = order_clients.id

        WHERE order.id = ?

        ";
        return $this->_Read($sql,$array);

    }

    function getMaxOrder() {


        $query = "
            SELECT
                MAX(order.id) as id
            FROM
            fayxzvov_reginas.order";


        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function getOrders($data) {
        $startDate = $data['fi'] . ' 00:00:00';
        $endDate   = $data['ff'] . ' 23:59:59';

        $params    = [
            $startDate,
            $endDate
        ];

        $query = "
        SELECT
            order.id AS id,
            DATE_FORMAT( order.date_creation, '%Y-%m-%d' ) AS date_creation,
            order.note,
            DATE_FORMAT( order.date_birthday,'%Y-%m-%d' ) AS date_birthday,
            order.STATUS,
            order.location,
            order.total_pay,
            order.discount,
            order.subsidiaries_id,
            order.info_discount,
            order.is_delivered,
            order.delivery_type,
            order_clients. NAME AS name_client,
            order_clients.phone AS phone,
            order_clients.email AS email,
            status_process. STATUS AS status_label,
            DATE_FORMAT( order.date_order,'%Y-%m-%d' ) AS date_order,

            DATE_FORMAT(order.time_order, '%h:%i %p') AS time_order,

            status_process.id AS idStatus,
            order.cash_shift_id
        FROM
            {$this->bd}order
        INNER JOIN {$this->bd}order_clients ON client_id = order_clients.id
        INNER JOIN {$this->bd}status_process ON order.STATUS = status_process.id
        WHERE
        order.date_creation BETWEEN ? AND ?
        ";

        // Filtrar por subsidiaries_id si se proporciona y es diferente de 0
        if (!empty($data['subsidiaries_id']) && $data['subsidiaries_id'] != 0) {
            $query .= " AND order.subsidiaries_id = ?";
            $params[] = $data['subsidiaries_id'];
        }

        // Filtrar por status si se proporciona y es diferente de 0
        if (!empty($data['status']) && $data['status'] !== '0') {
            $query .= " AND order.status = ?";
            $params[] = $data['status'];
        }

        $query .= " ORDER BY
           
            order.date_creation DESC";

            //  status_process.id ASC,

        return $this->_Read($query, $params);
    }

    function createOrder($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateOrder($array){
        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function deleteOrderById($array){
        $query = "
            DELETE FROM {$this->bd}order
            WHERE id = ?
        ";

        return $this->_CUD($query, $array);
    }

    // add Cliente.
    function createClient($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getClientName($array){
        $query = "
            SELECT
                order_clients.id as id
            FROM
            {$this->bd}order_clients

            WHERE name = ? ";

        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : [];
    }

     function getAllClients($array){
        $query = "
            SELECT
                name,
                phone,
                email
            FROM
            {$this->bd}order_clients
            WHERE active = 1 AND subsidiaries_id = ?
             ";

        return $this->_Read($query, $array);
    }

    function getClientById($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_clients",
            'values' => '*',
            'where'  => 'id = ?',
            'data'   => $array
        ])[0];
    }

    function updateClient($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_clients",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    // add Payment.
    function getPaymentByID($array){
        $query = "
           SELECT
            evt_payments.id,
            SUM(evt_payments.pay) as valor,
            method_pay.method_pay

            FROM
            {$this->bd}order_payments
            INNER JOIN {$this->bd}method_pay ON evt_payments.method_pay_id = method_pay.id
            WHERE evt_events_id = ?

            GROUP BY method_pay
        ";
        return $this->_Read($query, $array);
    }

    function getMethodPay($array){
        $query = "
            SELECT
                method_pay.id,
                method_pay.method_pay
            FROM
                {$this->bd}method_pay
            WHERE id = ?
        ";

        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) && isset($result[0]['method_pay']) ? $result[0]['method_pay'] : null;
    }

    function addMethodPay($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_payments",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function registerPayment($array) {

        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function getMethodPayment($array) {
        $query = "
            SELECT
            order_payments.method_pay_id,
            method_pay.method_pay,
            SUM(order_payments.pay) AS pay
            FROM
            {$this->bd}order_payments
            INNER JOIN {$this->bd}method_pay ON order_payments.method_pay_id = method_pay.id
            WHERE
            order_payments.order_id = ?
            GROUP BY
            order_payments.method_pay_id,
            method_pay.method_pay
            ORDER BY
            method_pay.method_pay ASC
        ";
        return $this->_Read($query, $array);
    }

    function getListPayment($array) {
        $query = "
        SELECT
        order_payments.id,
        order_payments.date_pay,
        order_payments.pay,
        method_pay.method_pay,
        order_payments.method_pay_id,
        order_payments.type,
        order_payments.description
        FROM
            {$this->bd}order_payments
        INNER JOIN
            {$this->bd}method_pay ON order_payments.method_pay_id = method_pay.id
        WHERE
            order_id = ?
        ORDER BY
            order_payments.id ASC
        ";
        return $this->_Read($query,$array);
    }


    // Clausules.
    function listClausules($array){
        $query = "
           SELECT
            evt_clausules.id AS id,
            evt_clausules.`name` AS `name`,
            evt_clausules.active,
            DATE_FORMAT(date_creation, '%d-%m-%Y') AS date_creation,
            evt_clausules.companies_id
            FROM
            fayxzvov_alpha.evt_clausules
            WHERE
            evt_clausules.active = ? and companies_id = ?

        ";
        return $this->_Read($query, $array);
    }




    // Histories.

    function listHistories($array) {
        $query = "
            SELECT
                order_histories.id as id,
                order_histories.title as valor,
                order_histories.action as message,
                DATE_FORMAT(order_histories.date_action, '%d/%m/%Y %h:%i %p') as date,
                order_histories.comment,
                order_histories.type,
                fullname AS author
            FROM
                {$this->bd}order_histories
            LEFT JOIN fayxzvov_alpha.usr_users ON order_histories.usr_users_id = fayxzvov_alpha.usr_users.id
            WHERE
                order_histories.order_id = ?
            ORDER BY
                order_histories.date_action DESC
        ";
        return $this->_Read($query, $array);
    }

    function addHistories($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_histories",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    


    // Reservations.
    public function createReservation($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}evt_reservation",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    public function updateReservation($array) {
        return $this->_Update([
            'table' => "{$this->bd}evt_events",
            'values' => $array['values'],
            'where' => $array['where'],
            'data' => $array['data']
        ]);
    }

    public function getReservationById($array) {
        return $this->_Select([
            'table' => "{$this->bd}evt_events",
            'values' => "*",
            'where' => "id = ?",
            'data' => $array
        ])[0];
    }

    // Products.
    function getAllModifiers($array) {
        return $this->_Select([
            'table'  => "{$this->bd}order_modifier",
            'values' => 'id , name as text, active, isExtra',
            'where'  => 'active = ?',
            'data'   => $array
        ]);
    }

    public function lsModifierByID($array) {
        $sql = "
            SELECT id, name, price
            FROM {$this->bd}order_modifier_products
            WHERE active=1 AND modifier_id = ?
        ";
        return $this->_Read($sql, $array);
    }

    public function getAllCategory($array) {
        $sql = "
            SELECT id, classification as text, description
            FROM {$this->bd}order_category
            WHERE active = ?
        ";
        return $this->_Read($sql, $array);
    }

    function lsProductos($array){
        $leftjoin = [
            $this->bd . 'order_category' => 'order_products.category_id = order_category.id'
        ];

        return $this->_Select([
            'table'    => $this->bd . 'order_products',
            'values'   =>
                "order_products.id as id,
                order_products.name AS valor,
                order_products.price,
                order_products.description,
                order_products.image,
                order_category.classification,
                DATE_FORMAT(order_products.date_creation, '%d %M %Y') as date_creation,
                order_products.active",

            'leftjoin' => $leftjoin,
            'where'    => 'order_products.active = ?',
            'order'    => ['ASC' => 'order_products.id'],
            'data'     => [$array[0]]
        ]);
    }

    function getProductById($id) {
        $leftjoin = [
            $this->bd . 'order_category' => 'order_products.category_id = order_category.id'
        ];

        return $this->_Select([
            'table' => $this->bd . 'order_products',
            'values' => "
                order_products.id,
                order_products.name,
                order_products.price,
                order_products.description,
                order_products.image,
                order_category.classification as category,
                order_products.active
            ",
            'leftjoin' => $leftjoin,
            'where' => 'order_products.id = ? AND order_products.active = 1',
            'data' => [$id]
        ])[0] ?? null;
    }

    function deleteProduct($array){

        return $this->_Delete([
            'table' => "{$this->bd}order_package",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function getOrderProducts($array) {
        $query = "
            SELECT
                op.id,
                op.quantity,
                op.order_details,
                op.dedication,
                prod.name as product_name,
                prod.price as unit_price,
                prod.description,
                prod.image,
                (op.quantity * prod.price) as total_price,
                cat.classification as category
            FROM
                {$this->bd}order_package op
            INNER JOIN {$this->bd}order_products prod ON op.product_id = prod.id
            LEFT JOIN {$this->bd}order_category cat ON prod.category_id = cat.id
            WHERE
                op.pedidos_id = ?
            ORDER BY
                op.id ASC
        ";
        return $this->_Read($query, $array);
    }



    public function listProductsById($array) {
        $sql = "
            SELECT id, name AS valor, price, description, image
            FROM {$this->bd}order_products
            WHERE category_id = ? AND active = 1
        ";
        return $this->_Read($sql, [$array[0]]);
    }

    public function createProduct($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    public function getOrderById($array) {
        // $sql = "
        //     SELECT
        //         order_package.id as id,
        //         order_products.`name` as name,
        //         order_products.price,
        //         order_package.quantity,
        //         order_package.order_details,
        //         order_products.description,
        //         order_package.dedication,
        //         order_products.image,
        //         order_package.custom_id,
        //         order_custom.name as custom_name,
        //         order_custom.price as custom_price,
        //         order_custom.price_real as custom_price_real,
        //         order_custom.portion_qty as custom_portion_qty
        //     FROM
        //         {$this->bd}order_package
        //     INNER JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
        //     LEFT JOIN {$this->bd}order_custom ON order_package.custom_id = order_custom.id
        //     WHERE pedidos_id = ?
        // ";

         $sql = "
            SELECT
                order_package.id,
                -- 🔹 Si existe un producto normal, toma su nombre; si no, toma el del personalizado
                COALESCE(order_products.name, order_custom.name) AS name,

                -- 🔹 Igual para el precio
                COALESCE(order_products.price, order_custom.price_real) AS price,

                -- 🔹 Cantidad siempre viene de order_package
                order_package.quantity,

                order_package.order_details,
                order_package.dedication,
                order_package.product_id,
                order_package.custom_id,
                order_custom.portion_qty,

                -- 🔹 Descripción e imagen, solo si existe en el producto o en el personalizado
                COALESCE(order_products.description, order_custom.description) AS description,
                COALESCE(order_products.image, order_custom.image) AS image

            FROM
                {$this->bd}order_package
            LEFT JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
            LEFT JOIN {$this->bd}order_custom   ON order_package.custom_id  = order_custom.id
            WHERE
                order_package.pedidos_id = ?
        ";
        
        $products = $this->_Read($sql, $array);
        
        foreach ($products as &$product) {

            $product['images'] = $this->getOrderImages([$product['id']]);
            
            if (!empty($product['custom_id'])) {

                $product['is_custom'] = true;
                
                // Obtener productos personalizados (modificadores)
                $product['customer_products'] = $this->getCustomProduct([$product['custom_id']]);
                
                if (!empty($product['custom_price_real'])) {
                    $product['price'] = $product['custom_price_real'];
                } else if (!empty($product['custom_price'])) {
                    $product['price'] = $product['custom_price'];
                }
                
                if (!empty($product['custom_name'])) {
                    $product['name'] = $product['custom_name'];
                }
            } else {
                $product['is_custom'] = false;
                $product['customer_products'] = [];
            }
        }
        unset($product);
        
        return $products;
    }

    function getCustomProduct($array) {
        $query = "
        SELECT
                ocp.id,
                ocp.price AS custom_price,
                ocp.quantity AS custom_quantity,
                ocp.details,
                omp.`name`,
                omp.price,
                omp.description,
                order_modifier.`name` as modifier_name,
                order_modifier.isExtra
                FROM
                {$this->bd}order_custom_products AS ocp
                INNER JOIN {$this->bd}order_modifier_products AS omp ON ocp.modifier_id = omp.id
                INNER JOIN {$this->bd}order_modifier ON omp.modifier_id = order_modifier.id
            WHERE
                ocp.custom_id = ?
            ORDER BY
                ocp.id ASC
        ";
        
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }




    function getOrderPackageByID($array) {
        $sql = "
            SELECT
                order_package.id,
                COALESCE(order_products.`name`, 'Producto personalizado') as name,
                COALESCE(order_products.price, order_package.price) as price,
                order_package.quantity,
                order_package.dedication,
                order_package.order_details,
                order_products.description,
                order_package.custom_id,
                order_products.image
            FROM
                {$this->bd}order_package
            LEFT JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
            WHERE order_package.id = ?
        ";

        $result = $this->_Read($sql, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function updatePackage($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    public function addOrderImages($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_images",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getOrderImages($array){

        $query =
        "
        SELECT
            order_images.id,
            order_images.path,
            order_images.name,
            order_images.original_name,
            order_images.package_id
        FROM {$this->bd}order_images
        WHERE package_id = ?

        ";

        return $this->_Read($query, $array);

    }

    function removeOrderImages($array){
        $query = "
            DELETE FROM {$this->bd}order_images
            WHERE package_id = ?
        ";

        return $this->_CUD($query, $array);
    }






    // Payment.










    public function getTotalPaidByOrder($array) {
        $query = "
            SELECT COALESCE(SUM(op.pay), 0) AS total_paid
            FROM {$this->bd}order_payments op
            WHERE op.order_id = ?
        ";
        $res = $this->_Read($query, $array);
        return isset($res[0]['total_paid']) ? (float)$res[0]['total_paid'] : 0.0;
    }


    function deletePayment($array){

        return $this->_Delete([
            'table' => "{$this->bd}order_payments",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    // Dashboard Metrics Methods

    function getOrdersByMonth($params) {
        return $this->_Select([
            'table' => "{$this->bd}order",
            'values' => "id, date_creation, total_pay, status",
            'where' => "MONTH(date_creation) = ? AND YEAR(date_creation) = ? AND subsidiaries_id = ?",
            'data' => $params
        ]);
    }

    function getCompletedSales($params) {
        $query = "
            SELECT 
                COUNT(*) as count, 
                COALESCE(SUM(total_pay), 0) as amount
            FROM {$this->bd}order 
            WHERE status = 3 
            AND MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ? 
            AND subsidiaries_id = ?
        ";
        
        $result = $this->_Read($query, $params);
        return $result[0] ?? ['count' => 0, 'amount' => 0];
    }

    function getPendingSales($params) {
        $query = "
            SELECT 
                COUNT(*) as count, 
                COALESCE(SUM(total_pay - COALESCE(
                    (SELECT SUM(pay) FROM {$this->bd}order_payments WHERE order_id = {$this->bd}order.id), 0
                )), 0) as amount
            FROM {$this->bd}order 
            WHERE status IN (1, 2) 
            AND MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ? 
            AND subsidiaries_id = ?
        ";
        
        $result = $this->_Read($query, $params);
        return $result[0] ?? ['count' => 0, 'amount' => 0];
    }

    function getOrdersChartData($params) {
        $query = "
            SELECT 
                WEEK(date_creation, 1) - WEEK(DATE_SUB(date_creation, INTERVAL DAYOFMONTH(date_creation) - 1 DAY), 1) + 1 as week_of_month,
                COUNT(*) as orders_count
            FROM {$this->bd}order 
            WHERE MONTH(date_creation) = ? 
            AND YEAR(date_creation) = ? 
            AND subsidiaries_id = ?
            GROUP BY week_of_month
            ORDER BY week_of_month
        ";
        
        $result = $this->_Read($query, $params);
        
        $labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'];
        $data = [0, 0, 0, 0, 0];
        
        foreach ($result as $row) {
            $weekIndex = intval($row['week_of_month']) - 1;
            if ($weekIndex >= 0 && $weekIndex < 5) {
                $data[$weekIndex] = intval($row['orders_count']);
            }
        }
        
        return [
            'labels' => array_slice($labels, 0, count(array_filter($data)) ?: 4),
            'datasets' => [
                [
                    'data' => array_slice($data, 0, count(array_filter($data)) ?: 4),
                    'borderColor' => '#3B82F6',
                    'backgroundColor' => 'transparent'
                ]
            ]
        ];
    }

    function getOrdersDashboard($params) {
        $mes = $params['mes'];
        $anio = $params['anio'];
        $subsidiariesId = $params['subsidiariesId'];

        $whereClause = "MONTH(date_creation) = ? AND YEAR(date_creation) = ? AND status != 4";
        $data = [$mes, $anio];

        if ($subsidiariesId !== 'all') {
            $whereClause .= " AND subsidiaries_id = ?";
            $data[] = $subsidiariesId;
        }

        $query = "
            SELECT 
                COUNT(*) as numPedidos,
                COALESCE(SUM(total_pay - COALESCE(discount, 0)), 0) as totalVentas,
                COALESCE(AVG(total_pay - COALESCE(discount, 0)), 0) as chequePromedio,
                COUNT(DISTINCT client_id) as numClientes
            FROM {$this->bd}order
            WHERE $whereClause
        ";

        $result = $this->_Read($query, $data);
        return $result[0] ?? [
            'numPedidos' => 0,
            'totalVentas' => 0,
            'chequePromedio' => 0,
            'numClientes' => 0
        ];
    }

    function getOrdersByDay($params) {
        $mes = $params['mes'];
        $anio = $params['anio'];
        $subsidiariesId = $params['subsidiariesId'];

        $whereClause = "MONTH(date_creation) = ? AND YEAR(date_creation) = ? AND status != 4";
        $data = [$mes, $anio];

        if ($subsidiariesId !== 'all') {
            $whereClause .= " AND subsidiaries_id = ?";
            $data[] = $subsidiariesId;
        }

        $query = "
            SELECT 
                DATE(date_creation) as fecha,
                COALESCE(SUM(total_pay - COALESCE(discount, 0)), 0) as total,
                COUNT(DISTINCT client_id) as clientes
            FROM {$this->bd}order
            WHERE $whereClause
            GROUP BY DATE(date_creation)
            ORDER BY fecha ASC
        ";

        return $this->_Read($query, $data);
    }

    function getOrdersByWeekday($params) {
        $mes = $params['mes'];
        $anio = $params['anio'];
        $subsidiariesId = $params['subsidiariesId'];

        $whereClause = "MONTH(date_creation) = ? AND YEAR(date_creation) = ? AND status != 4";
        $data = [$mes, $anio];

        if ($subsidiariesId !== 'all') {
            $whereClause .= " AND subsidiaries_id = ?";
            $data[] = $subsidiariesId;
        }

        $query = "
            SELECT 
                DAYNAME(date_creation) as dia,
                COALESCE(SUM(total_pay - COALESCE(discount, 0)), 0) as total,
                COALESCE(AVG(total_pay - COALESCE(discount, 0)), 0) as promedio,
                COUNT(*) as veces,
                COUNT(DISTINCT client_id) as clientes
            FROM {$this->bd}order
            WHERE $whereClause
            GROUP BY DAYOFWEEK(date_creation), DAYNAME(date_creation)
            ORDER BY DAYOFWEEK(date_creation)
        ";

        return $this->_Read($query, $data);
    }

    function getTopProducts($params) {
        $mes = $params['mes'];
        $anio = $params['anio'];
        $subsidiariesId = $params['subsidiariesId'];
        $limit = $params['limit'] ?? 10;

        $whereClause = "MONTH(o.date_creation) = ? AND YEAR(o.date_creation) = ? AND o.status != 4";
        $data = [$mes, $anio];

        if ($subsidiariesId !== 'all') {
            $whereClause .= " AND o.subsidiaries_id = ?";
            $data[] = $subsidiariesId;
        }

        $query = "
            SELECT 
                p.name,
                SUM(od.quantity) as quantity
            FROM {$this->bd}order_details od
            INNER JOIN {$this->bd}order_products p ON od.product_id = p.id
            INNER JOIN {$this->bd}order o ON od.order_id = o.id
            WHERE $whereClause
            GROUP BY p.id, p.name
            ORDER BY quantity DESC
            LIMIT $limit
        ";

        return $this->_Read($query, $data);
    }

    function getTopClients($params) {
        $mes = $params['mes'];
        $anio = $params['anio'];
        $subsidiariesId = $params['subsidiariesId'];
        $limit = $params['limit'] ?? 10;

        $whereClause = "MONTH(o.date_creation) = ? AND YEAR(o.date_creation) = ? AND o.status != 4";
        $data = [$mes, $anio];

        if ($subsidiariesId !== 'all') {
            $whereClause .= " AND o.subsidiaries_id = ?";
            $data[] = $subsidiariesId;
        }

        $query = "
            SELECT 
                c.name,
                COUNT(o.id) as purchases,
                COALESCE(SUM(o.total_pay - COALESCE(o.discount, 0)), 0) as total
            FROM {$this->bd}order o
            INNER JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE $whereClause
            GROUP BY c.id, c.name
            ORDER BY purchases DESC, total DESC
            LIMIT $limit
        ";

        return $this->_Read($query, $data);
    }

    function getOrdersByDateRange($params) {
        $sucursal = $params['sucursal'];
        $fechaInicio = $params['fechaInicio'];
        $fechaFin = $params['fechaFin'];

        $whereClause = "DATE(o.date_creation) BETWEEN ? AND ?";
        $data = [$fechaInicio, $fechaFin];

        if ($sucursal !== 'all') {
            $whereClause .= " AND o.subsidiaries_id = ?";
            $data[] = $sucursal;
        }

        $query = "
            SELECT 
                o.id,
                o.id as folio,
                o.date_creation,
                o.total_pay,
                o.discount,
                o.status,
                c.name as client_name
            FROM {$this->bd}order o
            INNER JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE $whereClause
            ORDER BY o.date_creation DESC
        ";

        return $this->_Read($query, $data);
    }

    function getProductSalesByDateRange($params) {
        $sucursal = $params['sucursal'];
        $fechaInicio = $params['fechaInicio'];
        $fechaFin = $params['fechaFin'];
        $limit = $params['limit'] ?? 100;

        $whereClause = "DATE(o.date_creation) BETWEEN ? AND ? AND o.status != 4";
        $data = [$fechaInicio, $fechaFin];

        if ($sucursal !== 'all') {
            $whereClause .= " AND o.subsidiaries_id = ?";
            $data[] = $sucursal;
        }

        $query = "
            SELECT 
                p.name,
                SUM(od.quantity) as quantity,
                SUM(od.quantity * od.price) as total
            FROM {$this->bd}order_details od
            INNER JOIN {$this->bd}order_products p ON od.product_id = p.id
            INNER JOIN {$this->bd}order o ON od.order_id = o.id
            WHERE $whereClause
            GROUP BY p.id, p.name
            ORDER BY quantity DESC
            LIMIT $limit
        ";

        return $this->_Read($query, $data);
    }

    function getClientPurchasesByDateRange($params) {
        $sucursal = $params['sucursal'];
        $fechaInicio = $params['fechaInicio'];
        $fechaFin = $params['fechaFin'];
        $limit = $params['limit'] ?? 100;

        $whereClause = "DATE(o.date_creation) BETWEEN ? AND ? AND o.status != 4";
        $data = [$fechaInicio, $fechaFin];

        if ($sucursal !== 'all') {
            $whereClause .= " AND o.subsidiaries_id = ?";
            $data[] = $sucursal;
        }

        $query = "
            SELECT 
                c.name,
                c.phone,
                COUNT(o.id) as purchases,
                COALESCE(SUM(o.total_pay - COALESCE(o.discount, 0)), 0) as total
            FROM {$this->bd}order o
            INNER JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE $whereClause
            GROUP BY c.id, c.name, c.phone
            ORDER BY purchases DESC, total DESC
            LIMIT $limit
        ";

        return $this->_Read($query, $data);
    }

    function getOrdersByStatus($params) {
        $mes = $params['mes'];
        $anio = $params['anio'];
        $subsidiariesId = $params['subsidiariesId'];

        $whereClause = "MONTH(date_creation) = ? AND YEAR(date_creation) = ?";
        $data = [$mes, $anio];

        if ($subsidiariesId !== 'all') {
            $whereClause .= " AND subsidiaries_id = ?";
            $data[] = $subsidiariesId;
        }

        $query = "
            SELECT 
                status,
                COUNT(*) as count,
                COALESCE(SUM(total_pay - COALESCE(discount, 0)), 0) as total
            FROM {$this->bd}order
            WHERE $whereClause
            GROUP BY status
            ORDER BY status
        ";

        return $this->_Read($query, $data);
    }

    function updateOrderDeliveryStatus($data) {
        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => 'is_delivered = ?',
            'where'  => 'id = ?',
            'data'   => [
                $data['is_delivered'],
                $data['id']
            ]
        ]);
    }

    function getDailySalesMetrics($array) {
        $date            = $array[0];
        $subsidiaries_id = $array[1] ;
        
       // 1. Obtener total de ventas y número de pedidos  --
              
        $queryOrders = "
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_pay) as total_sales
            FROM {$this->bd}`order`
            WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?
        ";
        $paramsOrders = [$date];
        if ($subsidiaries_id != 0 || $subsidiaries_id != "0") { // agregar filtro
            $queryOrders .= " AND subsidiaries_id = ? ";
            $paramsOrders[] = $subsidiaries_id;
        }

        $queryOrders .= " AND status != 4 ";
        $orders       = $this->_Read($queryOrders, $paramsOrders);
        
        $ordersData = is_array($orders) && !empty($orders) ? $orders[0] : [
             'total_orders' => 0,
             'total_sales'  => 0
        ];


        // 2. Obtener pagos reales agrupados por método de pago --
        
        $queryPayments = "
            SELECT 
                pp.method_pay_id,
                SUM(pp.pay) as total_paid
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` po ON pp.order_id = po.id
            WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?
        ";
        
        $paramsPayments = [$date];
        
        
        if ($subsidiaries_id != 0 || $subsidiaries_id != "0" ) {
            $queryPayments .= " AND po.subsidiaries_id = ?";
            $paramsPayments[] = $subsidiaries_id;
        }
        
        $queryPayments .= " AND po.status != 4 GROUP BY pp.method_pay_id";
        $payments       = $this->_Read($queryPayments, $paramsPayments);
      
        
        // 3. Mapear pagos por método (1=Efectivo, 2=Tarjeta, 3=Transferencia) --
        
        $card_sales     = 0;
        $cash_sales     = 0;
        $transfer_sales = 0;
        
        if (is_array($payments)) {
            foreach ($payments as $payment) {
                switch ($payment['method_pay_id']) {
                    case 1:
                        $cash_sales = $payment['total_paid'];
                        break;
                    case 2:
                        $card_sales = $payment['total_paid'];
                        break;
                    case 3:
                        $transfer_sales = $payment['total_paid'];
                        break;
                }
            }
        }
        
        
        // 4. Contar órdenes por estado -- 
        $quotation_count = 0;
        $cancelled_count = 0;
        $pending_count   = 0;
        
        // Consulta para cotizaciones (status = 1)
        $queryQuotations = "
            SELECT COUNT(*) as count
            FROM {$this->bd}`order`
            WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?
              AND status = 1
        ";

        $paramsQuotations = [$date];
        
        if ($subsidiaries_id != 0 || $subsidiaries_id != "0" ) {
            $queryQuotations .= " AND subsidiaries_id = ?";
            $paramsQuotations[] = $subsidiaries_id;
        }
        
        $quotations = $this->_Read($queryQuotations, $paramsQuotations);
        
        if (is_array($quotations) && !empty($quotations)) {
            $quotation_count = $quotations[0]['count'];
        }

        // Consulta para pendientes (status = 2) --
        
        $queryPending = "
            SELECT COUNT(*) as count
            FROM {$this->bd}`order`
            WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?
              AND status = 2
        ";
        
        $paramsPending = [$date];
        
        if ($subsidiaries_id != 0) {
            $queryPending .= " AND subsidiaries_id = ?";
            $paramsPending[] = $subsidiaries_id;
        }
        
        $pending = $this->_Read($queryPending, $paramsPending);
        if (is_array($pending) && !empty($pending)) {
            $pending_count = $pending[0]['count'];
        }
        

        // Consulta para cancelados (status = 4)
        $queryCancelled = "
            SELECT COUNT(*) as count
            FROM {$this->bd}`order`
            WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?
              AND status = 4
        ";
        $paramsCancelled = [$date];
        
        if ($subsidiaries_id != 0) {
            $queryCancelled .= " AND subsidiaries_id = ?";
            $paramsCancelled[] = $subsidiaries_id;
        }
        
        $cancelled = $this->_Read($queryCancelled, $paramsCancelled);
        if (is_array($cancelled) && !empty($cancelled)) {
            $cancelled_count = $cancelled[0]['count'];
        }


        
      
        
        return [
            'order'          => $orders,
            'payments'       => $payments,

            'total_orders'   => $ordersData['total_orders'],
            'total_sales'    => $ordersData['total_sales'],
            'card_sales'     => $card_sales,
            'cash_sales'     => $cash_sales,
          
            'transfer_sales'  => $transfer_sales,
            'quotation_count' => $quotation_count,
            'cancelled_count' => $cancelled_count,
            'pending_count'   => $pending_count
        ];
    }

    // Daily Closure
    function getDailyClosureByDate($array) {
        $query = "
            SELECT dc.*, u.fullname AS closed_by_name
            FROM {$this->bd}daily_closure dc
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
            WHERE DATE(dc.created_at) = ? AND dc.subsidiary_id = ? AND dc.status = 0 AND dc.active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createDailyClosure($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}daily_closure",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function createClosurePayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}closure_payment",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function createClosureStatusProcess($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}closure_status_proccess",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getClosurePayments($closure_id) {
        $query = "
            SELECT payment_method_id, amount
            FROM {$this->bd}closure_payment
            WHERE daily_closure_id = ?
        ";
        return $this->_Read($query, [$closure_id]);
    }

    function getClosureStatusProcess($closure_id) {
        $query = "
            SELECT status_process_id, amount
            FROM {$this->bd}closure_status_proccess
            WHERE daily_closure_id = ?
        ";
        return $this->_Read($query, [$closure_id]);
    }

    function updateOrdersDailyClosure($array) {
        $query = "
            UPDATE {$this->bd}`order`
            SET daily_closure_id = ?
            WHERE DATE(date_creation) = ?
            AND subsidiaries_id = ?
            AND (daily_closure_id IS NULL OR daily_closure_id = 0)
        ";
        return $this->_CUD($query, $array);
    }

    // =============================================
    // Cash Shift (Turnos)
    // =============================================

    function createCashShift($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}cash_shift",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getMaxCashShift() {
        $query = "SELECT MAX(id) as id FROM {$this->bd}cash_shift";
        $result = $this->_Read($query, null);
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

    function getShiftsBySubsidiaryDate($array) {
        $query = "
            SELECT cs.*, u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE DATE(cs.opened_at) = ? AND cs.subsidiary_id = ? AND cs.active = 1
            ORDER BY cs.opened_at DESC
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

    function getAllOpenShiftsBySubsidiary($array) {
        $query = "
            SELECT cs.*, u.fullname AS employee_name
            FROM {$this->bd}cash_shift cs
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = cs.employee_id
            WHERE cs.subsidiary_id = ? AND cs.status = 'open' AND cs.active = 1
            ORDER BY cs.opened_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function closeCashShift($array) {
        $query = "
            UPDATE {$this->bd}cash_shift
            SET closed_at = ?, status = 'closed',
                total_sales = ?, cash = ?, card = ?,
                transfer = ?, total_orders = ?
            WHERE id = ? AND status = 'open'
        ";
        return $this->_CUD($query, $array);
    }

    function getShiftSalesMetrics($array) {
        $shift_id      = $array[0];
        $startDate     = $array[1];
        $endDate       = $array[2];
        $subsidiary_id = $array[3];

        // Condición: vinculados al turno O dentro del rango sin turno asignado
        $shiftCondition = "(cash_shift_id = ? OR (cash_shift_id IS NULL AND date_creation >= ? AND date_creation < ? AND subsidiaries_id = ?))";
        $params = [$shift_id, $startDate, $endDate, $subsidiary_id];

        // 1. Total de ventas y pedidos
        $queryOrders = "
            SELECT COUNT(*) as total_orders, COALESCE(SUM(total_pay), 0) as total_sales
            FROM {$this->bd}`order`
            WHERE {$shiftCondition} AND status != 4
        ";
        $orders = $this->_Read($queryOrders, $params);
        $ordersData = is_array($orders) && !empty($orders) ? $orders[0] : ['total_orders' => 0, 'total_sales' => 0];

        // 2. Pagos reales recibidos durante el turno, agrupados por método
        $queryPayments = "
            SELECT pp.method_pay_id, SUM(pp.pay) as total_paid
            FROM {$this->bd}order_payments pp
            INNER JOIN {$this->bd}`order` po ON pp.order_id = po.id
            WHERE pp.date_pay >= ? AND pp.date_pay <= ?
            AND po.subsidiaries_id = ?
            AND po.status != 4
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

        // 3. Conteo por status
        $quotation_count = 0; $pending_count = 0; $cancelled_count = 0;

        $queryByStatus = "
            SELECT status, COUNT(*) as count
            FROM {$this->bd}`order`
            WHERE {$shiftCondition}
            GROUP BY status
        ";
        $statuses = $this->_Read($queryByStatus, $params);
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

    function getShiftDetailedOrders($array) {
        $shift_id      = $array[0];
        $startDate     = $array[1];
        $endDate       = $array[2];
        $subsidiary_id = $array[3];

        // Grupo 1: pedidos creados en este turno + lo que se cobró durante el turno
        $query1 = "
            SELECT
                o.id,
                o.total_pay,
                COALESCE(
                    SUM(CASE WHEN op.date_pay >= ? AND op.date_pay <= ? THEN op.pay ELSE 0 END),
                    0
                ) AS payment_real,
                o.status,
                o.date_creation,
                c.name AS client_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            LEFT JOIN {$this->bd}order_payments op ON op.order_id = o.id
            WHERE
                (o.cash_shift_id = ?
                OR (o.cash_shift_id IS NULL
                        AND o.date_creation >= ?
                        AND o.date_creation < ?
                        AND o.subsidiaries_id = ?
                ))
            AND o.status != 4
            GROUP BY o.id, o.total_pay, o.status, o.date_creation, c.name
            ORDER BY o.date_creation ASC
        ";
        $shiftOrders = $this->_Read($query1, [
            $startDate, $endDate,
            $shift_id,
            $startDate, $endDate, $subsidiary_id
        ]);

        // Grupo 2: abonos recibidos en este turno para pedidos de turnos anteriores
        $query2 = "
            SELECT
                o.id,
                o.total_pay,
                SUM(op.pay) AS payment_real,
                o.status,
                o.date_creation,
                c.name AS client_name
            FROM {$this->bd}order_payments op
            JOIN {$this->bd}`order` o ON o.id = op.order_id
            LEFT JOIN {$this->bd}order_clients c ON c.id = o.client_id
            WHERE op.date_pay >= ? AND op.date_pay <= ?
            AND o.cash_shift_id IS NOT NULL
            AND o.cash_shift_id != ?
            AND o.subsidiaries_id = ?
            AND o.status != 4
            GROUP BY o.id, o.total_pay, o.status, o.date_creation, c.name
            ORDER BY o.date_creation ASC
        ";
        $externalPayments = $this->_Read($query2, [
            $startDate, $endDate,
            $shift_id,
            $subsidiary_id
        ]);

        return [
            'shift_orders'      => is_array($shiftOrders) ? $shiftOrders : [],
            'external_payments' => is_array($externalPayments) ? $externalPayments : []
        ];
    }

    function createShiftPayment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}shift_payment",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function createShiftStatusProcess($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}shift_status_process",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function getShiftStatusCounts($array) {
        $query = "
            SELECT status_process_id, amount
            FROM {$this->bd}shift_status_process
            WHERE cash_shift_id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
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

}
?>
