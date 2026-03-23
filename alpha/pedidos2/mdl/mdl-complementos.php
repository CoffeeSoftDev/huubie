<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MComplementos extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    // === LEALTAD ===

    function getLoyaltyConfigBySubsidiary($array) {
        $query = "
            SELECT * FROM {$this->bd}loyalty_config
            WHERE subsidiary_id = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createLoyaltyConfig($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}loyalty_config",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateLoyaltyConfig($array) {
        return $this->_Update([
            'table'  => "{$this->bd}loyalty_config",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function getClientLoyaltyPoints($array) {
        $query = "
            SELECT * FROM {$this->bd}loyalty_points
            WHERE client_id = ? AND subsidiary_id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createLoyaltyPoints($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}loyalty_points",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateLoyaltyPointsBalance($array) {
        $query = "
            UPDATE {$this->bd}loyalty_points
            SET points_balance = ?,
                total_earned = total_earned + ?,
                updated_at = NOW()
            WHERE client_id = ? AND subsidiary_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateLoyaltyPointsRedeem($array) {
        $query = "
            UPDATE {$this->bd}loyalty_points
            SET points_balance = points_balance - ?,
                total_redeemed = total_redeemed + ?,
                updated_at = NOW()
            WHERE client_id = ? AND subsidiary_id = ?
            AND points_balance >= ?
        ";
        return $this->_CUD($query, $array);
    }

    function createLoyaltyTransaction($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}loyalty_transactions",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function listLoyaltyTransactions($array) {
        $query = "
            SELECT lt.*, c.name AS client_name
            FROM {$this->bd}loyalty_transactions lt
            LEFT JOIN {$this->bd}order_clients c ON lt.client_id = c.id
            WHERE lt.subsidiary_id = ?
            ORDER BY lt.created_at DESC
            LIMIT 100
        ";
        return $this->_Read($query, $array);
    }

    function listTopLoyaltyClients($array) {
        $query = "
            SELECT lp.*, c.name AS client_name, c.phone
            FROM {$this->bd}loyalty_points lp
            LEFT JOIN {$this->bd}order_clients c ON lp.client_id = c.id
            WHERE lp.subsidiary_id = ?
            ORDER BY lp.points_balance DESC
            LIMIT 50
        ";
        return $this->_Read($query, $array);
    }

    // === MESAS ===

    function listTables($array) {
        $query = "
            SELECT t.*,
                   CASE WHEN t.current_order_id IS NOT NULL
                        THEN (SELECT COALESCE(SUM(total_pay), 0) FROM {$this->bd}`order` WHERE id = t.current_order_id)
                        ELSE 0 END AS order_total
            FROM {$this->bd}tables_config t
            WHERE t.subsidiary_id = ? AND t.active = 1
            ORDER BY t.name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getTableById($array) {
        $query = "SELECT * FROM {$this->bd}tables_config WHERE id = ?";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createTable($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}tables_config",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateTable($array) {
        return $this->_Update([
            'table'  => "{$this->bd}tables_config",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function deleteTableById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}tables_config",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function updateTableStatus($array) {
        $query = "
            UPDATE {$this->bd}tables_config
            SET status = ?, current_order_id = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // === CODIGO DE BARRAS ===

    function updateProductBarcode($array) {
        $query = "
            UPDATE {$this->bd}order_products
            SET barcode = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function getProductByBarcode($array) {
        $query = "
            SELECT id, name, price, image, barcode
            FROM {$this->bd}order_products
            WHERE barcode = ? AND active = 1 AND subsidiaries_id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    // === CFDI ===

    function createCfdiInvoice($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}cfdi_invoices",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateCfdiInvoice($array) {
        return $this->_Update([
            'table'  => "{$this->bd}cfdi_invoices",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function getCfdiInvoiceByOrder($array) {
        $query = "
            SELECT * FROM {$this->bd}cfdi_invoices
            WHERE order_id = ? AND status != 'cancelada'
            ORDER BY created_at DESC LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function listCfdiInvoices($array) {
        $query = "
            SELECT ci.*, c.name AS client_name
            FROM {$this->bd}cfdi_invoices ci
            LEFT JOIN {$this->bd}`order` o ON ci.order_id = o.id
            LEFT JOIN {$this->bd}order_clients c ON o.client_id = c.id
            WHERE ci.subsidiary_id = ?
            AND DATE(ci.created_at) BETWEEN ? AND ?
            ORDER BY ci.created_at DESC
        ";
        return $this->_Read($query, $array);
    }

    // === ROLES Y PERMISOS ===

    function listPermissionsByRole($array) {
        $query = "
            SELECT * FROM {$this->bd}role_permissions
            WHERE role_id = ? AND subsidiary_id = ?
        ";
        return $this->_Read($query, $array);
    }

    function checkPermission($array) {
        $query = "
            SELECT allowed FROM {$this->bd}role_permissions
            WHERE role_id = ? AND module = ? AND permission = ? AND subsidiary_id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? intval($result[0]['allowed']) : 0;
    }

    function createPermission($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}role_permissions",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updatePermission($array) {
        $query = "
            UPDATE {$this->bd}role_permissions
            SET allowed = ?
            WHERE role_id = ? AND module = ? AND permission = ? AND subsidiary_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function deletePermissionsByRole($array) {
        $query = "
            DELETE FROM {$this->bd}role_permissions
            WHERE role_id = ? AND subsidiary_id = ?
        ";
        return $this->_CUD($query, $array);
    }
}
