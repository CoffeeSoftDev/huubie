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

    // -----------------------------------------------------------------------
    // Catalogos compartidos (copiados de mdl-entradas, modulo independiente)
    // -----------------------------------------------------------------------

    function lsSucursales($array) {
        $companyId = $array['company_id'];
        $userId    = $array['user_id'];
        $isOwner   = (int) $array['is_owner'];

        if ($isOwner === 1) {
            $query = "
                SELECT id, name AS valor, company_id AS companies_id
                FROM {$this->bdErp}branches
                WHERE company_id = ? AND is_active = 1
                ORDER BY name ASC
            ";
            $r = $this->_Read($query, [$companyId]);
        } else {
            $query = "
                SELECT b.id, b.name AS valor, b.company_id AS companies_id
                FROM {$this->bdErp}branches b
                INNER JOIN {$this->bdErp}users_braches ub ON ub.branch_id = b.id
                WHERE b.company_id = ? AND b.is_active = 1 AND ub.user_id = ?
                ORDER BY b.name ASC
            ";
            $r = $this->_Read($query, [$companyId, $userId]);
        }
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
                s.name AS branch_name
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT JOIN {$this->bdErp}branches s ON s.id = w.branch_id
            WHERE {$where}
            ORDER BY s.name ASC, w.is_default DESC, w.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function lsSuppliers($array) {
        $query = "
            SELECT id, name, name AS valor
            FROM {$this->bd}supplier
            WHERE active = 1 AND companies_id = ?
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function findSupplierByName($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}supplier
            WHERE active = 1 AND companies_id = ? AND LOWER(name) = LOWER(?)
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function insertSupplier($array) {
        $query = "
            INSERT INTO {$this->bd}supplier
                (name, contact_name, phone, email, companies_id)
            VALUES (?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
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
                i.price_without_tax                        AS price_without_tax,
                i.tax                                      AS tax,
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

    function getInflowOrigin($array) {
        $query = "
            SELECT id, code, name, color_hex, requires_supplier
            FROM {$this->bd}inflow_origin
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // -----------------------------------------------------------------------
    // Listado / KPIs de ordenes
    // -----------------------------------------------------------------------

    function qOrdenes($array) {
        $where = 'po.active = 1 AND po.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND po.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['supplier_id'])) {
            $where .= ' AND po.supplier_id = ?';
            $data[] = $array['supplier_id'];
        }
        if (!empty($array['status'])) {
            if ($array['status'] === 'Activas') {
                $where .= " AND po.status <> 'Cancelada'";
            } else {
                $where .= ' AND po.status = ?';
                $data[] = $array['status'];
            }
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(po.date_order) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (po.folio LIKE ? OR po.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }
        if (!empty($array['mine'])) {
            $where .= ' AND po.user_id = ?';
            $data[] = $array['mine'];
        }

        $query = "
            SELECT
                po.id,
                po.folio,
                po.note,
                po.total_products,
                po.total_units,
                po.total_cost,
                po.status,
                po.date_order,
                po.created_at,
                po.expected_date,
                po.warehouse_id,
                w.name         AS warehouse_name,
                po.branch_id,
                s.name         AS branch_name,
                po.supplier_id,
                sp.name        AS supplier_name,
                po.user_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))  AS user_name,
                po.approved_user_id,
                TRIM(CONCAT(COALESCE(au.name, ''), ' ', COALESCE(au.last_name, ''))) AS approved_user_name,
                po.approved_at,
                po.reject_reason
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = po.warehouse_id
            LEFT JOIN {$this->bdErp}branches      s  ON s.id  = po.branch_id
            LEFT JOIN {$this->bd}supplier         sp ON sp.id = po.supplier_id
            LEFT JOIN {$this->bdErp}users         u  ON u.id  = po.user_id
            LEFT JOIN {$this->bdErp}users         au ON au.id = po.approved_user_id
            WHERE {$where}
            ORDER BY po.date_order DESC, po.id DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getOrdenKpis($array) {
        $where = 'po.active = 1 AND po.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND po.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['supplier_id'])) {
            $where .= ' AND po.supplier_id = ?';
            $data[] = $array['supplier_id'];
        }
        if (!empty($array['status'])) {
            if ($array['status'] === 'Activas') {
                $where .= " AND po.status <> 'Cancelada'";
            } else {
                $where .= ' AND po.status = ?';
                $data[] = $array['status'];
            }
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(po.date_order) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (po.folio LIKE ? OR po.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }
        if (!empty($array['mine'])) {
            $where .= ' AND po.user_id = ?';
            $data[] = $array['mine'];
        }

        $query = "
            SELECT
                COUNT(po.id)                                AS total_ordenes,
                SUM(po.status = 'Solicitada')               AS total_solicitadas,
                SUM(po.status = 'Aprobada')                 AS total_aprobadas,
                SUM(po.status = 'Parcial')                  AS total_parciales,
                SUM(po.status = 'Recibida')                 AS total_recibidas,
                SUM(po.status = 'Cancelada')                AS total_canceladas,
                IFNULL(SUM(po.total_cost), 0)               AS total_costo
            FROM {$this->bd}purchase_order po
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total_ordenes'     => 0,
            'total_solicitadas' => 0,
            'total_aprobadas'   => 0,
            'total_parciales'   => 0,
            'total_recibidas'   => 0,
            'total_canceladas'  => 0,
            'total_costo'       => 0
        ];
    }

    // -----------------------------------------------------------------------
    // Detalle de una orden (header + renglones)
    // -----------------------------------------------------------------------

    function qGetOrden($array) {
        $query = "
            SELECT
                po.*,
                w.name         AS warehouse_name,
                s.name         AS branch_name,
                ds.name        AS destination_branch_name,
                sp.name        AS supplier_name,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))   AS user_name,
                TRIM(CONCAT(COALESCE(au.name, ''), ' ', COALESCE(au.last_name, ''))) AS approved_user_name
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = po.warehouse_id
            LEFT JOIN {$this->bdErp}branches      s  ON s.id  = po.branch_id
            LEFT JOIN {$this->bdErp}branches      ds ON ds.id = po.destination_branch_id
            LEFT JOIN {$this->bd}supplier         sp ON sp.id = po.supplier_id
            LEFT JOIN {$this->bdErp}users         u  ON u.id  = po.user_id
            LEFT JOIN {$this->bdErp}users         au ON au.id = po.approved_user_id
            WHERE po.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qGetOrdenDetail($array) {
        $query = "
            SELECT
                d.id,
                d.purchase_order_id,
                d.item_id AS product_id,
                d.unit_id,
                d.quantity_ordered,
                d.quantity_received,
                d.price_without_tax,
                d.tax,
                d.cost,
                d.subtotal,
                i.name  AS product_name,
                ia.sku,
                i.image
            FROM {$this->bd}detail_purchase_order d
            INNER JOIN {$this->bd}item            i  ON i.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            WHERE d.purchase_order_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // -----------------------------------------------------------------------
    // Insercion de cabecera y renglones de la OC
    // -----------------------------------------------------------------------

    function insertOrden($array) {
        $query = "
            INSERT INTO {$this->bd}purchase_order
                (folio, supplier_id, branch_id, destination_branch_id, warehouse_id,
                 date_order, expected_date, note,
                 total_products, total_units, total_cost, total_price_without_tax,
                 status, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertOrdenDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_purchase_order
                (purchase_order_id, item_id, unit_id,
                 quantity_ordered, quantity_received,
                 price_without_tax, tax, cost, subtotal)
            VALUES (?,?,?,?,0,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Actualizaciones de estado y totales de la OC
    // -----------------------------------------------------------------------

    function updateOrdenStatus($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenStatusApprove($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = ?, approved_user_id = ?, approved_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenStatusReject($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = 'Rechazada', approved_user_id = ?, approved_at = NOW(),
                reject_reason = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenTotals($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET total_products = ?, total_units = ?,
                total_cost = ?, total_price_without_tax = ?,
                updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenWarehouse($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET warehouse_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Detalle de la OC: soft-delete y actualizacion de cantidad recibida
    // -----------------------------------------------------------------------

    function softDeleteOrdenDetails($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET active = 0
            WHERE purchase_order_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateDetailReceived($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET quantity_received = quantity_received + ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Insercion de entrada (inventory_inflow) vinculada a la OC
    // Incluye purchase_order_id — columna nueva en la tabla.
    // -----------------------------------------------------------------------

    function insertInflowFromOrden($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost,
                 total_price_without_tax, status,
                 inflow_origin_id, warehouse_id, supplier_id,
                 branch_id, user_id, companies_id, date_inflow, purchase_order_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertInflowDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (quantity, cost, subtotal, price_without_tax, tax,
                 previous_stock, resulting_stock,
                 item_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Stock (copiado de mdl-entradas, necesario para receiveOrden)
    // -----------------------------------------------------------------------

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

    function updateItemTax($array) {
        $query = "
            UPDATE {$this->bd}item
            SET price = ?, price_without_tax = ?, tax = ?
            WHERE id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Folio correlativo (copiado de mdl-entradas)
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Surtido a sucursal: salida de inventario (inventory_shrinkage) + stock
    // -----------------------------------------------------------------------

    function getShrinkageReasonId($array) {
        $query = "
            SELECT id
            FROM {$this->bd}shrinkage_reason
            WHERE code = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : null;
    }

    function insertShrinkageFromOrden($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, total_products, total_units, total_cost,
                 status, shrinkage_reason_id, warehouse_id,
                 branch_id, user_id, companies_id, date_shrinkage)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertShrinkageDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal, previous_stock, resulting_stock,
                 item_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
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
}
