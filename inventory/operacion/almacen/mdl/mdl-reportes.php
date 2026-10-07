<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;
    public $bdErp;

    // Clasifica cada movimiento de la vista inventory_movement en el renglon del
    // reporte. Las SALIDAS se separan por el motivo de la salida (shrinkage_reason).
    public $bucketSql = "
        CASE
            WHEN mv.movement_type = 'ENTRADA' THEN 'entradas'
            WHEN mv.movement_type = 'TRANSFERENCIA' AND mv.quantity > 0 THEN 'entradas'
            WHEN mv.movement_type = 'TRANSFERENCIA' THEN 'salidas'
            WHEN mv.movement_type = 'SALIDA' AND sr.code = 'SALIDA_POR_VENTA' THEN 'ventas'
            WHEN mv.movement_type = 'SALIDA' AND sr.code IN ('MERMA', 'CADUCIDAD', 'DANO') THEN 'desperdicio'
            WHEN mv.movement_type = 'SALIDA' THEN 'salidas'
            WHEN mv.movement_type = 'AJUSTE' THEN 'ajuste'
            ELSE 'otro'
        END
    ";

    public function __construct() {
        $this->util  = new Utileria;
        $this->bd    = 'fayxzvov_inventory.';
        $this->bdErp = 'fayxzvov_erp.';
    }

    // -- Catalogos --

    function lsSucursales($array) {
        $companyId = $array['company_id'];
        $userId    = $array['user_id'];
        $isOwner   = (int) $array['is_owner'];

        if ($isOwner === 1) {
            $query = "
                SELECT id, name AS valor
                FROM {$this->bdErp}branches
                WHERE company_id = ? AND is_active = 1
                ORDER BY name ASC
            ";
            $result = $this->_Read($query, [$companyId]);
        } else {
            $query = "
                SELECT b.id, b.name AS valor
                FROM {$this->bdErp}branches b
                INNER JOIN {$this->bdErp}users_braches ub ON ub.branch_id = b.id
                WHERE b.company_id = ? AND b.is_active = 1 AND ub.user_id = ?
                ORDER BY b.name ASC
            ";
            $result = $this->_Read($query, [$companyId, $userId]);
        }
        return is_array($result) ? $result : [];
    }

    function lsWarehouses($array) {
        $query = "
            SELECT
                w.id,
                CONCAT(w.name, IFNULL(CONCAT(' - ', b.name), '')) AS valor,
                COALESCE(w.branch_id, 0) AS branch_id,
                w.name AS almacen,
                b.name AS sucursal
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bdErp}branches b ON b.id = w.branch_id
            WHERE w.active = 1
            AND w.companies_id = ?
            ORDER BY b.name ASC, w.is_default DESC, w.name ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function lsAreas($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}warehouse_area
            WHERE active = 1
            AND companies_id = ?
            ORDER BY name ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function lsCategories($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE active = 1
            AND companies_id = ?
            ORDER BY name ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getCompanyById($array) {
        $query = "
            SELECT name, rfc, ubication
            FROM {$this->bdErp}companies
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    // -- Reporte de inventario --

    // Mismos criterios que listFormatoConteo (mdl-almacen): activos e
    // inventariables, por area y nombre, sin area al final. La existencia es la
    // ACTUAL de los almacenes del filtro; el ctrl la reconstruye hacia atras.
    function listProductosReporte($filters) {
        $ids    = $filters['warehouse_ids'];
        $marks  = $ids ? implode(',', array_fill(0, count($ids), '?')) : 'NULL';
        $params = array_merge($ids, [$filters['companies_id']]);

        $query = "
            SELECT
                i.id,
                ia.sku,
                i.name,
                u.code  AS unidad,
                ic.name AS categoria,
                COALESCE(ia.warehouse_area_id, 0) AS area_id,
                wa.name AS area,
                COALESCE(st.qty, 0) AS existencia
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit           u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = ia.warehouse_area_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1
                AND warehouse_id IN ({$marks})
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE i.companies_id = ?
            AND i.active = 1
            AND COALESCE(ia.is_inventoriable, 1) = 1
        ";

        if (!empty($filters['category_id'])) {
            $query   .= ' AND i.category_id = ?';
            $params[] = $filters['category_id'];
        }

        if (!empty($filters['area_id'])) {
            $query   .= ' AND ia.warehouse_area_id = ?';
            $params[] = $filters['area_id'];
        }

        $query .= ' ORDER BY wa.name IS NULL, wa.name ASC, i.name ASC';

        $result = $this->_Read($query, $params);
        return is_array($result) ? $result : [];
    }

    // Movimientos agregados por producto, dia y renglon desde fi en adelante, SIN
    // tope superior: lo posterior al periodo solo sirve para reconstruir la
    // existencia inicial a partir del stock actual. El tipo de entrada (origen) y
    // el motivo de salida salen por separado: el ctrl arma con ellos el concepto
    // del reporte completo (inflow_origin y shrinkage_reason son latin1 y no se
    // pueden concatenar en SQL con las columnas de la vista).
    function listMovimientosReporte($filters) {
        $ids = $filters['warehouse_ids'];
        if (empty($ids)) return [];

        $marks  = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge([$filters['companies_id']], $ids, [$filters['fi']]);

        $query = "
            SELECT
                mv.item_id,
                DATE(mv.occurred_at) AS dia,
                {$this->bucketSql} AS bucket,
                mv.movement_type     AS tipo,
                io.name              AS origen,
                sr.name              AS motivo,
                COUNT(*)             AS movimientos,
                SUM(mv.quantity)     AS cantidad
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}detail_inventory_inflow di
                ON mv.movement_type = 'ENTRADA'
                AND di.id = CAST(SUBSTRING(mv.movement_uid, 4) AS UNSIGNED)
            LEFT JOIN {$this->bd}inventory_inflow f  ON f.id  = di.inventory_inflow_id
            LEFT JOIN {$this->bd}inflow_origin    io ON io.id = f.inflow_origin_id
            LEFT JOIN {$this->bd}detail_inventory_shrinkage ds
                ON mv.movement_type = 'SALIDA'
                AND ds.id = CAST(SUBSTRING(mv.movement_uid, 4) AS UNSIGNED)
            LEFT JOIN {$this->bd}inventory_shrinkage s  ON s.id  = ds.inventory_shrinkage_id
            LEFT JOIN {$this->bd}shrinkage_reason    sr ON sr.id = s.shrinkage_reason_id
            WHERE mv.companies_id = ?
            AND mv.warehouse_id IN ({$marks})
            AND mv.occurred_at >= ?
            GROUP BY mv.item_id, dia, bucket, tipo, origen, motivo
            ORDER BY dia ASC
        ";

        $result = $this->_Read($query, $params);
        return is_array($result) ? $result : [];
    }

    // Conteos para la lista de periodos. Se agrupa tambien por producto para que el
    // ctrl cuente productos DISTINTOS por semana o mes, no la suma de cada dia. Usa
    // los mismos filtros de producto que el reporte para que la lista y la hoja cuadren.
    function getReporteCounts($filters) {
        $ids = $filters['warehouse_ids'];
        if (empty($ids)) return [];

        $marks  = implode(',', array_fill(0, count($ids), '?'));
        $params = array_merge(
            [$filters['companies_id'], $filters['companies_id']],
            $ids,
            [$filters['fi'], $filters['ff']]
        );

        $query = "
            SELECT
                DATE(mv.occurred_at) AS dia,
                mv.item_id,
                {$this->bucketSql} AS bucket,
                COUNT(*)             AS movimientos,
                SUM(mv.quantity)     AS cantidad
            FROM {$this->bd}inventory_movement mv
            INNER JOIN {$this->bd}item i ON i.id = mv.item_id AND i.companies_id = ? AND i.active = 1
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}detail_inventory_shrinkage ds
                ON mv.movement_type = 'SALIDA'
                AND ds.id = CAST(SUBSTRING(mv.movement_uid, 4) AS UNSIGNED)
            LEFT JOIN {$this->bd}inventory_shrinkage s  ON s.id  = ds.inventory_shrinkage_id
            LEFT JOIN {$this->bd}shrinkage_reason    sr ON sr.id = s.shrinkage_reason_id
            WHERE mv.companies_id = ?
            AND mv.warehouse_id IN ({$marks})
            AND mv.occurred_at >= ?
            AND mv.occurred_at < DATE_ADD(?, INTERVAL 1 DAY)
            AND COALESCE(ia.is_inventoriable, 1) = 1
        ";

        if (!empty($filters['category_id'])) {
            $query   .= ' AND i.category_id = ?';
            $params[] = $filters['category_id'];
        }

        if (!empty($filters['area_id'])) {
            $query   .= ' AND ia.warehouse_area_id = ?';
            $params[] = $filters['area_id'];
        }

        $query .= ' GROUP BY dia, mv.item_id, bucket';

        $result = $this->_Read($query, $params);
        return is_array($result) ? $result : [];
    }
}
