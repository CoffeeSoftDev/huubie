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

    // ─────────────────────────────────────────────────────────────────
    //  STOCK (listado + KPIs)
    // ─────────────────────────────────────────────────────────────────

    function listStock($array) {
        // El stock se ubica por el ALMACEN (stock.warehouse_id -> warehouse.subsidiaries_id),
        // NO por la sucursal del catalogo del producto. Por eso se pre-agrega en una
        // subconsulta por producto: asi el SUM no se infla aunque hubiera mas de un
        // product_attribute activo, y el filtro de sucursal aplica sobre el almacen.
        //   - Con sucursal (unidad del navbar): INNER JOIN -> solo los productos ASIGNADOS
        //     a esa sucursal, es decir los que tienen al menos una fila de stock en alguno
        //     de sus almacenes (aunque la cantidad sea 0 -> AGOTADO visible). Los productos
        //     que esa unidad no maneja quedan fuera del listado.
        //   - Sin sucursal: LEFT JOIN -> consolidado de TODA la empresa (catalogo completo,
        //     incluidos productos sin ninguna fila de stock -> quantity_total = 0).
        $stockWhere  = 'st.active = 1';
        $stockParams = [];
        $joinType    = 'LEFT';
        if (!empty($array['subsidiaries_id'])) {
            $stockWhere   .= ' AND w.subsidiaries_id = ?';
            $stockParams[] = $array['subsidiaries_id'];
            $joinType      = 'INNER';
        }

        $where       = 'p.active = 1 AND COALESCE(p.companies_id, ps.companies_id) = ?';
        $whereParams = [$array['companies_id']];

        if (!empty($array['category_id'])) {
            $where .= ' AND p.category_id = ?';
            $whereParams[] = $array['category_id'];
        }

        if (!empty($array['q'])) {
            $where .= ' AND (p.name LIKE ? OR pa.sku LIKE ?)';
            $whereParams[] = '%' . $array['q'] . '%';
            $whereParams[] = '%' . $array['q'] . '%';
        }

        // Filtro con/sin movimientos: se mide contra inventory_movement (la misma
        // fuente que el historial del panel de detalle), para que el listado y la
        // vista del producto sean coherentes. Respeta la sucursal seleccionada.
        if (!empty($array['movimiento'])) {
            $exists       = "SELECT 1 FROM {$this->bd}inventory_movement mvf
                             WHERE mvf.product_id = p.id AND mvf.companies_id = ?";
            $existsParams = [$array['companies_id']];
            if (!empty($array['subsidiaries_id'])) {
                $exists        .= ' AND mvf.subsidiaries_id = ?';
                $existsParams[] = $array['subsidiaries_id'];
            }
            if ($array['movimiento'] === 'con') {
                $where .= " AND EXISTS ($exists)";
                $whereParams = array_merge($whereParams, $existsParams);
            } elseif ($array['movimiento'] === 'sin') {
                $where .= " AND NOT EXISTS ($exists)";
                $whereParams = array_merge($whereParams, $existsParams);
            }
        }

        $having = '';
        if (!empty($array['nivel'])) {
            if ($array['nivel'] === 'ok') {
                $having = 'HAVING quantity_total > COALESCE(pa.stock_min, 0)';
            } elseif ($array['nivel'] === 'bajo') {
                $having = 'HAVING quantity_total > 0 AND quantity_total <= COALESCE(pa.stock_min, 0)';
            } elseif ($array['nivel'] === 'agotado') {
                $having = 'HAVING quantity_total <= 0';
            }
        }

        // Orden de los placeholders: primero el de la subconsulta (FROM), luego los del WHERE.
        $data = array_merge($stockParams, $whereParams);

        $query = "
            SELECT
                p.id                AS product_id,
                p.name              AS product_name,
                p.image             AS image,
                pa.sku              AS sku,
                p.category_id,
                oc.classification   AS category_name,
                pa.cost_unit        AS cost_unit,
                pa.stock_min        AS stock_min,
                pa.stock_max        AS stock_max,
                pa.shelf_life_days  AS shelf_life_days,
                u.code              AS unit_code,
                u.name              AS unit_name,
                wa.name             AS area_name,
                wa.color_hex        AS area_color,
                IFNULL(s.quantity_total, 0) AS quantity_total,
                s.last_movement_at          AS last_movement_at,
                s.last_inventory_at         AS last_inventory_at
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}order_category    oc ON oc.id = p.category_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}unit              u  ON u.id  = pa.unit_id
            LEFT JOIN {$this->bd}warehouse_area    wa ON wa.id = pa.warehouse_area_id
            {$joinType} JOIN (
                SELECT
                    st.product_id,
                    SUM(st.quantity)          AS quantity_total,
                    MAX(st.last_movement_at)  AS last_movement_at,
                    MAX(st.last_inventory_at) AS last_inventory_at
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE {$stockWhere}
                GROUP BY st.product_id
            ) s ON s.product_id = p.id
            WHERE {$where}
            GROUP BY p.id
            {$having}
            ORDER BY quantity_total DESC, p.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getStockKpis($array) {
        // Coherente con listStock: el stock se filtra por la sucursal del ALMACEN.
        //   - Con sucursal (unidad del navbar): INNER JOIN -> KPIs solo de los productos
        //     ASIGNADOS a esa sucursal (con fila de stock en ella, agotados incluidos).
        //   - Sin sucursal: LEFT JOIN -> consolidado de TODO el catalogo de la empresa.
        $stockWhere  = 'st.active = 1';
        $stockParams = [];
        $joinType    = 'LEFT';
        if (!empty($array['subsidiaries_id'])) {
            $stockWhere   .= ' AND w.subsidiaries_id = ?';
            $stockParams[] = $array['subsidiaries_id'];
            $joinType      = 'INNER';
        }

        $where       = 'p.active = 1 AND COALESCE(p.companies_id, ps.companies_id) = ?';
        $whereParams = [$array['companies_id']];

        $data = array_merge($stockParams, $whereParams);

        $query = "
            SELECT
                COUNT(DISTINCT p.id) AS total_productos,
                SUM(CASE WHEN COALESCE(s.q, 0) > COALESCE(pa.stock_min, 0) THEN 1 ELSE 0 END) AS total_ok,
                SUM(CASE WHEN COALESCE(s.q, 0) > 0 AND COALESCE(s.q, 0) <= COALESCE(pa.stock_min, 0) THEN 1 ELSE 0 END) AS total_bajo,
                SUM(CASE WHEN COALESCE(s.q, 0) = 0 THEN 1 ELSE 0 END) AS total_agotado
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            {$joinType} JOIN (
                SELECT st.product_id, SUM(st.quantity) AS q
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE {$stockWhere}
                GROUP BY st.product_id
            ) s ON s.product_id = p.id
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total_productos' => 0,
            'total_ok'        => 0,
            'total_bajo'      => 0,
            'total_agotado'   => 0
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  DETALLE DE PRODUCTO (panel del visor)
    // ─────────────────────────────────────────────────────────────────

    function getProductById($array) {
        $query = "
            SELECT
                p.id,
                p.name,
                p.price,
                p.category_id,
                p.subsidiaries_id,
                p.companies_id,
                oc.classification   AS category_name,
                pa.id               AS attribute_id,
                pa.sku,
                pa.description      AS attribute_description,
                pa.cost_unit,
                pa.stock_min,
                pa.stock_max,
                pa.shelf_life_days,
                pa.warehouse_area_id,
                pa.unit_id,
                u.code              AS unit_code,
                u.name              AS unit_name,
                wa.name             AS area_name
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bd}order_category   oc ON oc.id = p.category_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}unit              u  ON u.id  = pa.unit_id
            LEFT JOIN {$this->bd}warehouse_area    wa ON wa.id = pa.warehouse_area_id
            WHERE p.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function listStockByProduct($array) {
        $query = "
            SELECT
                st.id,
                st.quantity,
                st.last_movement_at,
                st.last_inventory_at,
                w.id                AS warehouse_id,
                w.name              AS warehouse_name,
                w.subsidiaries_id,
                s.name              AS subsidiary_name,
                wa.name             AS area_name,
                wa.color_hex        AS area_color
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}warehouse      w  ON w.id = st.warehouse_id
            LEFT  JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT  JOIN {$this->bdAlpha}subsidiaries s ON s.id = w.subsidiaries_id
            WHERE st.product_id = ? AND st.active = 1
            ORDER BY s.name ASC, w.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function listMovementsByProduct($array) {
        $query = "
            SELECT
                mv.movement_uid,
                mv.movement_type,
                mv.folio,
                mv.quantity,
                mv.cost_unit,
                mv.cost_total,
                mv.occurred_at,
                mv.warehouse_id,
                w.name AS warehouse_name,
                mv.note
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}warehouse w ON w.id = mv.warehouse_id
            WHERE mv.product_id = ? AND mv.companies_id = ?
            ORDER BY mv.occurred_at DESC
            LIMIT 20
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }
}
