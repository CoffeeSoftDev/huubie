<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MPedidos extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_coffee.';
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

    // Products

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
        return $this->_Read($query, $array)[0];
    }

    function getMaxOrder() {


        $query = "
            SELECT
                MAX(order.id) as id
            FROM
            fayxzvov_coffee.order";


        return $this->_Read($query, null)[0];
    }

    function getOrders($data) {
        $startDate = $data['fi'] . ' 00:00:00';
        $endDate   = $data['ff'] . ' 23:59:59';

        $params    = [
            $startDate,
            $endDate,
            // $data['subsidiaries_id']
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
            order.info_discount,
            order_clients. NAME AS name_client,
            order_clients.phone AS phone,
            order_clients.email AS email,
            status_process. STATUS AS status_label,
            DATE_FORMAT( order.date_order,'%Y-%m-%d' ) AS date_order,

            DATE_FORMAT(order.time_order, '%h:%i %p') AS time_order,

            status_process.id AS idStatus
        FROM
            {$this->bd}order
        INNER JOIN {$this->bd}order_clients ON client_id = order_clients.id
        INNER JOIN {$this->bd}status_process ON order.STATUS = status_process.id
        WHERE
        order.date_creation BETWEEN ? AND ?

      
        ";

        if (!empty($data['status']) && $data['status'] !== '0') {

            $query .= " AND order.status = ? " ;
            $params[] = $data['status'];
        }

        $query .= "   ORDER BY
            status_process.id ASC,
            order.date_creation DESC";


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

        return $this->_Read($query, $array)[0];
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

        return $this->_Read($query, $array)[0]['method_pay'];
    }

   

    // add Histories.

    function addHistories($array){
        return $this->_Insert([
            'table'  => "{$this->bd}evt_histories",
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
            'where'    => 'order_products.active = ? AND order_products.subsidiaries_id = ?',
            'order'    => ['DESC' => 'order_products.id'],
            'data'     => $array
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



    public function listProductsById($array) {
        $sql = "
            SELECT id, name AS valor, price, description,image
            FROM {$this->bd}order_products
            WHERE category_id = ?
        ";
        return $this->_Read($sql, $array);
    }

    public function createProduct($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}order_package",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    public function getOrderById($array) {
        $sql = "
            SELECT
                order_package.id as id,
                order_products.`name` as name,
                order_products.price,
                order_package.quantity,
                order_package.order_details,
                order_products.description,
                order_package.dedication,
                order_products.image,
                order_package.custom_id,
                order_custom.name as data_custom
            FROM
                {$this->bd}order_package
            INNER JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
            LEFT JOIN {$this->bd}order_custom ON order_package.custom_id = order_custom.id
            WHERE pedidos_id = ?
        ";
        
        $products = $this->_Read($sql, $array);
        
        // // Para cada producto, obtener información personalizada si corresponde
        // foreach ($products as &$product) {
        //     if ($product['customer_id']) {
        //         // Obtener datos del producto personalizado
        //         $customData = $this->getCustomerProducts([$product['customer_id']]);
        //         if ($customData) {
        //             // Agregar datos personalizados al producto
        //             $product = array_merge($product, $customData);
        //             // Si es personalizado, usar el nombre personalizado
        //             if ($customData['customer_product_name']) {
        //                 $product['product_name'] = $customData['customer_product_name'];
        //             } else if ($customData['data_customer']) {
        //                 $product['product_name'] = $customData['data_customer'];
        //             }
        //             // Usar precio personalizado si existe
        //             if ($customData['customer_real_price']) {
        //                 $product['unit_price'] = $customData['customer_real_price'];
        //                 $product['total_price'] = $product['quantity'] * $customData['customer_real_price'];
        //             }
        //             // Usar cantidad personalizada si existe
        //             if ($customData['custom_quantity']) {
        //                 $product['quantity'] = $customData['custom_quantity'];
        //                 $product['total_price'] = $customData['custom_quantity'] * $product['unit_price'];
        //             }
        //         }
        //         // Obtener imágenes
        //         $product['images'] = $this->getOrderImages([$product['id']]);
        //         // Marcar como personalizado para el frontend
        //         $product['is_custom'] = true;
        //     } else {
        //         $product['images'] = [];
        //         $product['is_custom'] = false;
        //     }
        // }
        
        return $products;
    }

    public function getOrderPackageByID($array) {
        $sql = "
            SELECT
                order_package.id,
                order_products.`name` as name,
                order_products.price,
                order_package.quantity,
                order_package.dedication,
                order_package.order_details,
                order_products.description,
                order_products.image
            FROM
                {$this->bd}order_package
            INNER JOIN {$this->bd}order_products ON order_package.product_id = order_products.id
            WHERE order_package.id = ?
        ";

        return $this->_Read($sql,$array)[0];
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

    function registerPayment($array) {

        return $this->_Update([
            'table'  => "{$this->bd}order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

   


    // Payment.
    function addMethodPay($array){
        return $this->_Insert([
            'table'  => "{$this->bd}order_payments",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
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
            order.total_pay,
            DATE_FORMAT(date_order, '%d/%m/%Y') AS date_order,
            DATE_FORMAT(time_order, '%h:%i %p') AS time_order
        FROM
            {$this->bd}order
        INNER JOIN {$this->bd}order_clients ON order.client_id = order_clients.id

        WHERE order.id = ?

        ";
        return $this->_Read($sql,$array);

    }

    function getListPayment($array) {
        $query = "
        SELECT
        order_payments.id,
        order_payments.date_pay,
        order_payments.pay,
        method_pay.method_pay,
        order_payments.method_pay_id,
        order_payments.type
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

    public function getMethodPayment($array) {
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

    function getOrderProducts($array) {
        $query = "
            SELECT
                op.id,
                op.quantity,
                op.order_details,
                op.dedication,
                op.custom_id,
                oc.name as data_custom,
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
            LEFT JOIN {$this->bd}order_custom oc ON op.custom_id = oc.id
            WHERE
                op.pedidos_id = ?
            ORDER BY
                op.id ASC
        ";
        
        $products = $this->_Read($query, $array);
        
        // // Para cada producto, obtener sus imágenes si es personalizado
        // foreach ($products as &$product) {
        //     if ($product['customer_id']) {
        //         $product['images'] = $this->getOrderImages([$product['id']]);
        //     } else {
        //         $product['images'] = [];
        //     }
        // }
        
        return $products;
    }



    function getCustomerProducts($array) {
        error_log("🔍 Buscando productos personalizados para customer_id: " . json_encode($array));
        
        $query = "
            SELECT
                ocp.id,
                ocp.price as custom_price,
                ocp.quantity as custom_quantity,
                ocp.details as custom_details,
                oc.name as customer_product_name,
                oc.price as customer_base_price,
                oc.price_real as customer_real_price,
                oc.portion_qty as customer_portion_qty
            FROM
                {$this->bd}order_customer_products ocp
            INNER JOIN {$this->bd}order_customer oc ON ocp.customer_id = oc.id
            WHERE
                ocp.customer_id = ?
            ORDER BY
                ocp.id ASC
        ";
        
        error_log("🔍 Query ejecutada: " . $query);
        $result = $this->_Read($query, $array);
        error_log("🔍 Resultado de la consulta: " . json_encode($result));
        
        return $result ? $result[0] : null;
    }

    // function getOrderImages($array) {
    //     $query = "
    //         SELECT
    //             path as image_path,
    //             name as image_name,
    //             original_name
    //         FROM
    //             {$this->bd}order_images
    //         WHERE
    //             package_id = ?
    //         ORDER BY
    //             id ASC
    //     ";
        
    //     error_log("🖼️ Buscando imágenes para package_id: " . json_encode($array));
    //     $result = $this->_Read($query, $array);
    //     error_log("🖼️ Imágenes encontradas: " . json_encode($result));
        
    //     return $result;
    // }






}
?>
