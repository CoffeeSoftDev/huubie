<?php

require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_inventory.";
    }

    // Selects para filtros / formularios

    function lsCategories() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    // Orden del Catálogo > Unidad (arrastre). sort_order: docs/sql/2026-10-02_unidad-orden.sql.
    function lsUnits() {
        $query = "
            SELECT id, code, name AS valor
            FROM {$this->bd}unit
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY sort_order ASC, name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT id, name AS valor, color_hex, description
            FROM {$this->bd}warehouse_area
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsProveedores() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}supplier
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsWarehouses() {
        $query = "
            SELECT w.id, CONCAT(w.name, IFNULL(CONCAT(' - ', b.name), '')) AS valor
            FROM {$this->bd}warehouse w
            LEFT JOIN fayxzvov_erp.branches b ON b.id = w.branch_id
            WHERE w.active = 1
            AND w.companies_id = ".$_SESSION['company_id']."
            ORDER BY b.name ASC, w.is_default DESC, w.name ASC
        ";
        return $this->_Read($query, []);
    }

    function getCompanyById($array) {
        $query = "
            SELECT name, rfc, ubication
            FROM fayxzvov_erp.companies
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    // Insumos (item + item_attribute + stock)

    function listMateriales($filters) {
        $query = "
            SELECT
                i.id,
                i.name,
                i.image,
                i.price,
                i.price_without_tax,
                i.tax,
                i.active,
                i.created_at,
                ia.sku,
                ia.cost_unit,
                ia.stock_min,
                ia.stock_max,
                ia.shelf_life_days,
                ia.description,
                ic.name AS categoria,
                u.code  AS unidad,
                wa.id   AS area_id,
                wa.name AS area,
                wa.color_hex AS area_color,
                COALESCE(st.qty, 0) AS quantity
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit           u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = ia.warehouse_area_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE i.companies_id = ".$_SESSION['company_id']."
        ";

        $params = [];

        if (!empty($filters['categoria'])) {
            $query .= " AND i.category_id = ?";
            $params[] = $filters['categoria'];
        }

        // Área (checklist del filtro): '' todas · '3,5,none' solo esas, 'none' = sin
        // área · '__none__' ninguna marcada, no sale nada.
        if (($filters['area'] ?? '') !== '') {
            $picked = explode(',', $filters['area']);
            $ids    = array_values(array_filter($picked, 'ctype_digit'));
            $or     = [];

            if ($ids) {
                $or[]   = "ia.warehouse_area_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")";
                $params = array_merge($params, $ids);
            }

            if (in_array('none', $picked, true)) $or[] = "ia.warehouse_area_id IS NULL";

            $query .= $or ? " AND (" . implode(' OR ', $or) . ")" : " AND 1 = 0";
        }

        if (isset($filters['estado']) && $filters['estado'] !== '') {
            $query .= " AND i.active = ?";
            $params[] = $filters['estado'];
        }

        // Por categoría y luego por nombre; los productos sin categoría van al final.
        $query .= " ORDER BY ic.name IS NULL, ic.name ASC, i.name ASC";

        return $this->_Read($query, $params);
    }

    // Formato de conteo: activos e inventariables, agrupados por área (donde se
    // cuentan) y los que no tienen área al final. La existencia es la del almacén
    // elegido, o la suma de todos.
    function listFormatoConteo($filters) {
        $stockWhere = '';
        $params     = [];

        if (!empty($filters['warehouse_id'])) {
            $stockWhere = ' AND warehouse_id = ?';
            $params[]   = $filters['warehouse_id'];
        }

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
                WHERE active = 1{$stockWhere}
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE i.companies_id = ".$_SESSION['company_id']."
            AND i.active = 1
            AND COALESCE(ia.is_inventoriable, 1) = 1
        ";

        if (!empty($filters['category_id'])) {
            $query .= " AND i.category_id = ?";
            $params[] = $filters['category_id'];
        }

        if (!empty($filters['area_id'])) {
            $query .= " AND ia.warehouse_area_id = ?";
            $params[] = $filters['area_id'];
        }

        $query .= " ORDER BY wa.name IS NULL, wa.name ASC, i.name ASC";

        return $this->_Read($query, $params);
    }

    function getMaterialById($id) {
        $query = "
            SELECT
                i.*,
                ia.id AS attribute_id,
                ia.sku,
                ia.description,
                ia.shelf_life_days,
                ia.cost_unit,
                COALESCE(ia.cost_tax, i.tax, 0) AS cost_tax,
                ia.is_inventoriable,
                ia.stock_min,
                ia.stock_max,
                ia.warehouse_area_id,
                ia.unit_id
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE i.id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    // Lo que amarra a un producto (FK RESTRICT): renglones de entradas, salidas,
    // ajustes, traspasos y órdenes, y su existencia en cualquier almacén.
    function getMaterialCounts($array) {
        $id = $array[0];

        $query = "
            SELECT
                (SELECT COUNT(*) FROM {$this->bd}detail_inventory_inflow     WHERE item_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}detail_inventory_shrinkage  WHERE item_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}detail_inventory_adjustment WHERE item_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}detail_inventory_transfer   WHERE item_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}detail_purchase_order       WHERE item_id = ?) AS movimientos,
                (SELECT COALESCE(SUM(ABS(quantity)), 0) FROM {$this->bd}stock WHERE item_id = ?) AS existencia
        ";
        $result = $this->_Read($query, [$id, $id, $id, $id, $id, $id]);
        return $result[0] ?? ['movimientos' => 0, 'existencia' => 0];
    }

    // Hijos primero: renglones de formatos de entrada, existencias en cero y atributo.
    function deleteMaterialById($array) {
        $this->_CUD("DELETE FROM {$this->bd}inflow_format_item WHERE item_id = ?", $array);
        $this->_CUD("DELETE FROM {$this->bd}stock WHERE item_id = ?", $array);
        $this->_CUD("DELETE FROM {$this->bd}item_attribute WHERE item_id = ?", $array);
        return $this->_CUD("DELETE FROM {$this->bd}item WHERE id = ?", $array);
    }

    function existsItemBySku($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}item_attribute
            WHERE sku = ? AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['count'] > 0;
    }

    function listMaterialNames($array) {
        // [companies_id, id que no se compara (el que se edita; 0 en un alta)]
        $query = "
            SELECT id, name, active
            FROM {$this->bd}item
            WHERE companies_id = ?
            AND id <> ?
        ";
        return $this->_Read($query, $array);
    }

    // Solo LLENA el SKU: si el producto ya tiene uno, no se toca.
    function updateItemAttributeSku($array) {
        // [sku, item_id]
        $query = "
            UPDATE {$this->bd}item_attribute
               SET sku = ?
             WHERE item_id = ?
               AND (sku IS NULL OR sku = '')
        ";
        return $this->_CUD($query, $array);
    }

    // Último consecutivo usado con un prefijo de SKU; 0 si el prefijo aún no tiene ninguno.
    function getSkuCounts($array) {
        // [posición donde empieza el consecutivo, companies_id, patrón del prefijo]
        $query = "
            SELECT COALESCE(MAX(CAST(SUBSTRING(sku, ?) AS UNSIGNED)), 0) AS last_consecutive
            FROM {$this->bd}item_attribute
            WHERE companies_id = ?
              AND sku REGEXP ?
        ";
        $result = $this->_Read($query, $array);
        return (int) ($result[0]['last_consecutive'] ?? 0);
    }

    function createMaterial($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}item",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function getMaxItemId() {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}item";
        $result = $this->_Read($query, []);
        return $result[0]['id'] ?? 0;
    }

    function createItemAttribute($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}item_attribute",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateMaterial($data) {
        return $this->_Update([
            'table'  => "{$this->bd}item",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    function updateItemAttribute($data) {
        return $this->_Update([
            'table'  => "{$this->bd}item_attribute",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Catálogos que toca el asistente IA (categoría, unidad, área, almacén, proveedor)

    // Lista blanca entidad -> tabla: el nombre de la tabla nunca sale de lo que
    // proponga el modelo ni de lo que mande el navegador.
    private function catalogTable($entity) {
        $tables = [
            'category'  => 'item_category',
            'unit'      => 'unit',
            'area'      => 'warehouse_area',
            'warehouse' => 'warehouse',
            'supplier'  => 'supplier'
        ];

        if (!isset($tables[$entity])) throw new Exception('Catálogo no permitido: ' . $entity);

        return $this->bd . $tables[$entity];
    }

    // Activos e inactivos: el asistente también reactiva.
    function listCatalog($entity) {
        $table = $this->catalogTable($entity);
        $query = "
            SELECT *
            FROM {$table}
            WHERE companies_id = ?
            ORDER BY name ASC
        ";
        return $this->_Read($query, [$_SESSION['company_id']]);
    }

    function createCatalog($entity, $data) {
        return $this->_Insert([
            'table'  => $this->catalogTable($entity),
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateCatalog($entity, $data) {
        return $this->_Update([
            'table'  => $this->catalogTable($entity),
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Almacén donde caen las áreas que da de alta el asistente: el de por defecto de la
    // sucursal y, si no hay, el primero activo de la empresa. Params: [companies_id, branch_id]
    function getDefaultWarehouseId($array) {
        $query = "
            SELECT id
            FROM {$this->bd}warehouse
            WHERE companies_id = ?
            ORDER BY active DESC, (branch_id = ? AND is_default = 1) DESC, is_default DESC, id ASC
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['id'] ?? null;
    }

    function getMaxCatalogId($entity) {
        $table  = $this->catalogTable($entity);
        $result = $this->_Read("SELECT MAX(id) AS id FROM {$table}", []);
        return (int) ($result[0]['id'] ?? 0);
    }

    function lsBranches() {
        $query = "
            SELECT id, name AS valor
            FROM fayxzvov_erp.branches
            WHERE company_id = ?
            AND is_active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, [$_SESSION['company_id']]);
    }

    // Vaciado de la empresa (solo Super Admin, desde CoffeeIA)

    // Mismo criterio que el menú: acceso/mdl/mdl-access.php::userIsSuperAdmin.
    function isSuperAdmin($array) {
        // [user_id, branch_id]
        $query = "
            SELECT 1
            FROM fayxzvov_erp.users_braches ub
            JOIN fayxzvov_erp.roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE ub.user_id = ? AND ub.branch_id = ?
                AND r.code = 'superadmin'
            LIMIT 1
        ";
        return !empty($this->_Read($query, $array));
    }

    // Lista blanca de tablas que se pueden vaciar. Los detalles no llevan
    // companies_id: se filtran por su encabezado [tabla padre, columna que los une].
    private function purgeTarget($table) {
        $targets = [
            'detail_inventory_inflow'      => ['inventory_inflow', 'inventory_inflow_id'],
            'inventory_inflow'             => null,
            'detail_inventory_shrinkage'   => ['inventory_shrinkage', 'inventory_shrinkage_id'],
            'inventory_shrinkage'          => null,
            'detail_inventory_adjustment'  => ['inventory_adjustment', 'inventory_adjustment_id'],
            'inventory_adjustment_history' => ['inventory_adjustment', 'inventory_adjustment_id'],
            'inventory_adjustment'         => null,
            'detail_inventory_transfer'    => ['inventory_transfer', 'inventory_transfer_id'],
            'inventory_transfer_history'   => ['inventory_transfer', 'inventory_transfer_id'],
            'inventory_transfer'           => null,
            'detail_purchase_order'        => ['purchase_order', 'purchase_order_id'],
            'purchase_order'               => null,
            'stock'                        => null,
            'inflow_format_item'           => ['inflow_format', 'inflow_format_id'],
            'inflow_format'                => null,
            'item_attribute'               => ['item', 'item_id'],
            'item'                         => null,
            'item_category'                => null,
            'warehouse_area'               => null,
            'supplier'                     => null
        ];

        if (!array_key_exists($table, $targets)) throw new Exception('Tabla no permitida: ' . $table);

        return $targets[$table];
    }

    function countPurge($table, $companies_id) {
        $via   = $this->purgeTarget($table);
        $query = $via === null
            ? "SELECT COUNT(*) AS n FROM {$this->bd}{$table} WHERE companies_id = ?"
            : "SELECT COUNT(*) AS n FROM {$this->bd}{$table} d JOIN {$this->bd}{$via[0]} h ON h.id = d.{$via[1]} WHERE h.companies_id = ?";

        $result = $this->_Read($query, [$companies_id]);
        return (int) ($result[0]['n'] ?? 0);
    }

    function purge($table, $companies_id) {
        $via = $this->purgeTarget($table);

        // Los almacenes se quedan: antes de borrar las áreas se sueltan de ellas.
        if ($table === 'warehouse_area') {
            $this->_CUD("UPDATE {$this->bd}warehouse SET warehouse_area_id = NULL WHERE companies_id = ?", [$companies_id]);
        }

        $query = $via === null
            ? "DELETE FROM {$this->bd}{$table} WHERE companies_id = ?"
            : "DELETE d FROM {$this->bd}{$table} d JOIN {$this->bd}{$via[0]} h ON h.id = d.{$via[1]} WHERE h.companies_id = ?";

        return $this->_CUD($query, [$companies_id]);
    }
}
