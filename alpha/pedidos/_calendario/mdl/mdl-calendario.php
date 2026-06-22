<?php
require_once('../../../conf/_CRUD.php');
require_once('../../../conf/_Utileria.php');

class MCalendarioPedidos extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }
    
    function getOrders($statuses = [], $delivery = [], $subsidiaries_id = 0) {
        $filters = [];
        $params = [];
        
        if (!empty($statuses) && is_array($statuses)) {
            $placeholders = implode(',', array_fill(0, count($statuses), '?'));
            $filters[] = "order.STATUS IN ($placeholders)";
            $params = array_merge($params, $statuses);
        }
        
        if (!empty($delivery) && is_array($delivery)) {
            $placeholders = implode(',', array_fill(0, count($delivery), '?'));
            $filters[] = "order.is_delivered IN ($placeholders)";
            $params = array_merge($params, $delivery);
        }
        
        // Filtrar por subsidiaries_id si se proporciona y es diferente de 0
        if (!empty($subsidiaries_id) && $subsidiaries_id != 0) {
            $filters[] = "order.subsidiaries_id = ?";
            $params[] = $subsidiaries_id;
        }
        
        $whereClause = !empty($filters) ? ' WHERE ' . implode(' AND ', $filters) : '';
        
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
            order.is_delivered,
            order.delivery_type,
            order.subsidiaries_id,
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
        {$whereClause}
        ORDER BY status_process.id ASC, order.date_order ASC
        ";

        return $this->_Read($query, $params);
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
}
?>
