<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;
    public $bdAlpha;

    public function __construct() {
        $this->util    = new Utileria;
        $this->bd      = 'fayxzvov_reginas.';
        $this->bdAlpha = 'fayxzvov_alpha.';
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGOS
    // ─────────────────────────────────────────────────────────────────

    function lsSucursales($array) {
        $query = "
            SELECT id, name AS valor, companies_id
            FROM {$this->bdAlpha}subsidiaries
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsWarehouses($array) {
        $where = 'w.active = 1 AND w.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND w.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }

        $query = "
            SELECT
                w.id,
                w.name,
                w.name AS valor,
                w.is_default,
                w.subsidiaries_id,
                w.warehouse_area_id,
                wa.name AS area_name,
                wa.color_hex AS area_color,
                s.name  AS subsidiary_name
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = w.subsidiaries_id
            WHERE {$where}
            ORDER BY s.name ASC, w.is_default DESC, w.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function lsCategories() {
        $query = "
            SELECT id, classification AS name, classification AS valor
            FROM {$this->bd}order_category
            WHERE active = 1
            ORDER BY classification ASC
        ";
        $r = $this->_Read($query);
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
        $query = "SELECT id, code, name, is_terminal FROM {$this->bd}transfer_status WHERE code = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function listProductsForTransfer($array) {
        $query = "
            SELECT
                p.id                                       AS id,
                p.name                                     AS nombre,
                pa.sku                                     AS sku,
                oc.classification                          AS categoria,
                COALESCE(pa.cost_unit, p.price, 0)         AS costo,
                p.price                                    AS precio,
                p.image                                    AS image
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries  ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}product_attribute  pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}order_category     oc ON oc.id = p.category_id
            WHERE p.active = 1 AND COALESCE(p.companies_id, ps.companies_id) = ?
              AND (oc.id IS NULL OR oc.active = 1)
            ORDER BY p.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function listStockBySubsidiary($array) {
        $query = "
            SELECT
                st.product_id       AS product_id,
                w.subsidiaries_id   AS subsidiaries_id,
                SUM(st.quantity)    AS qty
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id
            WHERE st.active = 1 AND w.companies_id = ?
            GROUP BY st.product_id, w.subsidiaries_id
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
        if (!empty($array['origin_subsidiaries_id'])) {
            $where .= ' AND t.origin_subsidiaries_id = ?';
            $data[] = $array['origin_subsidiaries_id'];
        }
        if (!empty($array['destination_subsidiaries_id'])) {
            $where .= ' AND t.destination_subsidiaries_id = ?';
            $data[] = $array['destination_subsidiaries_id'];
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
                t.origin_subsidiaries_id,
                so.name              AS origin_subsidiary_name,
                t.destination_subsidiaries_id,
                sd.name              AS destination_subsidiary_name,
                t.requested_user_id,
                ur.fullname          AS requested_user_name,
                t.authorized_user_id,
                ua.fullname          AS authorized_user_name,
                t.received_user_id,
                urc.fullname         AS received_user_name
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            LEFT JOIN {$this->bd}warehouse       wo ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->bd}warehouse       wd ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries so  ON so.id  = t.origin_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}subsidiaries sd  ON sd.id  = t.destination_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    ur  ON ur.id  = t.requested_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    ua  ON ua.id  = t.authorized_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    urc ON urc.id = t.received_user_id
            WHERE {$where}
            ORDER BY t.date_request DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getTraspasoKpis($array) {
        $where = 't.active = 1 AND t.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(t.date_request) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(t.id) AS total,
                COUNT(CASE WHEN ts.code = 'REQUESTED'  THEN 1 END) AS pendientes,
                COUNT(CASE WHEN ts.code = 'AUTHORIZED' THEN 1 END) AS autorizados,
                COUNT(CASE WHEN ts.code = 'IN_TRANSIT' THEN 1 END) AS en_transito,
                COUNT(CASE WHEN ts.code = 'RECEIVED'   THEN 1 END) AS recibidos,
                COUNT(CASE WHEN ts.code = 'REJECTED'   THEN 1 END) AS rechazados
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total' => 0, 'pendientes' => 0, 'autorizados' => 0,
            'en_transito' => 0, 'recibidos' => 0, 'rechazados' => 0
        ];
    }

    function getTraspasoById($array) {
        $query = "
            SELECT
                t.*,
                ts.code AS status_code,
                ts.name AS status_name,
                ts.color_hex AS status_color,
                wo.name AS origin_warehouse_name,
                wd.name AS destination_warehouse_name,
                so.name AS origin_subsidiary_name,
                sd.name AS destination_subsidiary_name,
                ur.fullname  AS requested_user_name,
                ua.fullname  AS authorized_user_name,
                urc.fullname AS received_user_name
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            LEFT JOIN {$this->bd}warehouse       wo ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->bd}warehouse       wd ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries so  ON so.id  = t.origin_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}subsidiaries sd  ON sd.id  = t.destination_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    ur  ON ur.id  = t.requested_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    ua  ON ua.id  = t.authorized_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    urc ON urc.id = t.received_user_id
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
                d.product_id,
                p.name              AS product_name,
                pa.sku
            FROM {$this->bd}detail_inventory_transfer d
            INNER JOIN {$this->bd}order_products p ON p.id = d.product_id
            LEFT  JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
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
                u.fullname           AS user_name
            FROM {$this->bd}inventory_transfer_history h
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = h.status_id
            LEFT JOIN {$this->bdAlpha}usr_users    u ON u.id  = h.user_id
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
                 origin_subsidiaries_id, destination_subsidiaries_id,
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
                 product_id, inventory_transfer_id)
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

    function updateTraspasoAuthorized($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_authorized = NOW(), authorized_user_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoSent($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_sent = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoReceived($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_received = NOW(), received_user_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Snapshot de stock del renglon al confirmar la recepcion cuando el origen
    // ya se habia descontado antes (flujo anterior con "En Transito"): solo se
    // fija el lado destino, sin pisar el prev/post del origen.
    function updateTraspasoDetailDestinationStock($array) {
        // [destination_stock_prev, destination_stock_post, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_transfer
            SET destination_stock_prev = ?, destination_stock_post = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Snapshot completo (origen + destino) del renglon al confirmar la recepcion
    // en el flujo simplificado, donde la salida del origen se aplica aqui mismo.
    function updateTraspasoDetailStockSnapshots($array) {
        // [origin_stock_prev, origin_stock_post, destination_stock_prev, destination_stock_post, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_transfer
            SET origin_stock_prev = ?, origin_stock_post = ?,
                destination_stock_prev = ?, destination_stock_post = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  STOCK (mantenimiento)
    // ─────────────────────────────────────────────────────────────────

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE product_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createStockRow($array) {
        $query = "
            INSERT INTO {$this->bd}stock
                (quantity, last_movement_at, warehouse_id, product_id, companies_id)
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
        $r = $this->_Read($query, [$companies_id, $prefix . '%']);
        $next = 1;
        if (!empty($r)) {
            $folio = $r[0]['folio'];
            $num = (int) preg_replace('/[^0-9]/', '', substr($folio, strlen($prefix)));
            $next = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}
