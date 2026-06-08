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
                s.name AS branch_name
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bdErp}branches s ON s.id = w.branch_id
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
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function qProductsForTransfer($array) {
        $query = "
            SELECT
                i.id                                       AS id,
                i.name                                     AS nombre,
                ia.sku                                     AS sku,
                ic.name                                    AS categoria,
                COALESCE(ia.cost_unit, i.price, 0)         AS costo,
                i.price                                    AS precio,
                i.image                                    AS image
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            WHERE i.active = 1 AND i.companies_id = ?
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qStockByWarehouse($array) {
        $query = "
            SELECT item_id, quantity
            FROM {$this->bd}stock
            WHERE warehouse_id = ? AND active = 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qSalidas($array) {
        $where = 'm.active = 1 AND m.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND m.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['reason_id'])) {
            $where .= ' AND m.shrinkage_reason_id = ?';
            $data[] = $array['reason_id'];
        }
        if (!empty($array['status'])) {
            $where .= ' AND m.status = ?';
            $data[] = $array['status'];
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
                m.total_cost            AS total_cost_loss,
                m.status,
                m.created_at,
                m.updated_at,
                m.shrinkage_reason_id,
                sr.name             AS reason_name,
                sr.color_hex        AS reason_color,
                sr.icon             AS reason_icon,
                m.warehouse_id,
                w.name              AS warehouse_name,
                m.branch_id,
                s.name              AS branch_name,
                m.user_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            LEFT JOIN {$this->bd}warehouse         w  ON w.id  = m.warehouse_id
            LEFT JOIN {$this->bdErp}branches   s  ON s.id  = m.branch_id
            LEFT JOIN {$this->bdErp}users          u  ON u.id  = m.user_id
            WHERE {$where}
            ORDER BY m.created_at DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getSalidaKpis($array) {
        $where = "m.active = 1 AND m.status <> 'Cancelada' AND m.companies_id = ?";
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND m.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['reason_id'])) {
            $where .= ' AND m.shrinkage_reason_id = ?';
            $data[] = $array['reason_id'];
        }
        if (!empty($array['status'])) {
            $where .= ' AND m.status = ?';
            $data[] = $array['status'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(m.created_at) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(m.id)                   AS total_salidas,
                IFNULL(SUM(m.total_cost), 0)  AS total_costo,
                IFNULL(SUM(m.total_units), 0) AS total_unidades
            FROM {$this->bd}inventory_shrinkage m
            WHERE {$where}
        ";
        $r    = $this->_Read($query, $data);
        $base = !empty($r) ? $r[0] : [
            'total_salidas'   => 0,
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
        $top               = $this->_Read($queryTop, $data);
        $base['motivo_top'] = !empty($top) ? $top[0]['motivo_top'] : '-';
        return $base;
    }

    function qGetSalida($array) {
        $query = "
            SELECT
                m.*,
                m.total_cost   AS total_cost_loss,
                sr.name        AS reason_name,
                sr.color_hex   AS reason_color,
                sr.icon        AS reason_icon,
                w.name         AS warehouse_name,
                s.name         AS branch_name,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            LEFT JOIN {$this->bd}warehouse         w  ON w.id  = m.warehouse_id
            LEFT JOIN {$this->bdErp}branches   s  ON s.id  = m.branch_id
            LEFT JOIN {$this->bdErp}users          u  ON u.id  = m.user_id
            WHERE m.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getSalidaDetail($array) {
        $query = "
            SELECT
                d.id,
                d.quantity,
                d.cost,
                d.subtotal AS subtotal_loss,
                d.previous_stock,
                d.resulting_stock,
                d.item_id AS product_id,
                i.name AS product_name,
                ia.sku,
                i.category_id,
                ic.name AS category_name
            FROM {$this->bd}detail_inventory_shrinkage d
            INNER JOIN {$this->bd}item i ON i.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT  JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            WHERE d.inventory_shrinkage_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function insertSalida($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, evidence_url, total_products, total_units, total_cost,
                 status, shrinkage_reason_id, warehouse_id,
                 branch_id, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertSalidaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal, previous_stock, resulting_stock,
                 item_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function qCancelSalida($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET status = 'Cancelada', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateSalidaEvidence($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET evidence_url = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function deleteSalidaById($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET active = 0, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

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

    function insertStockRow($array) {
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

    function nextFolio($prefix, $tabla, $companies_id) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
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
