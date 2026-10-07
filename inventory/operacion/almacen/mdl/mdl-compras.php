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

    // Catalogos:

    function lsSucursales($array) {
        if ((int) $array['is_owner'] === 1) {
            $query = "
                SELECT id, name AS valor
                FROM {$this->bdErp}branches
                WHERE company_id = ? AND is_active = 1
                ORDER BY name ASC
            ";
            return $this->_Read($query, [$array['company_id']]);
        }

        $query = "
            SELECT b.id, b.name AS valor
            FROM {$this->bdErp}branches b
            INNER JOIN {$this->bdErp}users_braches ub ON ub.branch_id = b.id
            WHERE b.company_id = ? AND b.is_active = 1 AND ub.user_id = ?
            ORDER BY b.name ASC
        ";
        return $this->_Read($query, [$array['company_id'], $array['user_id']]);
    }

    function lsWarehouses($array) {
        $query = "
            SELECT id, name AS valor, branch_id, is_default
            FROM {$this->bd}warehouse
            WHERE active = 1 AND companies_id = ?
            ORDER BY is_default DESC, name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsSuppliers($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}supplier
            WHERE active = 1 AND companies_id = ?
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsCategorias($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE active = 1 AND companies_id = ?
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsUnidades($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}unit
            WHERE active = 1 AND companies_id = ?
            ORDER BY sort_order ASC, name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsProductos($array) {
        $query = "
            SELECT
                i.id,
                i.name                                       AS nombre,
                ia.sku,
                ic.name                                      AS categoria,
                COALESCE(ia.cost_unit, 0)                    AS costo_sin_iva,
                COALESCE(ia.cost_tax, i.tax, 0)              AS iva_compra,
                ROUND(COALESCE(ia.cost_unit, 0) * (1 + COALESCE(ia.cost_tax, i.tax, 0) / 100), 2) AS costo,
                ia.unit_id,
                u.name                                       AS unidad,
                i.image,
                ia.description                               AS descripcion,
                ia.stock_max
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit           u  ON u.id = ia.unit_id
            WHERE i.active = 1 AND i.companies_id = ?
            ORDER BY i.name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsBuyers($array) {
        $query = "
            SELECT DISTINCT buyer_name AS valor
            FROM {$this->bd}purchase_order
            WHERE companies_id = ? AND purchase_type IS NOT NULL
              AND buyer_name IS NOT NULL AND buyer_name <> ''
            ORDER BY buyer_name ASC
        ";
        return $this->_Read($query, $array);
    }

    // Compras:

    function listCompras($array) {
        list($where, $data) = $this->filtersCompras($array);

        if ($array['status'] === 'Activas') {
            $where .= " AND po.status IN ('Pendiente', 'En surtido')";
        } elseif ($array['status'] !== 'Todas' && $array['status'] !== '') {
            $where .= ' AND po.status = ?';
            $data[] = $array['status'];
        }

        $query = "
            SELECT
                po.id,
                po.folio,
                po.name,
                po.purchase_type,
                po.status,
                po.date_order,
                po.buyer_name,
                po.total_products,
                po.total_cost,
                po.series_code,
                po.weekdays,
                w.name      AS warehouse_name,
                b.name      AS branch_name,
                origin.folio AS origin_folio
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bd}warehouse      w      ON w.id      = po.warehouse_id
            LEFT JOIN {$this->bdErp}branches    b      ON b.id      = po.branch_id
            LEFT JOIN {$this->bd}purchase_order origin ON origin.id = po.origin_purchase_order_id
            WHERE {$where}
            ORDER BY
                po.status IN ('Pendiente', 'En surtido') DESC,
                CASE WHEN po.status IN ('Pendiente', 'En surtido') THEN po.date_order END ASC,
                po.date_order DESC,
                po.id DESC
        ";
        return $this->_Read($query, $data);
    }

    function getCompraCounts($array) {
        list($where, $data) = $this->filtersCompras($array);

        $query = "
            SELECT
                IFNULL(SUM(po.status = 'Pendiente'), 0)                                        AS pendientes,
                IFNULL(SUM(po.status IN ('Pendiente', 'En surtido') AND po.date_order < ?), 0) AS atrasadas,
                IFNULL(SUM(po.status = 'En surtido'), 0)                                       AS en_surtido,
                IFNULL(SUM(po.status = 'Capturada'), 0)                                        AS capturadas,
                IFNULL(SUM(CASE WHEN po.status = 'Capturada' THEN po.total_cost END), 0)       AS gastado
            FROM {$this->bd}purchase_order po
            WHERE {$where}
        ";
        $result = $this->_Read($query, array_merge([$array['today']], $data));
        return $result ? $result[0] : [];
    }

    // Lo pendiente de fechas anteriores al periodo se sigue mostrando: una compra
    // sin capturar nunca se pierde por el filtro de fechas.
    function filtersCompras($array) {
        $where = 'po.active = 1 AND po.companies_id = ? AND po.purchase_type IS NOT NULL';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND po.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['purchase_type'])) {
            $where .= ' AND po.purchase_type = ?';
            $data[] = $array['purchase_type'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= " AND (po.date_order BETWEEN ? AND ? OR (po.status IN ('Pendiente', 'En surtido') AND po.date_order < ?))";
            array_push($data, $array['fi'], $array['ff'], $array['fi']);
        }
        if (!empty($array['q'])) {
            $where .= ' AND (po.folio LIKE ? OR po.name LIKE ? OR po.buyer_name LIKE ?)';
            $like   = '%' . $array['q'] . '%';
            array_push($data, $like, $like, $like);
        }

        return [$where, $data];
    }

    function listCompraEvents($array) {
        $where = "po.active = 1 AND po.companies_id = ? AND po.purchase_type IS NOT NULL
                  AND po.status <> 'Cancelada' AND po.date_order BETWEEN ? AND ?";
        $data  = [$array['companies_id'], $array['fi'], $array['ff']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND po.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['purchase_type'])) {
            $where .= ' AND po.purchase_type = ?';
            $data[] = $array['purchase_type'];
        }

        $query = "
            SELECT po.id, po.folio, po.name, po.purchase_type, po.status, po.date_order,
                   po.buyer_name, po.total_products
            FROM {$this->bd}purchase_order po
            WHERE {$where}
            ORDER BY po.date_order ASC, po.id ASC
        ";
        return $this->_Read($query, $data);
    }

    function listCompraTemplates($array) {
        $query = "
            SELECT id, folio, name, date_order, purchase_type, status
            FROM {$this->bd}purchase_order
            WHERE active = 1 AND companies_id = ? AND purchase_type IS NOT NULL
              AND status <> 'Cancelada' AND total_products > 0
            ORDER BY date_order DESC, id DESC
            LIMIT 300
        ";
        return $this->_Read($query, $array);
    }

    function getCompraById($array) {
        $query = "
            SELECT
                po.*,
                w.name       AS warehouse_name,
                b.name       AS branch_name,
                sp.name      AS supplier_name,
                origin.folio AS origin_folio,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))   AS user_name,
                TRIM(CONCAT(COALESCE(cu.name, ''), ' ', COALESCE(cu.last_name, ''))) AS captured_user_name
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bd}warehouse      w      ON w.id      = po.warehouse_id
            LEFT JOIN {$this->bdErp}branches    b      ON b.id      = po.branch_id
            LEFT JOIN {$this->bd}supplier       sp     ON sp.id     = po.supplier_id
            LEFT JOIN {$this->bd}purchase_order origin ON origin.id = po.origin_purchase_order_id
            LEFT JOIN {$this->bdErp}users       u      ON u.id      = po.user_id
            LEFT JOIN {$this->bdErp}users       cu     ON cu.id     = po.captured_user_id
            WHERE po.id = ? AND po.companies_id = ? AND po.purchase_type IS NOT NULL
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? $result[0] : null;
    }

    function listCompraDetail($array) {
        $query = "
            SELECT
                d.id,
                d.item_id AS product_id,
                d.unit_id,
                d.quantity_ordered,
                d.quantity_received,
                d.price_without_tax,
                d.tax,
                d.cost,
                d.subtotal,
                d.purchase_place,
                i.name    AS product_name,
                ia.sku,
                i.image,
                ic.name   AS categoria,
                COALESCE(du.name, iu.name) AS unit_name
            FROM {$this->bd}detail_purchase_order d
            INNER JOIN {$this->bd}item           i  ON i.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT  JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT  JOIN {$this->bd}unit           du ON du.id = d.unit_id
            LEFT  JOIN {$this->bd}unit           iu ON iu.id = ia.unit_id
            WHERE d.purchase_order_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function listCompraHistory($array) {
        $query = "
            SELECT id, folio, date_order, total_cost
            FROM {$this->bd}purchase_order
            WHERE active = 1 AND companies_id = ? AND purchase_type IS NOT NULL
              AND status = 'Capturada' AND name = ? AND id <> ?
            ORDER BY date_order DESC, id DESC
            LIMIT 3
        ";
        return $this->_Read($query, $array);
    }

    function getSeriesSummary($array) {
        $query = "
            SELECT
                IFNULL(SUM(status = 'Pendiente'), 0)                              AS pendientes,
                MAX(CASE WHEN status <> 'Cancelada' THEN date_order END)           AS last_date,
                MIN(CASE WHEN status = 'Pendiente' AND date_order >= ? THEN date_order END) AS next_date
            FROM {$this->bd}purchase_order
            WHERE active = 1 AND companies_id = ? AND series_code = ?
        ";
        $result = $this->_Read($query, $array);
        return $result ? $result[0] : null;
    }

    function getLatestSeriesCompra($array) {
        $query = "
            SELECT id, weekdays, date_order
            FROM {$this->bd}purchase_order
            WHERE active = 1 AND companies_id = ? AND series_code = ? AND status <> 'Cancelada'
            ORDER BY date_order DESC, id DESC
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? $result[0] : null;
    }

    function getLastSeriesCode($array) {
        $query = "
            SELECT series_code
            FROM {$this->bd}purchase_order
            WHERE companies_id = ? AND series_code LIKE 'RUT-%'
            ORDER BY CAST(SUBSTRING(series_code, 5) AS UNSIGNED) DESC
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? $result[0]['series_code'] : null;
    }

    function getCompraIdByFolio($array) {
        $query = "
            SELECT id
            FROM {$this->bd}purchase_order
            WHERE folio = ? AND companies_id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? (int) $result[0]['id'] : 0;
    }

    function getInflowByCompra($array) {
        $query = "
            SELECT id, folio
            FROM {$this->bd}inventory_inflow
            WHERE purchase_order_id = ? AND active = 1
            ORDER BY id DESC
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? $result[0] : null;
    }

    function createCompra($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}purchase_order",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function createCompraDetail($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_purchase_order",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCompra($array) {
        return $this->_Update([
            'table'  => "{$this->bd}purchase_order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateCompraDetail($array) {
        return $this->_Update([
            'table'  => "{$this->bd}detail_purchase_order",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function disableCompraDetail($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET active = 0
            WHERE purchase_order_id = ? AND active = 1
        ";
        return $this->_CUD($query, $array);
    }

    function cancelSeriesPending($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = 'Cancelada', updated_at = NOW()
            WHERE active = 1 AND companies_id = ? AND series_code = ?
              AND status = 'Pendiente' AND date_order >= ?
        ";
        return $this->_CUD($query, $array);
    }

    function nextFolio($prefix, $tabla, $companiesId) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
            WHERE companies_id = ? AND folio LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $result = $this->_Read($query, [$companiesId, $prefix . '%']);
        $next   = 1;
        if (!empty($result)) {
            $next = (int) preg_replace('/[^0-9]/', '', substr($result[0]['folio'], strlen($prefix))) + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    // Entradas:

    function getInflowOriginByCode($array) {
        $query = "
            SELECT id
            FROM {$this->bd}inflow_origin
            WHERE code = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? (int) $result[0]['id'] : 0;
    }

    function getInflowIdByFolio($array) {
        $query = "
            SELECT id
            FROM {$this->bd}inventory_inflow
            WHERE folio = ? AND companies_id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? (int) $result[0]['id'] : 0;
    }

    function createInflow($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inventory_inflow",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function createInflowDetail($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}detail_inventory_inflow",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result ? $result[0] : null;
    }

    function createStock($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}stock",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateStock($array) {
        return $this->_Update([
            'table'  => "{$this->bd}stock",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Ultimo costo de compra del producto: base sin IVA y tasa, igual que Entradas.
    function updateItemCost($array) {
        $query = "
            UPDATE {$this->bd}item_attribute
            SET cost_unit = ?, cost_tax = ?
            WHERE item_id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }
}
