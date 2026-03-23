<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MCocina extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function listPendingOrders($array) {
        $query = "
            SELECT o.id, o.total_pay, o.date_creation, o.note, o.order_type,
                   c.name AS client_name,
                   t.name AS table_name
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            LEFT JOIN {$this->bd}tables_config t ON o.table_id = t.id
            WHERE o.subsidiaries_id = ? AND o.status IN (2, 3)
            AND DATE(o.date_creation) = CURDATE()
            AND NOT EXISTS (
                SELECT 1 FROM {$this->bd}kds_order_items ki
                WHERE ki.order_id = o.id AND ki.status = 'entregado'
                GROUP BY ki.order_id
                HAVING COUNT(*) = (SELECT COUNT(*) FROM {$this->bd}kds_order_items WHERE order_id = o.id)
            )
            ORDER BY o.date_creation ASC
        ";
        return $this->_Read($query, $array);
    }

    function listOrderItemsForKds($array) {
        $query = "
            SELECT op.id as package_id, op.pedidos_id as order_id, op.quantity,
                   COALESCE(p.name, oc.name) AS product_name,
                   COALESCE(ki.status, 'pendiente') AS kds_status,
                   ki.id AS kds_id, ki.started_at, ki.completed_at
            FROM {$this->bd}order_package op
            LEFT JOIN {$this->bd}order_products p ON op.product_id = p.id
            LEFT JOIN {$this->bd}order_custom oc ON op.custom_id = oc.id
            LEFT JOIN {$this->bd}kds_order_items ki ON ki.package_id = op.id AND ki.order_id = op.pedidos_id
            WHERE op.pedidos_id = ?
            ORDER BY op.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getKdsItemById($array) {
        $query = "
            SELECT * FROM {$this->bd}kds_order_items WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createKdsItem($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}kds_order_items",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateKdsItemStatus($array) {
        $query = "
            UPDATE {$this->bd}kds_order_items
            SET status = ?, started_at = COALESCE(started_at, IF(? = 'preparando', NOW(), NULL)),
                completed_at = IF(? = 'listo', NOW(), completed_at),
                delivered_at = IF(? = 'entregado', NOW(), delivered_at)
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function getKdsOrderCounts($array) {
        $query = "
            SELECT
                COALESCE(ki.status, 'pendiente') as kds_status,
                COUNT(DISTINCT op.pedidos_id) as total
            FROM {$this->bd}order_package op
            INNER JOIN {$this->bd}`order` o ON op.pedidos_id = o.id
            LEFT JOIN {$this->bd}kds_order_items ki ON ki.package_id = op.id AND ki.order_id = op.pedidos_id
            WHERE o.subsidiaries_id = ? AND o.status IN (2, 3)
            AND DATE(o.date_creation) = CURDATE()
            GROUP BY kds_status
        ";
        return $this->_Read($query, $array);
    }

    function listAllKdsOrders($array) {
        $query = "
            SELECT o.id, o.total_pay, o.date_creation, o.note, o.order_type,
                   c.name AS client_name,
                   t.name AS table_name,
                   (SELECT COUNT(*) FROM {$this->bd}kds_order_items ki WHERE ki.order_id = o.id AND ki.status = 'pendiente') as items_pending,
                   (SELECT COUNT(*) FROM {$this->bd}kds_order_items ki WHERE ki.order_id = o.id AND ki.status = 'preparando') as items_preparing,
                   (SELECT COUNT(*) FROM {$this->bd}kds_order_items ki WHERE ki.order_id = o.id AND ki.status = 'listo') as items_ready,
                   (SELECT COUNT(*) FROM {$this->bd}kds_order_items ki WHERE ki.order_id = o.id AND ki.status = 'entregado') as items_delivered,
                   (SELECT COUNT(*) FROM {$this->bd}order_package op2 WHERE op2.pedidos_id = o.id) as total_items
            FROM {$this->bd}`order` o
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            LEFT JOIN {$this->bd}tables_config t ON o.table_id = t.id
            WHERE o.subsidiaries_id = ? AND o.status IN (2, 3)
            AND DATE(o.date_creation) = CURDATE()
            ORDER BY o.date_creation ASC
        ";
        return $this->_Read($query, $array);
    }
}
