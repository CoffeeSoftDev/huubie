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
    //  CATALOGOS (init)
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

    function lsShrinkageReasons() {
        $query = "
            SELECT id, code, name, name AS valor, icon, color_hex
            FROM {$this->bd}shrinkage_reason
            WHERE active = 1
            ORDER BY id ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function qProductsForTransfer($array) {
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
            ORDER BY p.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // ─────────────────────────────────────────────────────────────────
    //  MERMAS (inventory_shrinkage)
    // ─────────────────────────────────────────────────────────────────

    function qMermas($array) {
        $where = 'm.active = 1 AND m.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND m.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['reason_id'])) {
            $where .= ' AND m.shrinkage_reason_id = ?';
            $data[] = $array['reason_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(m.created_at) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (m.folio LIKE ? OR m.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                m.id,
                m.folio,
                m.note,
                m.evidence_url,
                m.total_products,
                m.total_units,
                m.total_cost_loss,
                m.status,
                m.created_at,
                m.shrinkage_reason_id,
                sr.name             AS reason_name,
                sr.color_hex        AS reason_color,
                sr.icon             AS reason_icon,
                m.warehouse_id,
                w.name              AS warehouse_name,
                m.subsidiaries_id,
                s.name              AS subsidiary_name,
                m.user_id,
                u.fullname          AS user_name
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = m.warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = m.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    u ON u.id = m.user_id
            WHERE {$where}
            ORDER BY m.created_at DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getMermaKpis($array) {
        // Las mermas canceladas no son perdida real (se restauro el stock): se excluyen
        // de Perdida total / Registros / Unidades / Motivo top.
        $where = "m.active = 1 AND m.status <> 'Cancelada' AND m.companies_id = ?";
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND m.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(m.created_at) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(m.id)                       AS total_mermas,
                IFNULL(SUM(m.total_cost_loss), 0) AS total_costo,
                IFNULL(SUM(m.total_units), 0)     AS total_unidades
            FROM {$this->bd}inventory_shrinkage m
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        $base = !empty($r) ? $r[0] : [
            'total_mermas'   => 0,
            'total_costo'    => 0,
            'total_unidades' => 0
        ];

        $queryTop = "
            SELECT sr.name AS motivo_top, COUNT(m.id) AS cuenta
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            WHERE {$where}
            GROUP BY sr.id
            ORDER BY cuenta DESC
            LIMIT 1
        ";
        $top = $this->_Read($queryTop, $data);
        $base['motivo_top'] = !empty($top) ? $top[0]['motivo_top'] : '-';
        return $base;
    }

    function qGetMerma($array) {
        $query = "
            SELECT
                m.*,
                sr.name AS reason_name,
                sr.color_hex AS reason_color,
                w.name  AS warehouse_name,
                s.name  AS subsidiary_name,
                u.fullname AS user_name
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = m.warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = m.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    u ON u.id = m.user_id
            WHERE m.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getMermaDetail($array) {
        $query = "
            SELECT
                d.id,
                d.quantity,
                d.cost,
                d.subtotal_loss,
                d.previous_stock,
                d.resulting_stock,
                d.product_id,
                p.name AS product_name,
                pa.sku,
                p.category_id,
                oc.classification AS category_name
            FROM {$this->bd}detail_inventory_shrinkage d
            INNER JOIN {$this->bd}order_products p ON p.id = d.product_id
            LEFT  JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT  JOIN {$this->bd}order_category   oc ON oc.id = p.category_id
            WHERE d.inventory_shrinkage_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function insertMerma($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, evidence_url, total_products, total_units, total_cost_loss,
                 status, shrinkage_reason_id, warehouse_id,
                 subsidiaries_id, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertMermaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal_loss, previous_stock, resulting_stock,
                 product_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function qCancelMerma($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET status = 'Cancelada', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateMermaEvidence($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET evidence_url = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function deleteMermaById($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET active = 0, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  STOCK / FOLIOS (auxiliares para registrar y descontar)
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

    function insertStockRow($array) {
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

    function nextFolio($prefix, $tabla, $companies_id) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
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
