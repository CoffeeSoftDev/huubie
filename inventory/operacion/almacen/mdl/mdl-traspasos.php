<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;
    public $bdErp;

    public function __construct() {
        $this->util  = new Utileria;
        $this->bd    = 'fayxzvov_inventory.';
        $this->bdErp = 'fayxzvov_erp.';
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGOS
    // ─────────────────────────────────────────────────────────────────

    function lsSucursales($array) {
        $query = "
            SELECT id, name AS valor, company_id AS companies_id
            FROM {$this->bdErp}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsWarehouses($array) {
        $where = 'w.active = 1 AND w.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND w.branch_id = ?';
            $data[] = $array['branch_id'];
        }

        $query = "
            SELECT
                w.id,
                w.name,
                w.name AS valor,
                w.is_default,
                w.branch_id,
                w.warehouse_area_id,
                wa.name AS area_name,
                wa.color_hex AS area_color,
                b.name AS branch_name
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT JOIN {$this->bdErp}branches b ON b.id = w.branch_id
            WHERE {$where}
            ORDER BY b.name ASC, w.is_default DESC, w.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function lsTransferStatuses() {
        $query = "
            SELECT id, code, name, name AS valor, order_index, is_terminal, color_hex
            FROM {$this->bd}transfer_status
            WHERE active = 1
            ORDER BY order_index ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function getTransferStatusByCode($array) {
        $query = "
            SELECT id, code, name, is_terminal
            FROM {$this->bd}transfer_status
            WHERE code = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function listItemsForTransfer($array) {
        $query = "
            SELECT
                i.id                                        AS id,
                i.name                                      AS nombre,
                ia.sku                                      AS sku,
                ic.name                                     AS categoria,
                COALESCE(ia.cost_unit, 0)                   AS costo,
                i.image                                     AS image
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            WHERE i.active = 1 AND i.companies_id = ?
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function listStockByBranch($array) {
        $query = "
            SELECT
                s.item_id       AS item_id,
                w.branch_id     AS branch_id,
                SUM(s.quantity) AS qty
            FROM {$this->bd}stock s
            INNER JOIN {$this->bd}warehouse w ON w.id = s.warehouse_id
            WHERE s.active = 1 AND w.companies_id = ?
            GROUP BY s.item_id, w.branch_id
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // ─────────────────────────────────────────────────────────────────
    //  TRASPASOS (inventory_transfer)
    // ─────────────────────────────────────────────────────────────────

    function listTraspasos($array) {
        $where = 't.active = 1 AND t.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['status_id'])) {
            $where .= ' AND t.status_id = ?';
            $data[] = $array['status_id'];
        }
        if (!empty($array['scope_branch_id'])) {
            $where .= ' AND (t.origin_branch_id = ? OR t.destination_branch_id = ?)';
            $data[] = $array['scope_branch_id'];
            $data[] = $array['scope_branch_id'];
        }
        if (!empty($array['destination_branch_id'])) {
            $where .= ' AND t.destination_branch_id = ?';
            $data[] = $array['destination_branch_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(t.date_request) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (t.folio LIKE ? OR t.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                t.id,
                t.folio,
                t.note,
                t.total_products,
                t.total_units,
                t.total_cost,
                t.date_request,
                t.date_authorized,
                t.date_sent,
                t.date_received,
                t.status_id,
                ts.code              AS status_code,
                ts.name              AS status_name,
                ts.color_hex         AS status_color,
                ts.is_terminal       AS status_terminal,
                t.origin_warehouse_id,
                wo.name              AS origin_warehouse_name,
                t.destination_warehouse_id,
                wd.name              AS destination_warehouse_name,
                t.origin_branch_id,
                bo.name              AS origin_branch_name,
                t.destination_branch_id,
                bd.name              AS destination_branch_name,
                t.requested_user_id,
                TRIM(CONCAT(COALESCE(ur.name, ''), ' ', COALESCE(ur.last_name, '')))   AS requested_user_name,
                t.received_user_id,
                TRIM(CONCAT(COALESCE(urc.name, ''), ' ', COALESCE(urc.last_name, ''))) AS received_user_name,
                t.received_by_name
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            LEFT JOIN {$this->bd}warehouse       wo ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->bd}warehouse       wd ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bdErp}branches     bo ON bo.id = t.origin_branch_id
            LEFT JOIN {$this->bdErp}branches     bd ON bd.id = t.destination_branch_id
            LEFT JOIN {$this->bdErp}users        ur ON ur.id = t.requested_user_id
            LEFT JOIN {$this->bdErp}users       urc ON urc.id = t.received_user_id
            WHERE {$where}
            ORDER BY t.date_request DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getTraspasoKpis($array) {
        $where = 't.active = 1 AND t.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['scope_branch_id'])) {
            $where .= ' AND (t.origin_branch_id = ? OR t.destination_branch_id = ?)';
            $data[] = $array['scope_branch_id'];
            $data[] = $array['scope_branch_id'];
        }

        $query = "
            SELECT
                COUNT(t.id) AS total,
                COUNT(CASE WHEN ts.code = 'REQUESTED'  THEN 1 END) AS pendientes,
                COUNT(CASE WHEN ts.code = 'IN_TRANSIT' THEN 1 END) AS en_transito,
                COUNT(CASE WHEN ts.code = 'RECEIVED'   THEN 1 END) AS recibidos,
                COUNT(CASE WHEN ts.code = 'REJECTED'   THEN 1 END) AS rechazados
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total' => 0, 'pendientes' => 0,
            'en_transito' => 0, 'recibidos' => 0, 'rechazados' => 0
        ];
    }

    function getTraspasoById($array) {
        $query = "
            SELECT
                t.*,
                ts.code              AS status_code,
                ts.name              AS status_name,
                ts.color_hex         AS status_color,
                wo.name              AS origin_warehouse_name,
                wd.name              AS destination_warehouse_name,
                bo.name              AS origin_branch_name,
                bd.name              AS destination_branch_name,
                TRIM(CONCAT(COALESCE(ur.name, ''), ' ', COALESCE(ur.last_name, '')))   AS requested_user_name,
                TRIM(CONCAT(COALESCE(urc.name, ''), ' ', COALESCE(urc.last_name, ''))) AS received_user_name
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            LEFT JOIN {$this->bd}warehouse       wo ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->bd}warehouse       wd ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bdErp}branches     bo ON bo.id = t.origin_branch_id
            LEFT JOIN {$this->bdErp}branches     bd ON bd.id = t.destination_branch_id
            LEFT JOIN {$this->bdErp}users        ur ON ur.id = t.requested_user_id
            LEFT JOIN {$this->bdErp}users       urc ON urc.id = t.received_user_id
            WHERE t.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getTraspasoIdByFolio($array) {
        $query = "
            SELECT id
            FROM {$this->bd}inventory_transfer
            WHERE folio = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : 0;
    }

    function listTraspasoDetail($array) {
        $query = "
            SELECT
                d.id,
                d.quantity,
                d.cost,
                d.subtotal,
                d.origin_stock_prev,
                d.origin_stock_post,
                d.destination_stock_prev,
                d.destination_stock_post,
                d.item_id,
                i.name              AS item_name,
                ia.sku
            FROM {$this->bd}detail_inventory_transfer d
            INNER JOIN {$this->bd}item i ON i.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE d.inventory_transfer_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function listTraspasoHistory($array) {
        $query = "
            SELECT
                h.id,
                h.note,
                h.transitioned_at,
                h.status_id,
                ts.code              AS status_code,
                ts.name              AS status_name,
                ts.color_hex         AS status_color,
                h.user_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name
            FROM {$this->bd}inventory_transfer_history h
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = h.status_id
            LEFT JOIN {$this->bdErp}users         u ON u.id  = h.user_id
            WHERE h.inventory_transfer_id = ? AND h.active = 1
            ORDER BY h.transitioned_at DESC, h.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function createTraspaso($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_transfer
                (folio, note, total_products, total_units, total_cost, date_request,
                 status_id, origin_warehouse_id, destination_warehouse_id,
                 origin_branch_id, destination_branch_id,
                 requested_user_id, companies_id)
            VALUES (?,?,?,?,?,NOW(),?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function createTraspasoDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_transfer
                (quantity, cost, subtotal, origin_stock_prev, origin_stock_post,
                 destination_stock_prev, destination_stock_post,
                 item_id, inventory_transfer_id)
            VALUES (?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function createTraspasoHistory($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_transfer_history
                (note, transitioned_at, status_id, user_id, inventory_transfer_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoStatus($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET status_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoReceived($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_received    = NOW(),
                received_user_id = ?,
                received_by_name = COALESCE(?, received_by_name),
                updated_at       = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoDetailDestinationStock($array) {
        $query = "
            UPDATE {$this->bd}detail_inventory_transfer
            SET destination_stock_prev = ?, destination_stock_post = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoDetailStockSnapshots($array) {
        $query = "
            UPDATE {$this->bd}detail_inventory_transfer
            SET origin_stock_prev = ?, origin_stock_post = ?,
                destination_stock_prev = ?, destination_stock_post = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  STOCK
    // ─────────────────────────────────────────────────────────────────

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createStockRow($array) {
        $query = "
            INSERT INTO {$this->bd}stock
                (quantity, last_movement_at, warehouse_id, item_id, companies_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateStockQuantity($array) {
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  FOLIOS
    // ─────────────────────────────────────────────────────────────────

    function getNextFolio($prefix, $companies_id) {
        $query = "
            SELECT folio
            FROM {$this->bd}inventory_transfer
            WHERE companies_id = ? AND folio LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $r    = $this->_Read($query, [$companies_id, $prefix . '%']);
        $next = 1;
        if (!empty($r)) {
            $folio = $r[0]['folio'];
            $num   = (int) preg_replace('/[^0-9]/', '', substr($folio, strlen($prefix)));
            $next  = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}
