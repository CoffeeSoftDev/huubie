<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

// Modelo del Dashboard del almacén: indicadores del stock de la sucursal activa y la
// bitácora de movimientos. La bitácora sale de la vista inventory_movement (un
// renglón por producto de cada entrada, salida, ajuste o traspaso aplicado).
class mdl extends CRUD {

    public $util;
    public $bd;
    public $bdErp;

    public function __construct() {
        $this->util  = new Utileria;
        $this->bd    = 'fayxzvov_inventory.';
        $this->bdErp = 'fayxzvov_erp.';
    }

    // Mismos criterios que las cards de Stock (mdl-stock::getStockKpis): bajo es
    // tener algo pero no más del mínimo; agotado, no tener nada. El valor va al
    // último costo de compra, como en el Catálogo.
    function getDashboardCounts($array) {
        // [branch_id, companies_id]
        $query = "
            SELECT
                COUNT(DISTINCT i.id) AS total_productos,
                SUM(CASE WHEN COALESCE(s.q, 0) > 0 AND COALESCE(s.q, 0) <= COALESCE(ia.stock_min, 0) THEN 1 ELSE 0 END) AS total_bajo,
                SUM(CASE WHEN COALESCE(s.q, 0) <= 0 THEN 1 ELSE 0 END) AS total_agotado,
                COALESCE(SUM(COALESCE(s.q, 0) * COALESCE(ia.cost_unit, 0)), 0) AS valor_inventario
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT st.item_id, SUM(st.quantity) AS q
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE st.active = 1 AND w.branch_id = ?
                GROUP BY st.item_id
            ) s ON s.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ?
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : [];
    }

    // Desglose de las cards: cada producto activo con su existencia en la sucursal,
    // su mínimo y su último costo. Mismos cruces que getDashboardCounts, para que
    // el modal sume lo mismo que la card.
    function listStockDetail($array) {
        // [branch_id, companies_id]
        $query = "
            SELECT
                i.name,
                ia.sku,
                ic.name                    AS categoria,
                u.name                     AS unidad,
                COALESCE(s.q, 0)           AS stock,
                COALESCE(ia.stock_min, 0)  AS stock_min,
                COALESCE(ia.cost_unit, 0)  AS cost_unit
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit           u  ON u.id = ia.unit_id
            LEFT JOIN (
                SELECT st.item_id, SUM(st.quantity) AS q
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE st.active = 1 AND w.branch_id = ?
                GROUP BY st.item_id
            ) s ON s.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ?
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Los que ya llegaron a su mínimo (o se acabaron), los más urgentes primero.
    // Sin mínimo capturado no hay contra qué comparar y no salen.
    function listLowStock($array) {
        // [branch_id, companies_id]
        $query = "
            SELECT
                i.name,
                COALESCE(s.q, 0) AS stock,
                ia.stock_min,
                u.name AS unidad
            FROM {$this->bd}item i
            INNER JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}unit u ON u.id = ia.unit_id
            LEFT JOIN (
                SELECT st.item_id, SUM(st.quantity) AS q
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE st.active = 1 AND w.branch_id = ?
                GROUP BY st.item_id
            ) s ON s.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ?
                AND ia.stock_min > 0
                AND COALESCE(s.q, 0) <= ia.stock_min
            ORDER BY COALESCE(s.q, 0) / ia.stock_min ASC, i.name ASC
            LIMIT 10
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Bitácora: un renglón por documento (folio) con quién lo registró, cuántos
    // productos y unidades movió y a qué costo. Tipo vacío o usuario 0 = todos.
    function listMovementLog($array) {
        // [companies_id, branch_id, fi, ff, tipo, tipo, user_id, user_id]
        $query = "
            SELECT
                mv.movement_type,
                mv.folio,
                MAX(mv.created_at)         AS created_at,
                COUNT(DISTINCT mv.item_id) AS productos,
                SUM(mv.quantity)           AS unidades,
                SUM(mv.cost_total)         AS costo,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS usuario,
                w.name                     AS almacen
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bdErp}users u ON u.id = mv.user_id
            LEFT JOIN {$this->bd}warehouse w ON w.id = mv.warehouse_id
            WHERE mv.companies_id = ? AND mv.branch_id = ?
                AND DATE(mv.created_at) BETWEEN ? AND ?
                AND (? = '' OR mv.movement_type = ?)
                AND (? = 0 OR mv.user_id = ?)
            GROUP BY mv.movement_type, mv.folio, mv.user_id, mv.warehouse_id, u.name, u.last_name, w.name
            ORDER BY created_at DESC, mv.folio DESC
            LIMIT 500
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Detalle de un renglón de la bitácora: los productos del documento (folio) en
    // la sucursal. Un traspaso tiene la salida en la sucursal de origen y la
    // entrada en la de destino con el mismo folio: el filtro por sucursal deja el
    // lado que se ve en su bitácora.
    function listMovementDetail($array) {
        // [companies_id, branch_id, movement_type, folio]
        $query = "
            SELECT
                i.name,
                ia.sku,
                un.name        AS unidad,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post,
                mv.cost_unit,
                mv.cost_total,
                mv.note,
                mv.created_at,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS usuario,
                w.name         AS almacen
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}item           i  ON i.id = mv.item_id
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}unit           un ON un.id = ia.unit_id
            LEFT JOIN {$this->bdErp}users       u  ON u.id = mv.user_id
            LEFT JOIN {$this->bd}warehouse      w  ON w.id = mv.warehouse_id
            WHERE mv.companies_id = ? AND mv.branch_id = ?
                AND mv.movement_type = ? AND mv.folio = ?
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Quienes tienen movimientos en la sucursal, para el filtro de usuario.
    function lsMovementUsers($array) {
        // [companies_id, branch_id]
        $query = "
            SELECT DISTINCT
                mv.user_id AS id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS valor
            FROM {$this->bd}inventory_movement mv
            INNER JOIN {$this->bdErp}users u ON u.id = mv.user_id
            WHERE mv.companies_id = ? AND mv.branch_id = ?
            ORDER BY valor ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }
}
