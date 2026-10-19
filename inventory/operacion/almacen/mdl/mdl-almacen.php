<?php

require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';
require_once __DIR__ . '/mdl-visibilidad.php';
require_once __DIR__ . '/mdl-folios.php';

class mdl extends CRUD {

    // Qué productos ve y edita la sucursal: los suyos y los de Matriz (solo verlos).
    use VisibilidadProductos;

    // Folio por sucursal: nextFolio (AJU-KAF-0001 al pasar un producto a presentación).
    use FolioSucursal;

    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_inventory.";
    }

    // Selects para filtros / formularios

    // Categorías, proveedores y almacenes: los de la sucursal; el administrador, todos.
    function lsCategories() {
        $query = "
            SELECT ic.id, ic.name AS valor
            FROM {$this->bd}item_category ic
            WHERE ic.active = 1
            AND ic.companies_id = ".$_SESSION['company_id']."
            {$this->filtroCatalogoSucursal('ic')}
            ORDER BY ic.name ASC
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

    // Cada sucursal ve las áreas de su almacén; Matriz y el dueño, todas.
    function lsAreas() {
        $query = "
            SELECT wa.id, wa.name AS valor, wa.color_hex, wa.description
            FROM {$this->bd}warehouse_area wa
            WHERE wa.active = 1
            AND wa.companies_id = ".$_SESSION['company_id']."
            {$this->filtroAreasVisibles('wa')}
            ORDER BY wa.name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsProveedores() {
        $query = "
            SELECT s.id, s.name AS valor
            FROM {$this->bd}supplier s
            WHERE s.active = 1
            AND s.companies_id = ".$_SESSION['company_id']."
            {$this->filtroCatalogoSucursal('s')}
            ORDER BY s.name ASC
        ";
        return $this->_Read($query, []);
    }

    // Producto que cambia de sucursal: sus presentaciones pierden el área que sea de un
    // almacén de otra sucursal. [item_id, branch_id nuevo]
    function quitarAreasAjenasPresentaciones($array) {
        $query = "
            UPDATE {$this->bd}item_presentation p
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = p.warehouse_area_id
            LEFT JOIN {$this->bd}warehouse w ON w.id = wa.warehouse_id
            SET p.warehouse_area_id = NULL
            WHERE p.item_id = ? AND p.warehouse_area_id IS NOT NULL AND (w.branch_id IS NULL OR w.branch_id <> ?)
        ";
        return $this->_CUD($query, $array);
    }

    // El select «Almacén» de «Nueva área».
    function lsWarehouses() {
        $query = "
            SELECT w.id, CONCAT(w.name, IFNULL(CONCAT(' - ', b.name), '')) AS valor
            FROM {$this->bd}warehouse w
            LEFT JOIN fayxzvov_erp.branches b ON b.id = w.branch_id
            WHERE w.active = 1
            AND w.companies_id = ".$_SESSION['company_id']."
            {$this->filtroCatalogoSucursal('w')}
            ORDER BY b.name ASC, w.is_default DESC, w.name ASC
        ";
        return $this->_Read($query, []);
    }

    // Productos activos para el select «producto base» de una presentación: su costo y
    // su unidad arman la equivalencia («1 reja 12 es 12 piezas de COCA COLA LATA»);
    // la categoría es lo que la presentación hereda (área y foto son suyas), y el stock
    // el que recibe cuando un producto pasa a ser presentación.
    function lsProductos() {
        $query = "
            SELECT
                i.id,
                i.name AS valor,
                i.category_id,
                ic.name AS categoria,
                wa.name AS area,
                ia.sku,
                ia.cost_unit,
                u.name AS unidad,
                COALESCE(st.qty, 0) AS stock
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = ia.warehouse_area_id
            LEFT JOIN {$this->bd}unit           u  ON u.id  = ia.unit_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE i.active = 1
            AND i.companies_id = ".$_SESSION['company_id']." {$this->filtroProductosEditables('i')}
            ORDER BY i.name ASC
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

    // `branch_id` en los filtros: el stock es solo de los almacenes de esa sucursal;
    // sin él (o vacío) es el de toda la empresa.
    function listMateriales($filters) {
        $sucursal = $this->stockDeSucursal($filters['branch_id'] ?? '');

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
                i.category_id,
                ic.name AS categoria,
                u.code  AS unidad,
                u.name  AS unidad_nombre,
                wa.id   AS area_id,
                wa.name AS area,
                wa.color_hex AS area_color,
                COALESCE(st.qty, 0) AS quantity,
                i.branch_id,
                b.name  AS sucursal
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id {$this->filtroCatalogoSucursal('ic')}
            LEFT JOIN {$this->bd}unit           u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = ia.warehouse_area_id {$this->filtroAreasCatalogo('wa')}
            LEFT JOIN fayxzvov_erp.branches     b  ON b.id  = i.branch_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1 {$sucursal}
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE i.companies_id = ".$_SESSION['company_id']." {$this->filtroProductosPropios('i')}
        ";

        $params = [];

        // Selector de sucursal del dueño: solo los productos de esa sucursal.
        if (($filters['propietario'] ?? '') !== '') {
            $query .= " AND i.branch_id = ?";
            $params[] = $filters['propietario'];
        }

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

        // Del último agregado al más viejo: el id sigue el orden de alta (created_at puede
        // venir igual o vacío en las cargas masivas).
        $query .= " ORDER BY i.id DESC";

        return $this->_Read($query, $params);
    }

    // Condición para la subconsulta de stock: solo los almacenes de la sucursal. El id va
    // como entero, así que puede ir en el texto de la consulta.
    private function stockDeSucursal($branchId) {
        if ($branchId === '' || $branchId === null) return '';

        return " AND warehouse_id IN (SELECT id FROM {$this->bd}warehouse WHERE branch_id = " . (int) $branchId . ")";
    }

    // Sucursales activas de la empresa: el dueño elige de cuál ver el stock en Productos.
    // La Matriz (sucursal del almacén principal) va primero.
    function lsSucursales($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor
            FROM fayxzvov_erp.branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY id IN (SELECT branch_id FROM {$this->bd}warehouse WHERE is_main = 1 AND active = 1) DESC, name ASC
        ";
        return $this->_Read($query, $array);
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

    // Presentaciones (item_presentation): el empaque de un producto que ya existe.
    // El producto base no tiene fila aquí.

    // Las presentaciones como filas de la tabla de Productos, con los mismos filtros:
    // la categoría es la de su base; el área y el estado, los suyos.
    function listPresentacionesTabla($filters) {
        $sucursal = $this->stockDeSucursal($filters['branch_id'] ?? '');

        $query = "
            SELECT
                p.id,
                p.name,
                p.sku,
                p.factor,
                p.image,
                p.cost_unit,
                p.active,
                p.created_at,
                pu.name      AS unidad_nombre,
                wa.id        AS area_id,
                wa.name      AS area,
                wa.color_hex AS area_color,
                i.name       AS base_name,
                i.branch_id  AS base_branch_id,
                ic.name      AS categoria,
                u.name       AS base_unit,
                COALESCE(st.qty, 0) AS base_stock
            FROM {$this->bd}item_presentation p
            INNER JOIN {$this->bd}item           i  ON i.id = p.item_id
            LEFT JOIN  {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN  {$this->bd}item_category  ic ON ic.id = i.category_id {$this->filtroCatalogoSucursal('ic')}
            LEFT JOIN  {$this->bd}unit           u  ON u.id = ia.unit_id
            LEFT JOIN  {$this->bd}unit           pu ON pu.id = p.unit_id
            LEFT JOIN  {$this->bd}warehouse_area wa ON wa.id = p.warehouse_area_id {$this->filtroAreasCatalogo('wa')}
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1 {$sucursal}
                GROUP BY item_id
            ) st ON st.item_id = p.item_id
            WHERE p.companies_id = ".$_SESSION['company_id']." {$this->filtroProductosPropios('i')}
        ";

        $params = [];

        // Selector de sucursal del dueño: las presentaciones de los productos de esa sucursal.
        if (($filters['propietario'] ?? '') !== '') {
            $query .= " AND i.branch_id = ?";
            $params[] = $filters['propietario'];
        }

        if (!empty($filters['categoria'])) {
            $query .= " AND i.category_id = ?";
            $params[] = $filters['categoria'];
        }

        // Mismo checklist de área que listMateriales, sobre el área de la presentación.
        if (($filters['area'] ?? '') !== '') {
            $picked = explode(',', $filters['area']);
            $ids    = array_values(array_filter($picked, 'ctype_digit'));
            $or     = [];

            if ($ids) {
                $or[]   = "p.warehouse_area_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")";
                $params = array_merge($params, $ids);
            }

            if (in_array('none', $picked, true)) $or[] = "p.warehouse_area_id IS NULL";

            $query .= $or ? " AND (" . implode(' OR ', $or) . ")" : " AND 1 = 0";
        }

        if (isset($filters['estado']) && $filters['estado'] !== '') {
            $query .= " AND p.active = ?";
            $params[] = $filters['estado'];
        }

        $query .= " ORDER BY p.id DESC";

        return $this->_Read($query, $params);
    }

    function listPresentaciones($array) {
        // [companies_id, item_id (0 = todas), item_id]
        $query = "
            SELECT
                p.id,
                p.item_id,
                p.name,
                p.sku,
                p.factor,
                p.unit_id,
                p.warehouse_area_id,
                p.image,
                p.cost_unit,
                p.active,
                wa.name       AS area,
                wa.color_hex  AS area_color,
                i.name        AS base_name,
                i.category_id AS base_category_id,
                ia.sku        AS base_sku,
                ia.cost_unit  AS base_cost,
                u.name        AS base_unit,
                COALESCE(st.qty, 0) AS base_stock
            FROM {$this->bd}item_presentation p
            INNER JOIN {$this->bd}item           i  ON i.id = p.item_id
            LEFT JOIN  {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN  {$this->bd}unit           u  ON u.id = ia.unit_id
            LEFT JOIN  {$this->bd}warehouse_area wa ON wa.id = p.warehouse_area_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1
                GROUP BY item_id
            ) st ON st.item_id = p.item_id
            WHERE p.companies_id = ?
            AND (? = 0 OR p.item_id = ?)
            ORDER BY p.item_id ASC, p.factor ASC, p.name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getPresentacionById($array) {
        // [id]
        $query = "
            SELECT *
            FROM {$this->bd}item_presentation
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    // Id de la presentación de ese producto que ya se llama así (sin importar
    // mayúsculas ni espacios de más); 0 si no hay. `except` = la que se edita.
    function existsPresentacionByName($array) {
        // [item_id, companies_id, name, except id]
        $query = "
            SELECT id
            FROM {$this->bd}item_presentation
            WHERE item_id = ?
            AND companies_id = ?
            AND LOWER(TRIM(name)) = LOWER(TRIM(?))
            AND id <> ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return (int) ($result[0]['id'] ?? 0);
    }

    function createPresentacion($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}item_presentation",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updatePresentacion($data) {
        return $this->_Update([
            'table'  => "{$this->bd}item_presentation",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    // Pasar un producto a presentación: su stock va al base con un ajuste AJU- ya
    // aplicado (tipo 'presentacion'), uno por almacén, como los del conteo físico
    // de Stock (mdl-stock), para que salga en el kárdex.

    // Los últimos 10 movimientos de un producto (la vista del kárdex): para CoffeeIA.
    function listMovimientosItem($array) {
        // [item_id, companies_id]
        $query = "
            SELECT movement_type, folio, quantity, stock_post, occurred_at
            FROM {$this->bd}inventory_movement
            WHERE item_id = ? AND companies_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        ";
        return $this->_Read($query, $array);
    }

    // Lo que tiene un producto en todo el almacén (con signo: puede ser negativo).
    function getMaterialStock($array) {
        // [item_id]
        $query = "
            SELECT COALESCE(SUM(quantity), 0) AS stock
            FROM {$this->bd}stock
            WHERE item_id = ? AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return (float) ($result[0]['stock'] ?? 0);
    }

    function listStockByItem($array) {
        // [item_id]
        $query = "
            SELECT s.id, s.warehouse_id, s.quantity, w.branch_id
            FROM {$this->bd}stock s
            INNER JOIN {$this->bd}warehouse w ON w.id = s.warehouse_id
            WHERE s.item_id = ? AND s.active = 1 AND s.quantity <> 0
            ORDER BY s.warehouse_id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getStockByItemWarehouse($array) {
        // [item_id, warehouse_id]
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createStock($array) {
        // [quantity, warehouse_id, item_id, companies_id]
        $query = "
            INSERT INTO {$this->bd}stock (quantity, last_movement_at, warehouse_id, item_id, companies_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateStock($array) {
        // [quantity, id]
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function getAdjustmentReasonByCode($array) {
        // [code]
        $query = "
            SELECT id
            FROM {$this->bd}adjustment_reason
            WHERE code = ? AND active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createAdjustment($array) {
        // [folio, note, adjustment_reason_id, registered_user_id, authorized_user_id, warehouse_id, branch_id, companies_id]
        $query = "
            INSERT INTO {$this->bd}inventory_adjustment
                (folio, note, adjustment_type, status, date_adjustment, time_adjustment, authorized_at,
                 adjustment_reason_id, registered_user_id, authorized_user_id, warehouse_id, branch_id, companies_id)
            VALUES (?, ?, 'presentacion', 'Aplicado', CURDATE(), CURTIME(), NOW(), ?, ?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function getAdjustmentByFolio($array) {
        // [folio, companies_id]
        $query = "
            SELECT id
            FROM {$this->bd}inventory_adjustment
            WHERE folio = ? AND companies_id = ?
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return (int) ($result[0]['id'] ?? 0);
    }

    function createAdjustmentDetail($array) {
        // [inventory_adjustment_id, item_id, system_quantity, physical_quantity, difference, cost, cost_diff, previous_stock, resulting_stock, note]
        $query = "
            INSERT INTO {$this->bd}detail_inventory_adjustment
                (inventory_adjustment_id, item_id, system_quantity, physical_quantity, difference,
                 cost, cost_diff, previous_stock, resulting_stock, note, counted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function updateAdjustmentTotals($array) {
        // [inventory_adjustment_id, inventory_adjustment_id]
        $query = "
            UPDATE {$this->bd}inventory_adjustment r
            INNER JOIN (
                SELECT
                    inventory_adjustment_id,
                    COUNT(*)                     AS total_products,
                    COUNT(*)                     AS total_counted,
                    SUM(difference <> 0)         AS total_differences,
                    COALESCE(SUM(difference), 0) AS total_diff_units,
                    COALESCE(SUM(cost_diff), 0)  AS total_diff_cost
                FROM {$this->bd}detail_inventory_adjustment
                WHERE inventory_adjustment_id = ? AND active = 1
                GROUP BY inventory_adjustment_id
            ) t ON t.inventory_adjustment_id = r.id
            SET r.total_products    = t.total_products,
                r.total_counted     = t.total_counted,
                r.total_differences = t.total_differences,
                r.total_diff_units  = t.total_diff_units,
                r.total_diff_cost   = t.total_diff_cost
            WHERE r.id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function createAdjustmentHistory($array) {
        // [status, note, user_id, inventory_adjustment_id]
        $query = "
            INSERT INTO {$this->bd}inventory_adjustment_history (status, note, user_id, inventory_adjustment_id)
            VALUES (?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    // Catálogos que toca el asistente IA (categoría, unidad, área, almacén, proveedor,
    // origen de entrada, motivo de salida y estado de traspaso)

    // Orígenes, motivos y estados de traspaso llevan code (la clave fija que busca el
    // flujo) y no tienen created_at. Son por empresa desde 2026-10-18_catalogos-por-empresa.sql.
    const CODE_CATALOGS = ['inflow', 'shrinkage', 'transfer_status'];

    // Lista blanca entidad -> tabla: el nombre de la tabla nunca sale de lo que
    // proponga el modelo ni de lo que mande el navegador.
    private function catalogTable($entity) {
        $tables = [
            'category'        => 'item_category',
            'unit'            => 'unit',
            'area'            => 'warehouse_area',
            'warehouse'       => 'warehouse',
            'supplier'        => 'supplier',
            'inflow'          => 'inflow_origin',
            'shrinkage'       => 'shrinkage_reason',
            'transfer_status' => 'transfer_status'
        ];

        if (!isset($tables[$entity])) throw new Exception('Catálogo no permitido: ' . $entity);

        return $this->bd . $tables[$entity];
    }

    // Activos e inactivos: el asistente también reactiva. Categorías, proveedores,
    // almacenes y áreas: los de la sucursal (el administrador, todos).
    function listCatalog($entity) {
        $table  = $this->catalogTable($entity);
        $filtro = '';

        if (in_array($entity, ['category', 'supplier', 'warehouse'], true)) $filtro = $this->filtroCatalogoSucursal('c');
        if ($entity === 'area') $filtro = $this->filtroAreasCatalogo('c');

        $query = "
            SELECT c.*
            FROM {$table} c
            WHERE c.companies_id = ? {$filtro}
            ORDER BY c.name ASC
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

    // Lugar al final de una lista que se ordena a mano (unidades, orígenes, motivos):
    // de 10 en 10, como el arrastre de su pestaña. Cada empresa lleva su propio orden.
    function getNextCatalogSort($entity, $companies_id) {
        $table  = $this->catalogTable($entity);
        $result = $this->_Read("SELECT COALESCE(MAX(sort_order), 0) AS total FROM {$table} WHERE companies_id = ?", [$companies_id]);

        return (int) ($result[0]['total'] ?? 0) + 10;
    }

    // El código de orígenes y motivos lo genera el servidor: se revisa contra activos e
    // inactivos de la empresa.
    function existsCatalogCode($entity, $code) {
        $table  = $this->catalogTable($entity);
        $result = $this->_Read("SELECT COUNT(*) AS total FROM {$table} WHERE code = ? AND companies_id = ?", [$code, $_SESSION['company_id']]);
        return (int) ($result[0]['total'] ?? 0);
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
        // [user_id]
        $query = "
            SELECT 1
            FROM fayxzvov_erp.users_braches ub
            JOIN fayxzvov_erp.roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE ub.user_id = ?
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
