<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';
require_once __DIR__ . '/inv-plantilla.php';

/*  Modelo de Inventarios.

    Tres bases en el mismo servidor:
      fayxzvov_app          (la del .env) empresas, sucursales y usuarios. Sin prefijo: $this->bd.
      fayxzvov_pos          el Catalogo: lo que se inventaria es el producto con
                            is_inventoriable = 1 (kind product = se vende; supply = insumo). $this->pos.
      fayxzvov_inventarios  almacenes, saldos, lotes y documentos. $this->inv.

    Catalogos del modulo con plantilla (unit, inflow_origin, outflow_reason,
    department...): company_id NULL = plantilla de Huubie; se leen junto con los
    de la empresa. */
class mdl extends CRUD {
    public $util;
    public $bd;
    public $pos;
    public $inv;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = '';
        $this->pos  = 'fayxzvov_pos.';
        $this->inv  = 'fayxzvov_inventarios.';
    }

    // -- Ayudantes --

    protected function qRows($query, $data = []) {
        $sql = $this->_Read($query, $data);
        return is_array($sql) ? $sql : [];
    }

    protected function qRow($query, $data = []) {
        $sql = $this->qRows($query, $data);
        return empty($sql) ? null : $sql[0];
    }

    protected function qCount($query, $data = []) {
        $row = $this->qRow($query, $data);
        return $row === null ? 0 : (int) reset($row);
    }

    protected function qIn(array $ids) {
        return implode(',', array_fill(0, count($ids), '?'));
    }

    protected function qInsertInv($table, $values, $data) {
        return $this->_Insert(['table' => $this->inv . $table, 'values' => $values, 'data' => $data]);
    }

    protected function qUpdateInv($table, $values, $where, $data) {
        return $this->_Update(['table' => $this->inv . $table, 'values' => $values, 'where' => $where, 'data' => $data]);
    }

    // Solo dentro de transaction(): fuera, _CUD ya cerro la conexion.
    public function qLastInsertId() {
        return (int) $this->mysql->lastInsertId();
    }

    // La fecha y la hora de MySQL: PHP puede correr en otra zona.
    public function qNow() {
        return $this->qRow("SELECT CURDATE() AS today, NOW() AS now") ?: ['today' => date('Y-m-d'), 'now' => date('Y-m-d H:i:s')];
    }

    // -- Empresa, sucursales y usuarios (fayxzvov_app) --

    public function qFirstCompany() {
        return $this->qRow("
            SELECT id, name
            FROM {$this->bd}companies
            ORDER BY (status = 'active') DESC, id
            LIMIT 1
        ");
    }

    public function qCompany($id) {
        return $this->qRow("SELECT id, name FROM {$this->bd}companies WHERE id = ? LIMIT 1", [$id]);
    }

    // La Matriz: la primera sucursal activa (la misma regla de Catalogo y Pedidos).
    public function qFirstBranch($companyId) {
        return $this->qRow("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE company_id = ?
                AND IFNULL(is_active, 1) = 1
            ORDER BY id
            LIMIT 1
        ", [$companyId]);
    }

    public function qBranch($id) {
        return $this->qRow("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE id = ?
                AND IFNULL(is_active, 1) = 1
            LIMIT 1
        ", [$id]);
    }

    // Las sucursales activas de la empresa (destinos de un traspaso).
    public function qBranches($companyId) {
        return $this->qRows("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE company_id = ?
                AND IFNULL(is_active, 1) = 1
            ORDER BY id
        ", [$companyId]);
    }

    public function qUserNames(array $ids) {
        if (!$ids) return [];

        $rows = $this->qRows("
            SELECT id, TRIM(CONCAT(IFNULL(name, ''), ' ', IFNULL(last_name, ''))) AS name
            FROM {$this->bd}users
            WHERE id IN ({$this->qIn($ids)})
        ", array_values($ids));

        return array_column($rows, 'name', 'id');
    }

    // La contraseña con la que entra (cancelar pide escribirla). '' = no tiene.
    public function qUserPassword($userId) {
        $row = $this->qRow("SELECT password FROM {$this->bd}users WHERE id = ? LIMIT 1", [$userId]);

        return $row ? (string) $row['password'] : '';
    }

    // -- Productos del Catalogo que llevan inventario --
    /*  Los de la sucursal y los de la Matriz que la sucursal no tiene con el mismo
        nombre (la regla de Catalogo y Pedidos). Solo is_inventoriable = 1 y solo
        product (se vende) y supply (insumo): servicios y paquetes no se cuentan. */

    // $all: sin mirar is_inventoriable (el Catálogo de insumos: un insumo lo lleva siempre).
    private function qVisibleProducts($all = false) {
        $inventoriable = $all ? '' : 'AND IFNULL(p.is_inventoriable, 0) = 1';

        return "
            p.company_id = ?
            AND IFNULL(p.is_custom, 0) = 0
            AND p.kind IN ('product', 'supply')
            AND IFNULL(p.active, 1) = 1
            {$inventoriable}
            AND (
                p.branch_id = ?
                OR (p.branch_id = ? AND NOT EXISTS (
                    SELECT 1
                    FROM {$this->pos}product t
                    WHERE t.company_id = p.company_id
                        AND t.branch_id = ?
                        AND t.id <> p.id
                        AND LOWER(TRIM(t.name)) = LOWER(TRIM(p.name))
                        AND IFNULL(t.is_custom, 0) = 0
                        AND IFNULL(t.active, 1) = 1
                ))
            )
        ";
    }

    public function qProducts($companyId, $branchId, $mainId) {
        return $this->qRows("
            SELECT
                p.id, p.name, p.sku, p.barcode, p.kind, p.image, p.unit_id, p.cost, p.price, p.shelf_life_days,
                p.branch_id, p.category_id,
                TRIM(c.name) AS category,
                u.code AS unit,
                IFNULL(u.allows_decimals, 0) AS decimals,
                IFNULL(pi.stock_min, 0) AS stock_min,
                IFNULL(pi.stock_max, 0) AS stock_max,
                IFNULL(pi.track_lots, 0) AS track_lots,
                IFNULL(pi.average_cost, 0) AS average_cost,
                pi.warehouse_area_id
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c          ON c.id = p.category_id
            LEFT JOIN {$this->inv}unit u              ON u.id = p.unit_id
            LEFT JOIN {$this->inv}product_inventory pi ON pi.product_id = p.id AND pi.active = 1
            WHERE {$this->qVisibleProducts()}
            ORDER BY p.name
        ", [$companyId, $branchId, $mainId, $branchId]);
    }

    public function qProduct($id, $companyId, $branchId, $mainId) {
        return $this->qRow("
            SELECT
                p.id, p.name, p.sku, p.kind, p.image, p.unit_id, p.cost, p.price, p.shelf_life_days, p.branch_id,
                TRIM(c.name) AS category,
                u.code AS unit,
                IFNULL(u.allows_decimals, 0) AS decimals,
                IFNULL(pi.stock_min, 0) AS stock_min,
                IFNULL(pi.stock_max, 0) AS stock_max,
                IFNULL(pi.track_lots, 0) AS track_lots,
                IFNULL(pi.average_cost, 0) AS average_cost
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c          ON c.id = p.category_id
            LEFT JOIN {$this->inv}unit u              ON u.id = p.unit_id
            LEFT JOIN {$this->inv}product_inventory pi ON pi.product_id = p.id AND pi.active = 1
            WHERE p.id = ? AND {$this->qVisibleProducts()}
            LIMIT 1
        ", [$id, $companyId, $branchId, $mainId, $branchId]);
    }

    // -- Productos de venta en el Catálogo de insumos (lleven inventario o no) --

    // Los que ve la sucursal: los suyos y los de la Matriz sin uno propio con el mismo nombre.
    public function qProductRows($companyId, $branchId, $mainId) {
        return $this->qRows("
            SELECT
                p.id, p.name, p.sku, p.image, p.unit_id, p.cost, p.price, p.shelf_life_days, p.branch_id, p.category_id,
                IFNULL(p.is_inventoriable, 0) AS is_inventoriable,
                TRIM(c.name) AS category,
                u.code AS unit,
                IFNULL(pi.stock_min, 0) AS stock_min,
                IFNULL(pi.stock_max, 0) AS stock_max,
                IFNULL(pi.track_lots, 0) AS track_lots,
                pi.warehouse_area_id
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c           ON c.id = p.category_id
            LEFT JOIN {$this->inv}unit u               ON u.id = p.unit_id
            LEFT JOIN {$this->inv}product_inventory pi ON pi.product_id = p.id AND pi.active = 1
            WHERE {$this->qVisibleProducts(true)} AND p.kind = 'product'
            ORDER BY p.name
        ", [$companyId, $branchId, $mainId, $branchId]);
    }

    // Un producto o insumo que ve la sucursal, lleve inventario o no (la ficha de inventario).
    public function qCatalogProduct($id, $companyId, $branchId, $mainId) {
        return $this->qRow("
            SELECT
                p.id, p.name, p.sku, p.kind, p.image, p.unit_id, p.cost, p.price, p.shelf_life_days, p.branch_id,
                IFNULL(p.is_inventoriable, 0) AS is_inventoriable,
                TRIM(c.name) AS category
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c ON c.id = p.category_id
            WHERE p.id = ? AND {$this->qVisibleProducts(true)}
            LIMIT 1
        ", [$id, $companyId, $branchId, $mainId, $branchId]);
    }

    // Otros con la misma foto (la copia de «Hacer propio» comparte la de la Matriz): no se borra del disco.
    public function qCountItemsWithImage($image, $exceptId) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->pos}product WHERE image = ? AND id <> ?", [$image, $exceptId]);
    }

    // -- Insumos (kind supply): el Catálogo de insumos --
    /*  Se compran y se cuentan, no se venden: viven en fayxzvov_pos.product
        con precio 0, sin POS ni tienda y siempre con inventario. Su grupo y su
        proveedor habitual están en product_inventory. */

    /*  Activos: los de la sucursal y los de la Matriz sin uno propio con el
        mismo nombre (qVisibleProducts). Dados de baja: solo los de la
        sucursal (uno de la Matriz se reactiva en la Matriz). */
    public function qSupplyRows($companyId, $branchId, $mainId, $active) {
        $select = "
            SELECT
                p.id, p.name, p.sku, p.image, p.unit_id, p.cost, p.shelf_life_days, p.branch_id,
                IFNULL(p.active, 1) AS active,
                u.code AS unit,
                IFNULL(pi.stock_min, 0) AS stock_min,
                IFNULL(pi.stock_max, 0) AS stock_max,
                IFNULL(pi.track_lots, 0) AS track_lots,
                pi.warehouse_area_id,
                pi.supply_group_id,
                g.name      AS supply_group,
                g.color_hex AS group_color
            FROM {$this->pos}product p
            LEFT JOIN {$this->inv}unit u               ON u.id = p.unit_id
            LEFT JOIN {$this->inv}product_inventory pi ON pi.product_id = p.id AND pi.active = 1
            LEFT JOIN {$this->inv}supply_group g       ON g.id = pi.supply_group_id
        ";

        if ($active === 1) {
            return $this->qRows($select . "
                WHERE {$this->qVisibleProducts(true)} AND p.kind = 'supply'
                ORDER BY p.name
            ", [$companyId, $branchId, $mainId, $branchId]);
        }

        return $this->qRows($select . "
            WHERE p.company_id = ?
                AND p.branch_id = ?
                AND p.kind = 'supply'
                AND IFNULL(p.is_custom, 0) = 0
                AND IFNULL(p.active, 1) = 0
            ORDER BY p.name
        ", [$companyId, $branchId]);
    }

    // Un insumo de la sucursal (activo o dado de baja): lo que la ficha deja cambiar.
    public function qSupply($id, $companyId, $branchId) {
        return $this->qRow("
            SELECT id, name, sku, description, image, unit_id, cost, shelf_life_days, branch_id, IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE id = ?
                AND company_id = ?
                AND branch_id = ?
                AND kind = 'supply'
                AND IFNULL(is_custom, 0) = 0
            LIMIT 1
        ", [$id, $companyId, $branchId]);
    }

    /*  Nombre y SKU no se repiten en la sucursal entre TODO lo del Catálogo
        (productos, servicios, paquetes e insumos): en las capturas se buscan
        por nombre. Devuelve kind para el mensaje. */
    public function qFindItemByName($companyId, $branchId, $name, $exceptId = 0) {
        return $this->qRow("
            SELECT id, name, kind, IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND TRIM(name) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $branchId, $name, $exceptId]);
    }

    public function qFindItemBySku($companyId, $branchId, $sku, $exceptId = 0) {
        return $this->qRow("
            SELECT id, name, kind, IFNULL(active, 1) AS active
            FROM {$this->pos}product
            WHERE company_id = ?
                AND branch_id = ?
                AND IFNULL(is_custom, 0) = 0
                AND TRIM(sku) = ?
                AND id <> ?
            LIMIT 1
        ", [$companyId, $branchId, $sku, $exceptId]);
    }

    public function qCreateItem($values, $data) {
        return $this->_Insert(['table' => $this->pos . 'product', 'values' => $values, 'data' => $data]);
    }

    public function qUpdateItem($values, $data) {
        return $this->_Update(['table' => $this->pos . 'product', 'values' => $values, 'where' => ['id'], 'data' => $data]);
    }

    // Grupos de insumos de la empresa, con cuántos insumos activos tiene cada uno.
    public function qGroupRows($companyId, $active) {
        return $this->qRows("
            SELECT g.*,
                   (SELECT COUNT(*)
                      FROM {$this->inv}product_inventory pi
                      INNER JOIN {$this->pos}product p ON p.id = pi.product_id
                     WHERE pi.supply_group_id = g.id
                       AND p.kind = 'supply'
                       AND IFNULL(p.active, 1) = 1) AS supplies
            FROM {$this->inv}supply_group g
            WHERE g.company_id = ? AND g.active = ?
            ORDER BY g.sort_order, g.name
        ", [$companyId, $active]);
    }

    // Cuántos activos hay en un catálogo de la empresa (el contador de la pestaña).
    public function qCountActive($table, $companyId) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->inv}{$table} WHERE company_id = ? AND active = 1", [$companyId]);
    }

    public function qProductSetting($productId) {
        return $this->qRow("SELECT * FROM {$this->inv}product_inventory WHERE product_id = ? LIMIT 1", [$productId]);
    }

    public function qCreateProductSetting($values, $data) {
        return $this->qInsertInv('product_inventory', $values, $data);
    }

    public function qUpdateProductSetting($values, $data) {
        return $this->qUpdateInv('product_inventory', $values, ['product_id'], $data);
    }

    // Ultimo costo: vive en el Catalogo (product.cost) y lo cambia la entrada de compra.
    public function qUpdateProductCost($productId, $cost) {
        return $this->_CUD("UPDATE {$this->pos}product SET cost = ?, updated_at = NOW() WHERE id = ?", [$cost, $productId]);
    }

    // Unidades de la empresa.
    public function qUnits($companyId) {
        return $this->qRows("
            SELECT id, code, name
            FROM {$this->inv}unit
            WHERE company_id = ? AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    public function qAreaOptions(array $warehouseIds) {
        if (!$warehouseIds) return [];

        return $this->qRows("
            SELECT id, name AS valor, warehouse_id
            FROM {$this->inv}warehouse_area
            WHERE warehouse_id IN ({$this->qIn($warehouseIds)})
                AND active = 1
            ORDER BY sort_order, name
        ", $warehouseIds);
    }

    // -- Almacenes --

    public function qWarehouses($companyId, $branchId = null) {
        $where = $branchId === null ? '' : 'AND w.branch_id = ?';
        $data  = $branchId === null ? [$companyId] : [$companyId, $branchId];

        return $this->qRows("
            SELECT w.id, w.name, w.branch_id, w.is_main, w.is_default, b.name AS branch
            FROM {$this->inv}warehouse w
            LEFT JOIN {$this->bd}branches b ON b.id = w.branch_id
            WHERE w.company_id = ?
                AND w.active = 1
                {$where}
            ORDER BY w.is_main DESC, w.is_default DESC, w.name
        ", $data);
    }

    public function qCountMainWarehouses($companyId) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->inv}warehouse WHERE company_id = ? AND is_main = 1 AND active = 1", [$companyId]);
    }

    public function qCreateWarehouse($values, $data) {
        return $this->qInsertInv('warehouse', $values, $data);
    }

    // -- Folios (folio_series): ENT-KAF-0001 --

    public function qBranchCodes($companyId) {
        return array_column($this->qRows("
            SELECT DISTINCT branch_id, branch_code
            FROM {$this->inv}folio_series
            WHERE company_id = ?
        ", [$companyId]), 'branch_code', 'branch_id');
    }

    // Dentro de la transaccion: bloquea la fila hasta el commit (dos capturas a la vez no repiten folio).
    public function qFolioForUpdate($branchId, $docType) {
        return $this->qRow("
            SELECT id, branch_code, last_number
            FROM {$this->inv}folio_series
            WHERE branch_id = ? AND doc_type = ?
            LIMIT 1
            FOR UPDATE
        ", [$branchId, $docType]);
    }

    public function qCreateFolio($values, $data) {
        return $this->qInsertInv('folio_series', $values, $data);
    }

    public function qBumpFolio($id) {
        return $this->_CUD("UPDATE {$this->inv}folio_series SET last_number = last_number + 1 WHERE id = ?", [$id]);
    }

    // -- Saldos --

    // Lo que hay de cada producto en esos almacenes, y cuándo se movió por última vez.
    public function qStockByProduct(array $warehouseIds) {
        if (!$warehouseIds) return [];

        return $this->qRows("
            SELECT product_id, SUM(quantity) AS quantity, MAX(last_movement_at) AS last_movement_at
            FROM {$this->inv}stock
            WHERE warehouse_id IN ({$this->qIn($warehouseIds)})
                AND active = 1
            GROUP BY product_id
        ", $warehouseIds);
    }

    // Saldo por almacén y producto (la captura de salidas enseña la existencia del elegido).
    public function qStockRows(array $warehouseIds) {
        if (!$warehouseIds) return [];

        return $this->qRows("
            SELECT product_id, warehouse_id, quantity
            FROM {$this->inv}stock
            WHERE warehouse_id IN ({$this->qIn($warehouseIds)})
                AND active = 1
        ", $warehouseIds);
    }

    // Lo que hay del producto en todos los almacenes de la empresa (costo promedio).
    public function qCompanyStock($productId, $companyId) {
        $row = $this->qRow("
            SELECT IFNULL(SUM(quantity), 0) AS quantity
            FROM {$this->inv}stock
            WHERE product_id = ? AND company_id = ? AND active = 1
        ", [$productId, $companyId]);

        return $row ? (float) $row['quantity'] : 0.0;
    }

    public function qStockRow($warehouseId, $productId, $lock = false) {
        return $this->qRow("
            SELECT id, quantity
            FROM {$this->inv}stock
            WHERE warehouse_id = ? AND product_id = ?
            LIMIT 1" . ($lock ? ' FOR UPDATE' : ''), [$warehouseId, $productId]);
    }

    public function qCreateStock($values, $data) {
        return $this->qInsertInv('stock', $values, $data);
    }

    public function qSetStock($id, $quantity) {
        return $this->_CUD("UPDATE {$this->inv}stock SET quantity = ?, last_movement_at = NOW() WHERE id = ?", [$quantity, $id]);
    }

    // -- Lotes --

    // El que vence primero de cada producto (Stock › columna Caducidad).
    public function qNextExpiry(array $warehouseIds) {
        if (!$warehouseIds) return [];

        return array_column($this->qRows("
            SELECT product_id, MIN(expires_at) AS expires_at
            FROM {$this->inv}stock_lot
            WHERE warehouse_id IN ({$this->qIn($warehouseIds)})
                AND quantity > 0
                AND expires_at IS NOT NULL
                AND active = 1
            GROUP BY product_id
        ", $warehouseIds), 'expires_at', 'product_id');
    }

    // Lotes vivos que vencen en $days días o menos (negativos = ya vencieron).
    public function qExpiringLots(array $warehouseIds, $days) {
        if (!$warehouseIds) return [];

        $data   = $warehouseIds;
        $window = '';

        if ($days !== null) {
            $window = 'AND l.expires_at <= DATE_ADD(CURDATE(), INTERVAL ? DAY)';
            $data[] = $days;
        }

        return $this->qRows("
            SELECT l.id, l.product_id, l.warehouse_id, l.batch_code, l.quantity, l.cost, l.produced_at, l.expires_at,
                   DATEDIFF(l.expires_at, CURDATE()) AS days_left,
                   w.name AS warehouse
            FROM {$this->inv}stock_lot l
            LEFT JOIN {$this->inv}warehouse w ON w.id = l.warehouse_id
            WHERE l.warehouse_id IN ({$this->qIn($warehouseIds)})
                AND l.quantity > 0
                AND l.expires_at IS NOT NULL
                AND l.active = 1
                {$window}
            ORDER BY l.expires_at, l.id
        ", $data);
    }

    // FIFO: primero el que vence antes; los que no caducan, al final. El resto viaja en un traspaso.
    public function qLotsForUpdate($warehouseId, $productId) {
        return $this->qRows("
            SELECT id, quantity, batch_code, cost, produced_at, expires_at
            FROM {$this->inv}stock_lot
            WHERE warehouse_id = ? AND product_id = ? AND quantity > 0 AND active = 1
            ORDER BY expires_at IS NULL, expires_at, id
            FOR UPDATE
        ", [$warehouseId, $productId]);
    }

    public function qLotOfDetail($detailId) {
        return $this->qRow("SELECT id, quantity FROM {$this->inv}stock_lot WHERE detail_inventory_inflow_id = ? LIMIT 1 FOR UPDATE", [$detailId]);
    }

    public function qCreateLot($values, $data) {
        return $this->qInsertInv('stock_lot', $values, $data);
    }

    public function qSetLot($id, $quantity) {
        return $this->_CUD("UPDATE {$this->inv}stock_lot SET quantity = ? WHERE id = ?", [$quantity, $id]);
    }

    public function qAddToLot($id, $quantity) {
        return $this->_CUD("UPDATE {$this->inv}stock_lot SET quantity = quantity + ? WHERE id = ?", [$quantity, $id]);
    }

    // -- Catalogos del modulo: los de la empresa --
    /*  Las filas con company_id NULL son la PLANTILLA de Huubie: nunca se
        listan. La primera vez que una empresa entra al módulo se le copian
        (qSeedCatalogs) y desde ahí cada empresa edita los suyos sin tocar a
        las demás (la regla de inventory/, 18/10/2026). Los flujos buscan por
        code dentro de la empresa. */

    // Copia la plantilla a la empresa en cada catálogo donde todavía no tenga nada (inv-plantilla.php).
    public function qSeedCatalogs($companyId) {
        InvPlantilla::seed($this, $this->inv, $companyId);
    }

    public function qOrigins($companyId) {
        return $this->qRows("
            SELECT id, code, name, description, icon, color_hex, requires_supplier, updates_cost, starts_pending, is_system, sort_order
            FROM {$this->inv}inflow_origin
            WHERE company_id = ? AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    public function qReasons($companyId) {
        return $this->qRows("
            SELECT id, code, name, description, icon, color_hex, is_loss, requires_evidence, requires_department, is_system
            FROM {$this->inv}outflow_reason
            WHERE company_id = ? AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    public function qDepartments($companyId) {
        return $this->qRows("
            SELECT id, name AS valor
            FROM {$this->inv}department
            WHERE company_id = ? AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    // -- Catálogo del módulo (la página Catálogo): listar, leer y guardar --

    // Filas de un catálogo de la empresa (activas o dadas de baja). $order: el ORDER BY.
    public function qCatalogRows($table, $companyId, $active, $order = 'sort_order, name') {
        return $this->qRows("
            SELECT *
            FROM {$this->inv}{$table}
            WHERE company_id = ? AND active = ?
            ORDER BY {$order}
        ", [$companyId, $active]);
    }

    public function qCatalogRow($table, $id, $companyId) {
        return $this->qRow("SELECT * FROM {$this->inv}{$table} WHERE id = ? AND company_id = ? LIMIT 1", [$id, $companyId]);
    }

    public function qCatalogInsert($table, $values, $data) {
        return $this->qInsertInv($table, $values, $data);
    }

    public function qCatalogUpdate($table, $values, $data) {
        return $this->qUpdateInv($table, $values, ['id'], $data);
    }

    // ¿Ya hay otro con ese valor en la empresa? (nombres y códigos no se repiten)
    public function qCatalogTaken($table, $column, $value, $companyId, $exceptId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->inv}{$table}
            WHERE company_id = ? AND LOWER(TRIM({$column})) = LOWER(TRIM(?)) AND id <> ?
        ", [$companyId, $value, $exceptId]) > 0;
    }

    public function qMaxSort($table, $companyId) {
        return $this->qCount("SELECT IFNULL(MAX(sort_order), 0) FROM {$this->inv}{$table} WHERE company_id = ?", [$companyId]);
    }

    // Almacenes de la empresa (todos o los de una sucursal), activos o dados de baja.
    public function qWarehouseRows($companyId, $active, $branchId = null) {
        $where = $branchId === null ? '' : 'AND w.branch_id = ?';
        $data  = $branchId === null ? [$companyId, $active] : [$companyId, $active, $branchId];

        return $this->qRows("
            SELECT w.*, b.name AS branch,
                   (SELECT IFNULL(SUM(s.quantity), 0) FROM {$this->inv}stock s WHERE s.warehouse_id = w.id AND s.active = 1) AS stock_units
            FROM {$this->inv}warehouse w
            LEFT JOIN {$this->bd}branches b ON b.id = w.branch_id
            WHERE w.company_id = ? AND w.active = ? {$where}
            ORDER BY w.is_main DESC, b.name, w.name
        ", $data);
    }

    // Uno solo por empresa (principal) o por sucursal (por defecto): apaga los demás.
    public function qClearWarehouseFlag($flag, $companyId, $branchId, $exceptId) {
        $where = $flag === 'is_default' ? 'AND branch_id = ?' : '';
        $data  = $flag === 'is_default' ? [$companyId, $branchId, $exceptId] : [$companyId, $exceptId];

        return $this->_CUD("UPDATE {$this->inv}warehouse SET {$flag} = 0 WHERE company_id = ? {$where} AND id <> ?", $data);
    }

    // Áreas de esos almacenes, con el nombre del almacén.
    public function qAreaRows(array $warehouseIds, $active) {
        if (!$warehouseIds) return [];

        return $this->qRows("
            SELECT a.*, w.name AS warehouse
            FROM {$this->inv}warehouse_area a
            INNER JOIN {$this->inv}warehouse w ON w.id = a.warehouse_id
            WHERE a.warehouse_id IN ({$this->qIn($warehouseIds)}) AND a.active = ?
            ORDER BY w.name, a.sort_order, a.name
        ", array_merge($warehouseIds, [$active]));
    }

    public function qAreaRow($id) {
        return $this->qRow("SELECT * FROM {$this->inv}warehouse_area WHERE id = ? LIMIT 1", [$id]);
    }

    public function qSupplierRows($companyId, $active) {
        return $this->qRows("
            SELECT *
            FROM {$this->inv}supplier
            WHERE company_id = ? AND active = ?
            ORDER BY name
        ", [$companyId, $active]);
    }

    // Productos del Catálogo (de la empresa) que usan cada unidad.
    public function qUnitUsage($companyId) {
        return array_column($this->qRows("
            SELECT unit_id, COUNT(*) AS n
            FROM {$this->pos}product
            WHERE company_id = ? AND unit_id IS NOT NULL AND IFNULL(active, 1) = 1
            GROUP BY unit_id
        ", [$companyId]), 'n', 'unit_id');
    }

    public function qSuppliers($companyId, $branchId) {
        return $this->qRows("
            SELECT id, name AS valor
            FROM {$this->inv}supplier
            WHERE company_id = ? AND (branch_id IS NULL OR branch_id = ?) AND active = 1
            ORDER BY name
        ", [$companyId, $branchId]);
    }

    public function qCreateSupplier($values, $data) {
        return $this->qInsertInv('supplier', $values, $data);
    }

    // -- Entradas --

    /*  $status: '' todos, 'active' sin canceladas, o pending / applied / cancelled.
        $originId null = todos los tipos. */
    public function qListInflows($companyId, $branchId, $from, $to, $originId, $status) {
        $where = '';
        $data  = [$companyId, $branchId, $from, $to];

        if ($originId !== null)   { $where .= ' AND i.inflow_origin_id = ?'; $data[] = $originId; }
        if ($status === 'active') { $where .= " AND i.status <> 'cancelled'"; }
        elseif ($status !== '')   { $where .= ' AND i.status = ?'; $data[] = $status; }

        return $this->qRows("
            SELECT i.*, o.name AS origin, o.code AS origin_code, o.icon AS origin_icon, o.color_hex AS origin_color,
                   w.name AS warehouse, a.name AS area, s.name AS supplier, b.name AS branch
            FROM {$this->inv}inventory_inflow i
            LEFT JOIN {$this->inv}inflow_origin o  ON o.id = i.inflow_origin_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = i.warehouse_id
            LEFT JOIN {$this->inv}warehouse_area a ON a.id = i.warehouse_area_id
            LEFT JOIN {$this->inv}supplier s       ON s.id = i.supplier_id
            LEFT JOIN {$this->bd}branches b        ON b.id = i.branch_id
            WHERE i.company_id = ? AND i.branch_id = ? AND i.active = 1
                AND i.operation_date BETWEEN ? AND ?
                {$where}
            ORDER BY i.operation_date DESC, i.id DESC
        ", $data);
    }

    // Lo que entró de cada producto en esas entradas (desglose de Costo y Unidades).
    public function qInflowProducts(array $inflowIds) {
        if (!$inflowIds) return [];

        return $this->qRows("
            SELECT d.product_id, p.name, p.sku, u.code AS unit,
                   SUM(d.quantity) AS units, SUM(d.subtotal) AS cost
            FROM {$this->inv}detail_inventory_inflow d
            LEFT JOIN {$this->pos}product p ON p.id = d.product_id
            LEFT JOIN {$this->inv}unit u    ON u.id = p.unit_id
            WHERE d.inventory_inflow_id IN ({$this->qIn($inflowIds)}) AND d.active = 1
            GROUP BY d.product_id, p.name, p.sku, u.code
        ", $inflowIds);
    }

    // -- Formatos de entrada (plantillas de lote) --
    // scope: user = quien lo guardó · subsidiary = su sucursal · company = toda la empresa.

    public function qFormats($companyId, $branchId, $userId) {
        return $this->qRows("
            SELECT id, name, scope
            FROM {$this->inv}inflow_format
            WHERE company_id = ? AND active = 1
                AND (scope = 'company'
                     OR (scope = 'subsidiary' AND branch_id = ?)
                     OR (scope = 'user' AND user_id = ?))
            ORDER BY name
        ", [$companyId, $branchId, $userId]);
    }

    public function qFormatItems(array $formatIds) {
        if (!$formatIds) return [];

        return $this->qRows("
            SELECT inflow_format_id, product_id, quantity
            FROM {$this->inv}inflow_format_item
            WHERE inflow_format_id IN ({$this->qIn($formatIds)}) AND active = 1
            ORDER BY sort_order, id
        ", $formatIds);
    }

    public function qCreateFormat($values, $data) {
        return $this->qInsertInv('inflow_format', $values, $data);
    }

    public function qCreateFormatItem($values, $data) {
        return $this->qInsertInv('inflow_format_item', $values, $data);
    }

    public function qGetFormat($id, $companyId) {
        return $this->qRow("SELECT id, user_id, scope FROM {$this->inv}inflow_format WHERE id = ? AND company_id = ? AND active = 1 LIMIT 1", [$id, $companyId]);
    }

    public function qDeleteFormat($id) {
        return $this->_CUD("UPDATE {$this->inv}inflow_format SET active = 0 WHERE id = ?", [$id]);
    }

    // Cantidad real de un renglón al confirmar la producción.
    public function qSetInflowLineQty($id, $quantity, $subtotal) {
        return $this->_CUD("UPDATE {$this->inv}detail_inventory_inflow SET quantity = ?, subtotal = ? WHERE id = ?", [$quantity, $subtotal, $id]);
    }

    public function qGetInflow($id, $companyId, $branchId, $lock = false) {
        return $this->qRow("
            SELECT i.*, o.name AS origin, o.code AS origin_code, o.icon AS origin_icon, o.color_hex AS origin_color,
                   o.updates_cost, IFNULL(o.is_system, 0) AS origin_system,
                   w.name AS warehouse, a.name AS area, s.name AS supplier, b.name AS branch
            FROM {$this->inv}inventory_inflow i
            LEFT JOIN {$this->inv}inflow_origin o  ON o.id = i.inflow_origin_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = i.warehouse_id
            LEFT JOIN {$this->inv}warehouse_area a ON a.id = i.warehouse_area_id
            LEFT JOIN {$this->inv}supplier s       ON s.id = i.supplier_id
            LEFT JOIN {$this->bd}branches b        ON b.id = i.branch_id
            WHERE i.id = ? AND i.company_id = ? AND i.branch_id = ? AND i.active = 1
            LIMIT 1" . ($lock ? ' FOR UPDATE' : ''), [$id, $companyId, $branchId]);
    }

    public function qInflowLines($inflowId) {
        return $this->qRows("
            SELECT d.*, p.name, p.sku, p.image, u.code AS unit, IFNULL(u.allows_decimals, 0) AS decimals
            FROM {$this->inv}detail_inventory_inflow d
            LEFT JOIN {$this->pos}product p ON p.id = d.product_id
            LEFT JOIN {$this->inv}unit u    ON u.id = p.unit_id
            WHERE d.inventory_inflow_id = ? AND d.active = 1
            ORDER BY d.id
        ", [$inflowId]);
    }

    public function qCreateInflow($values, $data) {
        return $this->qInsertInv('inventory_inflow', $values, $data);
    }

    public function qUpdateInflow($values, $data) {
        return $this->qUpdateInv('inventory_inflow', $values, ['id'], $data);
    }

    public function qCreateInflowLine($values, $data) {
        return $this->qInsertInv('detail_inventory_inflow', $values, $data);
    }

    // moved_at con microsegundos: el orden real de la cadena Antes → Quedó en el kárdex.
    public function qSetInflowLineStock($id, $previous, $resulting) {
        return $this->_CUD("UPDATE {$this->inv}detail_inventory_inflow SET previous_stock = ?, resulting_stock = ?, moved_at = NOW(6) WHERE id = ?", [$previous, $resulting, $id]);
    }

    // Antes y Quedó de la cancelación: el kárdex le suma un renglón «Cancelación».
    public function qSetInflowLineCancelStock($id, $previous, $resulting) {
        return $this->_CUD("UPDATE {$this->inv}detail_inventory_inflow SET cancel_previous_stock = ?, cancel_resulting_stock = ?, cancel_moved_at = NOW(6) WHERE id = ?", [$previous, $resulting, $id]);
    }

    // -- Salidas --

    // $status: '' todas, applied o cancelled. $reasonId null = todos los motivos.
    public function qListOutflows($companyId, $branchId, $from, $to, $reasonId, $status) {
        $where = '';
        $data  = [$companyId, $branchId, $from, $to];

        if ($reasonId !== null) { $where .= ' AND s.outflow_reason_id = ?'; $data[] = $reasonId; }
        if ($status !== '')     { $where .= ' AND s.status = ?';            $data[] = $status; }

        return $this->qRows("
            SELECT s.*, r.name AS reason, r.code AS reason_code, r.icon AS reason_icon, r.color_hex AS reason_color,
                   r.is_loss, r.is_system, w.name AS warehouse, d.name AS department, b.name AS branch
            FROM {$this->inv}inventory_outflow s
            LEFT JOIN {$this->inv}outflow_reason r ON r.id = s.outflow_reason_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = s.warehouse_id
            LEFT JOIN {$this->inv}department d     ON d.id = s.department_id
            LEFT JOIN {$this->bd}branches b        ON b.id = s.branch_id
            WHERE s.company_id = ? AND s.branch_id = ? AND s.active = 1
                AND s.sale_id IS NULL
                AND s.operation_date BETWEEN ? AND ?
                {$where}
            ORDER BY s.operation_date DESC, s.id DESC
        ", $data);
    }

    // Lo que salió de cada producto en esas salidas (desglose de Valor y Unidades).
    public function qOutflowProducts(array $outflowIds) {
        if (!$outflowIds) return [];

        return $this->qRows("
            SELECT d.product_id, p.name, p.sku, u.code AS unit,
                   SUM(d.quantity) AS units, SUM(d.subtotal) AS cost
            FROM {$this->inv}detail_inventory_outflow d
            LEFT JOIN {$this->pos}product p ON p.id = d.product_id
            LEFT JOIN {$this->inv}unit u    ON u.id = p.unit_id
            WHERE d.inventory_outflow_id IN ({$this->qIn($outflowIds)}) AND d.active = 1
            GROUP BY d.product_id, p.name, p.sku, u.code
        ", $outflowIds);
    }


    public function qGetOutflow($id, $companyId, $branchId, $lock = false) {
        return $this->qRow("
            SELECT s.*, r.name AS reason, r.code AS reason_code, r.icon AS reason_icon, r.color_hex AS reason_color,
                   r.is_loss, r.is_system, w.name AS warehouse, d.name AS department, b.name AS branch
            FROM {$this->inv}inventory_outflow s
            LEFT JOIN {$this->inv}outflow_reason r ON r.id = s.outflow_reason_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = s.warehouse_id
            LEFT JOIN {$this->inv}department d     ON d.id = s.department_id
            LEFT JOIN {$this->bd}branches b        ON b.id = s.branch_id
            WHERE s.id = ? AND s.company_id = ? AND s.branch_id = ? AND s.active = 1
            LIMIT 1" . ($lock ? ' FOR UPDATE' : ''), [$id, $companyId, $branchId]);
    }

    public function qOutflowLines($outflowId) {
        return $this->qRows("
            SELECT d.*, p.name, p.sku, p.image, u.code AS unit, l.batch_code, l.expires_at
            FROM {$this->inv}detail_inventory_outflow d
            LEFT JOIN {$this->pos}product p    ON p.id = d.product_id
            LEFT JOIN {$this->inv}unit u       ON u.id = p.unit_id
            LEFT JOIN {$this->inv}stock_lot l  ON l.id = d.stock_lot_id
            WHERE d.inventory_outflow_id = ? AND d.active = 1
            ORDER BY d.id
        ", [$outflowId]);
    }

    public function qCreateOutflow($values, $data) {
        return $this->qInsertInv('inventory_outflow', $values, $data);
    }

    public function qUpdateOutflow($values, $data) {
        return $this->qUpdateInv('inventory_outflow', $values, ['id'], $data);
    }

    // Con moved_at = NOW(6), que _Insert no sabe escribir: el renglón sale cuando mueve la existencia.
    public function qCreateOutflowLine($values, $data) {
        $cols  = implode(', ', $values);
        $marks = implode(', ', array_fill(0, count($values), '?'));

        return $this->_CUD("INSERT INTO {$this->inv}detail_inventory_outflow ({$cols}, moved_at) VALUES ({$marks}, NOW(6))", $data);
    }

    public function qSetOutflowLineCancelStock($id, $previous, $resulting) {
        return $this->_CUD("UPDATE {$this->inv}detail_inventory_outflow SET cancel_previous_stock = ?, cancel_resulting_stock = ?, cancel_moved_at = NOW(6) WHERE id = ?", [$previous, $resulting, $id]);
    }

    // -- Traspasos (folio TRA-KAF-0001) --
    /*  Solicitado (REQUESTED) no mueve nada. El destino lo recibe (RECEIVED):
        resta del origen y suma al destino a la vez. O lo rechaza (REJECTED); el
        origen lo puede cancelar (CANCELLED) mientras nadie lo recibe. */

    public function qTransferStatusId($code, $companyId) {
        $row = $this->qRow("
            SELECT id
            FROM {$this->inv}transfer_status
            WHERE code = ? AND company_id = ? AND active = 1
            LIMIT 1
        ", [$code, $companyId]);

        return $row ? (int) $row['id'] : 0;
    }

    private function transferSelect() {
        return "
            SELECT t.*,
                   s.code AS status_code, s.name AS status_name, s.name_out, s.name_in, s.color_hex AS status_color,
                   wo.name AS origin_warehouse, wd.name AS destination_warehouse,
                   bo.name AS origin_branch, bd.name AS destination_branch
            FROM {$this->inv}inventory_transfer t
            LEFT JOIN {$this->inv}transfer_status s ON s.id = t.transfer_status_id
            LEFT JOIN {$this->inv}warehouse wo      ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->inv}warehouse wd      ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bd}branches bo        ON bo.id = t.origin_branch_id
            LEFT JOIN {$this->bd}branches bd        ON bd.id = t.destination_branch_id
        ";
    }

    /*  Los traspasos donde la sucursal envía o recibe, como los ve ella
        (relative, el filtro de inventory):
          enviados     los envió y nadie los ha recibido
          por_recibir  se los mandan y esperan su recepción
          entregados   los envió y ya se recibieron
          recibidos    los recibió
          rechazados   rechazados o cancelados, de ida o de vuelta
        Los dos pendientes no llevan fechas (no se esconden). $destBranch
        null = cualquier destino. */
    public function qTransfersOf($companyId, $branchId, $from, $to, $relative, $destBranch) {
        $data  = [$companyId, $branchId, $branchId];
        $where = '';

        switch ($relative) {
            case 'enviados':    $where .= " AND t.origin_branch_id = ? AND s.code = 'REQUESTED'";      $data[] = $branchId; break;
            case 'por_recibir': $where .= " AND t.destination_branch_id = ? AND s.code = 'REQUESTED'"; $data[] = $branchId; break;
            case 'entregados':  $where .= " AND t.origin_branch_id = ? AND s.code = 'RECEIVED'";       $data[] = $branchId; break;
            case 'recibidos':   $where .= " AND t.destination_branch_id = ? AND s.code = 'RECEIVED'";  $data[] = $branchId; break;
            case 'rechazados':  $where .= " AND s.code IN ('REJECTED', 'CANCELLED')"; break;
        }

        if (!in_array($relative, ['enviados', 'por_recibir'], true)) {
            $where .= ' AND t.created_at >= ? AND t.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
            $data[] = $from;
            $data[] = $to;
        }

        if ($destBranch !== null) { $where .= ' AND t.destination_branch_id = ?'; $data[] = $destBranch; }

        return $this->qRows($this->transferSelect() . "
            WHERE t.company_id = ? AND (t.origin_branch_id = ? OR t.destination_branch_id = ?) AND t.active = 1
                {$where}
            ORDER BY t.created_at DESC, t.id DESC
        ", $data);
    }

    public function qGetTransfer($id, $companyId) {
        return $this->qRow($this->transferSelect() . "
            WHERE t.id = ? AND t.company_id = ? AND t.active = 1
            LIMIT 1
        ", [$id, $companyId]);
    }

    // Dentro de la transacción, antes de leerlo: dos personas no lo reciben a la vez.
    public function qLockTransfer($id) {
        return $this->qRow("SELECT id FROM {$this->inv}inventory_transfer WHERE id = ? LIMIT 1 FOR UPDATE", [$id]);
    }

    public function qTransferLines($transferId) {
        return $this->qRows("
            SELECT d.*, p.name, p.sku, p.image, u.code AS unit, IFNULL(u.allows_decimals, 0) AS decimals
            FROM {$this->inv}detail_inventory_transfer d
            LEFT JOIN {$this->pos}product p ON p.id = d.product_id
            LEFT JOIN {$this->inv}unit u    ON u.id = p.unit_id
            WHERE d.inventory_transfer_id = ? AND d.active = 1
            ORDER BY d.id
        ", [$transferId]);
    }

    public function qTransferHistory($transferId) {
        return $this->qRows("
            SELECT h.note, h.created_at, h.user_id, s.code, s.name, s.name_out, s.name_in, s.color_hex
            FROM {$this->inv}inventory_transfer_history h
            LEFT JOIN {$this->inv}transfer_status s ON s.id = h.transfer_status_id
            WHERE h.inventory_transfer_id = ? AND h.active = 1
            ORDER BY h.id
        ", [$transferId]);
    }

    public function qCreateTransfer($values, $data) {
        return $this->qInsertInv('inventory_transfer', $values, $data);
    }

    public function qUpdateTransfer($values, $data) {
        return $this->qUpdateInv('inventory_transfer', $values, ['id'], $data);
    }

    public function qCreateTransferLine($values, $data) {
        return $this->qInsertInv('detail_inventory_transfer', $values, $data);
    }

    public function qCreateTransferHistory($values, $data) {
        return $this->qInsertInv('inventory_transfer_history', $values, $data);
    }

    // Lo que llegó y el Antes → Quedó de los dos almacenes. moved_at ordena el kárdex.
    public function qSetTransferLineStock($id, $received, $originPrev, $originPost, $destPrev, $destPost) {
        return $this->_CUD("
            UPDATE {$this->inv}detail_inventory_transfer
            SET quantity_received = ?,
                origin_previous_stock = ?, origin_resulting_stock = ?,
                destination_previous_stock = ?, destination_resulting_stock = ?,
                moved_at = NOW(6)
            WHERE id = ?
        ", [$received, $originPrev, $originPost, $destPrev, $destPost, $id]);
    }

    // -- Requisiciones y Surtir (R4, folio REQ-CUA-0001) --
    /*  La sucursal (branch_id) le pide a otra (source_branch_id, casi siempre la
        Matriz). Borrador → En espera → Surtido parcialmente / Entregado →
        Confirmado; o Rechazada / Cancelada. Surtir saca del almacén de quien
        surte (una salida del sistema) y deja el surtimiento en
        requisition_supply; «Recibí» lo mete al almacén de quien pidió (una
        entrada del sistema) y lo liga al mismo surtimiento. */

    public function qRequisitionStatuses($companyId) {
        return $this->qRows("
            SELECT id, code, name, order_index, is_terminal, icon, color_hex
            FROM {$this->inv}requisition_status
            WHERE company_id = ? AND active = 1
            ORDER BY order_index, id
        ", [$companyId]);
    }

    public function qDepartmentOptions($companyId) {
        return $this->qRows("
            SELECT id, name, icon, color_hex
            FROM {$this->inv}department
            WHERE company_id = ? AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    // El motivo (outflow_reason) o el tipo (inflow_origin) de la empresa con ese código.
    public function qCatalogByCode($table, $code, $companyId) {
        return $this->qRow("
            SELECT *
            FROM {$this->inv}{$table}
            WHERE company_id = ? AND code = ?
            ORDER BY active DESC, id
            LIMIT 1
        ", [$companyId, $code]);
    }

    private function requisitionSelect() {
        return "
            SELECT r.*,
                   s.code AS status_code, s.name AS status_name, s.icon AS status_icon, s.color_hex AS status_color,
                   b.name AS branch, sb.name AS source_branch, w.name AS warehouse,
                   d.name AS department, d.icon AS department_icon, d.color_hex AS department_color,
                   (SELECT COUNT(*) FROM {$this->inv}detail_requisition x WHERE x.requisition_id = r.id AND x.active = 1) AS lines_count
            FROM {$this->inv}requisition r
            LEFT JOIN {$this->inv}requisition_status s ON s.id = r.requisition_status_id
            LEFT JOIN {$this->bd}branches b            ON b.id = r.branch_id
            LEFT JOIN {$this->bd}branches sb           ON sb.id = r.source_branch_id
            LEFT JOIN {$this->inv}warehouse w          ON w.id = r.warehouse_id
            LEFT JOIN {$this->inv}department d         ON d.id = r.department_id
        ";
    }

    /*  $side: 'pedidos' = las que pidió la sucursal; 'entregas' = las que le
        piden (sin borradores). $dateField: created_at (la lista) o needed_date
        (el calendario). $statusCode '' = todas. */
    public function qRequisitionsOf($companyId, $branchId, $side, $from, $to, $statusCode, $dateField = 'created_at') {
        $data  = [$companyId, $branchId];
        $where = $side === 'entregas' ? "r.source_branch_id = ? AND s.code <> 'BORRADOR'" : 'r.branch_id = ?';
        $field = $dateField === 'needed_date' ? 'r.needed_date' : 'r.created_at';

        if ($statusCode !== '') { $where .= ' AND s.code = ?'; $data[] = $statusCode; }

        $data[] = $from;
        $data[] = $to;

        return $this->qRows($this->requisitionSelect() . "
            WHERE r.company_id = ? AND r.active = 1 AND {$where}
                AND {$field} >= ? AND {$field} < DATE_ADD(?, INTERVAL 1 DAY)
            ORDER BY r.created_at DESC, r.id DESC
        ", $data);
    }

    public function qGetRequisition($id, $companyId) {
        return $this->qRow($this->requisitionSelect() . "
            WHERE r.id = ? AND r.company_id = ? AND r.active = 1
            LIMIT 1
        ", [$id, $companyId]);
    }

    // El comprobante público: solo por su llave.
    public function qRequisitionByToken($token) {
        return $this->qRow($this->requisitionSelect() . "
            WHERE r.share_token = ? AND r.active = 1
            LIMIT 1
        ", [$token]);
    }

    // Dentro de la transacción, antes de leerla: dos personas no la surten a la vez.
    public function qLockRequisition($id) {
        return $this->qRow("SELECT id FROM {$this->inv}requisition WHERE id = ? LIMIT 1 FOR UPDATE", [$id]);
    }

    public function qRequisitionLines($requisitionId) {
        return $this->qRows("
            SELECT d.*, p.name, p.sku, p.image, p.cost, TRIM(c.name) AS category,
                   IFNULL(ud.code, up.code) AS unit, IFNULL(up.allows_decimals, 0) AS decimals
            FROM {$this->inv}detail_requisition d
            LEFT JOIN {$this->pos}product p    ON p.id = d.product_id
            LEFT JOIN {$this->pos}category c   ON c.id = p.category_id
            LEFT JOIN {$this->inv}unit ud      ON ud.id = d.unit_id
            LEFT JOIN {$this->inv}unit up      ON up.id = p.unit_id
            WHERE d.requisition_id = ? AND d.active = 1
            ORDER BY d.id
        ", [$requisitionId]);
    }

    public function qCreateRequisition($values, $data) {
        return $this->qInsertInv('requisition', $values, $data);
    }

    public function qUpdateRequisition($values, $data) {
        return $this->qUpdateInv('requisition', $values, ['id'], $data);
    }

    public function qCreateRequisitionLine($values, $data) {
        return $this->qInsertInv('detail_requisition', $values, $data);
    }

    public function qSetRequisitionLineSupplied($id, $supplied) {
        return $this->_CUD("UPDATE {$this->inv}detail_requisition SET quantity_supplied = ? WHERE id = ?", [$supplied, $id]);
    }

    public function qDisableRequisitionLines($requisitionId) {
        return $this->_CUD("UPDATE {$this->inv}detail_requisition SET active = 0 WHERE requisition_id = ? AND active = 1", [$requisitionId]);
    }

    // Los surtimientos, con la salida que los sacó y la entrada del «Recibí».
    public function qRequisitionSupplies($requisitionId) {
        return $this->qRows("
            SELECT rs.*, w.name AS warehouse, o.folio AS outflow_folio, i.folio AS inflow_folio, i.created_at AS received_at
            FROM {$this->inv}requisition_supply rs
            LEFT JOIN {$this->inv}warehouse w         ON w.id = rs.warehouse_id
            LEFT JOIN {$this->inv}inventory_outflow o ON o.id = rs.inventory_outflow_id
            LEFT JOIN {$this->inv}inventory_inflow i  ON i.id = rs.inventory_inflow_id
            WHERE rs.requisition_id = ? AND rs.active = 1
            ORDER BY rs.id
        ", [$requisitionId]);
    }

    public function qCreateRequisitionSupply($values, $data) {
        return $this->qInsertInv('requisition_supply', $values, $data);
    }

    public function qUpdateRequisitionSupply($values, $data) {
        return $this->qUpdateInv('requisition_supply', $values, ['id'], $data);
    }

    // Una salida o entrada de otra sucursal (la de un surtimiento): sin el candado de la sucursal de la sesión.
    public function qOutflowById($id) {
        return $this->qRow("SELECT * FROM {$this->inv}inventory_outflow WHERE id = ? AND active = 1 LIMIT 1 FOR UPDATE", [$id]);
    }

    // -- Kardex (vista inventory_movement) --

    /*  Todos los movimientos del periodo en esos almacenes, del más nuevo al más
        viejo. type: ENTRADA, SALIDA, TRANSFERENCIA, AJUSTE, CANCELACION o ''. */
    public function qKardex($companyId, array $warehouseIds, $from, $to, $type, $productId, $limit) {
        if (!$warehouseIds) return [];

        $where = '';
        $data  = array_merge([$companyId], $warehouseIds, [$from, $to]);
        $limit = max(1, (int) $limit);

        if ($type !== '')      { $where .= ' AND m.movement_type = ?'; $data[] = $type; }
        if ($productId !== null) { $where .= ' AND m.product_id = ?';  $data[] = $productId; }

        return $this->qRows("
            SELECT m.movement_uid, m.movement_type, m.folio, m.concept, m.quantity, m.stock_prev, m.stock_post,
                   m.cost_unit, m.cost_total, m.occurred_at, m.user_id, m.product_id, m.warehouse_id,
                   w.name AS warehouse, p.name AS product, p.sku, u.code AS unit
            FROM {$this->inv}inventory_movement m
            LEFT JOIN {$this->inv}warehouse w ON w.id = m.warehouse_id
            LEFT JOIN {$this->pos}product p   ON p.id = m.product_id
            LEFT JOIN {$this->inv}unit u      ON u.id = p.unit_id
            WHERE m.company_id = ?
                AND m.warehouse_id IN ({$this->qIn($warehouseIds)})
                AND m.occurred_at >= ? AND m.occurred_at < DATE_ADD(?, INTERVAL 1 DAY)
                {$where}
            ORDER BY m.sort_at DESC, m.movement_uid DESC
            LIMIT {$limit}
        ", $data);
    }

    // El último movimiento de cada producto en esos almacenes: {product_id: [movement_type, occurred_at]}.
    public function qLastMoves(array $warehouseIds) {
        if (!$warehouseIds) return [];

        $in   = $this->qIn($warehouseIds);
        $rows = $this->qRows("
            SELECT m.product_id, m.movement_type, m.occurred_at
            FROM {$this->inv}inventory_movement m
            INNER JOIN (
                SELECT product_id, MAX(sort_at) AS last_at
                FROM {$this->inv}inventory_movement
                WHERE warehouse_id IN ({$in})
                GROUP BY product_id
            ) x ON x.product_id = m.product_id AND x.last_at = m.sort_at
            WHERE m.warehouse_id IN ({$in})
        ", array_merge($warehouseIds, $warehouseIds));

        $map = [];
        foreach ($rows as $r) $map[(int) $r['product_id']] = $r;

        return $map;
    }

    // Lo que hay del producto en cada almacén de la empresa, con su sucursal.
    public function qProductStock($productId, $companyId) {
        return $this->qRows("
            SELECT s.quantity, w.id AS warehouse_id, w.name AS warehouse, w.branch_id
            FROM {$this->inv}stock s
            INNER JOIN {$this->inv}warehouse w ON w.id = s.warehouse_id AND w.active = 1
            WHERE s.product_id = ? AND s.company_id = ? AND s.active = 1
            ORDER BY w.branch_id, w.name
        ", [$productId, $companyId]);
    }

    // Los movimientos del producto en la empresa, del más nuevo al más viejo, con su sucursal.
    public function qProductMoves($productId, $companyId, $limit = 40) {
        $limit = max(1, (int) $limit);

        return $this->qRows("
            SELECT m.movement_type, m.folio, m.concept, m.quantity, m.stock_prev, m.stock_post,
                   m.occurred_at, w.name AS warehouse, b.name AS branch
            FROM {$this->inv}inventory_movement m
            LEFT JOIN {$this->inv}warehouse w ON w.id = m.warehouse_id
            LEFT JOIN {$this->bd}branches b   ON b.id = m.branch_id
            WHERE m.product_id = ? AND m.company_id = ?
            ORDER BY m.sort_at DESC, m.movement_uid DESC
            LIMIT {$limit}
        ", [$productId, $companyId]);
    }

    // Entradas y salidas del producto por día, los últimos 14 días (el pronóstico de Stock).
    public function qDailyActivity($productId, $companyId) {
        return $this->qRows("
            SELECT DATE(m.occurred_at) AS dia,
                   SUM(CASE WHEN m.quantity > 0 THEN m.quantity ELSE 0 END)      AS entrada,
                   SUM(CASE WHEN m.quantity < 0 THEN ABS(m.quantity) ELSE 0 END) AS salida
            FROM {$this->inv}inventory_movement m
            WHERE m.product_id = ? AND m.company_id = ?
                AND m.occurred_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
            GROUP BY DATE(m.occurred_at)
            ORDER BY dia
        ", [$productId, $companyId]);
    }

    // -- Dashboard (R3): la bitácora de inventory, un renglón por documento --

    /*  Por documento (folio) en esos almacenes: quién, cuántos productos y
        unidades movió y a qué costo. $type '' = todos; $userId null = todos. */
    public function qMovementLog($companyId, array $warehouseIds, $from, $to, $type, $userId, $limit = 500) {
        if (!$warehouseIds) return [];

        $where = '';
        $data  = array_merge([$companyId], $warehouseIds, [$from, $to]);
        $limit = max(1, (int) $limit);

        if ($type !== '')     { $where .= ' AND m.movement_type = ?'; $data[] = $type; }
        if ($userId !== null) { $where .= ' AND m.user_id = ?';       $data[] = $userId; }

        return $this->qRows("
            SELECT m.movement_type, m.folio, m.warehouse_id, m.user_id,
                   MAX(m.occurred_at) AS occurred_at, MAX(m.sort_at) AS sort_at,
                   COUNT(DISTINCT m.product_id) AS productos,
                   SUM(m.quantity) AS unidades, SUM(ABS(m.cost_total)) AS costo,
                   w.name AS warehouse
            FROM {$this->inv}inventory_movement m
            LEFT JOIN {$this->inv}warehouse w ON w.id = m.warehouse_id
            WHERE m.company_id = ?
                AND m.warehouse_id IN ({$this->qIn($warehouseIds)})
                AND m.occurred_at >= ? AND m.occurred_at < DATE_ADD(?, INTERVAL 1 DAY)
                {$where}
            GROUP BY m.movement_type, m.folio, m.warehouse_id, m.user_id, w.name
            ORDER BY sort_at DESC, m.folio DESC
            LIMIT {$limit}
        ", $data);
    }

    // Los productos de un documento de la bitácora, en esos almacenes (un traspaso deja el lado de la sucursal).
    public function qMovementDetail($companyId, array $warehouseIds, $type, $folio) {
        if (!$warehouseIds) return [];

        return $this->qRows("
            SELECT m.quantity, m.stock_prev, m.stock_post, m.cost_unit, m.cost_total, m.note, m.concept,
                   m.occurred_at, m.user_id, w.name AS warehouse, p.name, p.sku, u.code AS unit
            FROM {$this->inv}inventory_movement m
            LEFT JOIN {$this->inv}warehouse w ON w.id = m.warehouse_id
            LEFT JOIN {$this->pos}product p   ON p.id = m.product_id
            LEFT JOIN {$this->inv}unit u      ON u.id = p.unit_id
            WHERE m.company_id = ?
                AND m.warehouse_id IN ({$this->qIn($warehouseIds)})
                AND m.movement_type = ? AND m.folio = ?
            ORDER BY p.name
        ", array_merge([$companyId], $warehouseIds, [$type, $folio]));
    }

    // Quienes han movido inventario en esos almacenes (el filtro de usuario).
    public function qMovementUserIds($companyId, array $warehouseIds) {
        if (!$warehouseIds) return [];

        return array_map('intval', array_column($this->qRows("
            SELECT DISTINCT m.user_id
            FROM {$this->inv}inventory_movement m
            WHERE m.company_id = ?
                AND m.warehouse_id IN ({$this->qIn($warehouseIds)})
                AND m.user_id IS NOT NULL
        ", array_merge([$companyId], $warehouseIds)), 'user_id'));
    }

    // -- Editar entradas y salidas (R2) --

    // El día del último conteo aplicado en cada almacén: antes de esa fecha no se captura ni se edita.
    public function qLastAdjustmentDates(array $warehouseIds) {
        if (!$warehouseIds) return [];

        return array_column($this->qRows("
            SELECT warehouse_id, MAX(DATE(applied_at)) AS day
            FROM {$this->inv}inventory_adjustment
            WHERE warehouse_id IN ({$this->qIn($warehouseIds)}) AND status = 'applied' AND active = 1
            GROUP BY warehouse_id
        ", $warehouseIds), 'day', 'warehouse_id');
    }

    // $table: detail_inventory_inflow / detail_inventory_outflow; $column: su llave al documento.
    public function qDisableLines($table, $column, $docId) {
        return $this->_CUD("UPDATE {$this->inv}{$table} SET active = 0 WHERE {$column} = ? AND active = 1", [$docId]);
    }

    // Cuándo movieron los renglones del documento: los nuevos se ponen en ese lugar del kárdex.
    public function qLinesMovedAt($table, $column, $docId) {
        $row = $this->qRow("SELECT MIN(moved_at) AS moved_at FROM {$this->inv}{$table} WHERE {$column} = ? AND active = 1", [$docId]);

        return $row ? $row['moved_at'] : null;
    }

    public function qSetLinesMovedAt($table, $column, $docId, $movedAt) {
        return $this->_CUD("UPDATE {$this->inv}{$table} SET moved_at = ? WHERE {$column} = ? AND active = 1", [$movedAt, $docId]);
    }

    // -- Conteos físicos (inventory_adjustment): draft -> applied | cancelled --

    public function qAdjustmentReason($companyId, $code) {
        return $this->qRow("
            SELECT id, name
            FROM {$this->inv}adjustment_reason
            WHERE company_id = ? AND code = ? AND active = 1
            LIMIT 1
        ", [$companyId, $code]);
    }

    // El conteo que sigue en borrador en ese almacén: se retoma en vez de abrir otro.
    public function qOpenCount($warehouseId, $companyId) {
        return $this->qRow("
            SELECT id
            FROM {$this->inv}inventory_adjustment
            WHERE warehouse_id = ? AND company_id = ? AND active = 1
                AND adjustment_type = 'fisico' AND status = 'draft'
            ORDER BY id DESC
            LIMIT 1
        ", [$warehouseId, $companyId]);
    }

    public function qCreateAdjustment($values, $data) {
        return $this->qInsertInv('inventory_adjustment', $values, $data);
    }

    public function qUpdateAdjustment($values, $data) {
        return $this->qUpdateInv('inventory_adjustment', $values, ['id'], $data);
    }

    /*  Un renglón por cada producto e insumo con inventario que ve la sucursal,
        con su último costo. Lo contado empieza vacío (sin contar). */
    public function qCreateAdjustmentLines($adjustmentId, $companyId, $branchId, $mainId) {
        return $this->_CUD("
            INSERT INTO {$this->inv}detail_inventory_adjustment (inventory_adjustment_id, product_id, cost, active)
            SELECT ?, p.id, IFNULL(p.cost, 0), 1
            FROM {$this->pos}product p
            WHERE {$this->qVisibleProducts()}
        ", [$adjustmentId, $companyId, $branchId, $mainId, $branchId]);
    }

    public function qAdjustment($id, $companyId) {
        return $this->qRow("
            SELECT r.*, w.name AS warehouse, b.name AS branch, a.name AS reason
            FROM {$this->inv}inventory_adjustment r
            LEFT JOIN {$this->inv}warehouse w          ON w.id = r.warehouse_id
            LEFT JOIN {$this->bd}branches b            ON b.id = r.branch_id
            LEFT JOIN {$this->inv}adjustment_reason a  ON a.id = r.adjustment_reason_id
            WHERE r.id = ? AND r.company_id = ? AND r.active = 1
            LIMIT 1
        ", [$id, $companyId]);
    }

    /*  Los renglones con lo que hay hoy en el almacén (stock_live) y el área
        donde se guarda cada producto, si es de ese almacén. Por área (sin área
        al final) y por nombre: el orden en que se recorre el almacén. */
    public function qAdjustmentLines($warehouseId, $adjustmentId) {
        return $this->qRows("
            SELECT d.id AS detail_id, d.product_id, d.system_quantity, d.physical_quantity, d.difference,
                   d.cost, d.cost_difference, d.previous_stock, d.resulting_stock, d.counted_at,
                   p.name, p.sku, p.kind, u.code AS unit,
                   wa.id AS area_id, wa.name AS area, wa.color_hex AS area_color,
                   IFNULL(st.quantity, 0) AS stock_live
            FROM {$this->inv}detail_inventory_adjustment d
            INNER JOIN {$this->pos}product p             ON p.id = d.product_id
            LEFT JOIN {$this->inv}unit u                 ON u.id = p.unit_id
            LEFT JOIN {$this->inv}product_inventory pi   ON pi.product_id = p.id AND pi.active = 1
            LEFT JOIN {$this->inv}warehouse_area wa      ON wa.id = pi.warehouse_area_id AND wa.warehouse_id = ? AND wa.active = 1
            LEFT JOIN {$this->inv}stock st               ON st.product_id = d.product_id AND st.warehouse_id = ? AND st.active = 1
            WHERE d.inventory_adjustment_id = ? AND d.active = 1
            ORDER BY wa.name IS NULL, wa.sort_order, wa.name, p.name
        ", [$warehouseId, $warehouseId, $adjustmentId]);
    }

    public function qSetAdjustmentLine($id, $system, $physical, $difference, $cost, $costDifference) {
        return $this->_CUD("
            UPDATE {$this->inv}detail_inventory_adjustment
            SET system_quantity = ?, physical_quantity = ?, difference = ?, cost = ?, cost_difference = ?, counted_at = NOW()
            WHERE id = ?
        ", [$system, $physical, $difference, $cost, $costDifference, $id]);
    }

    public function qClearAdjustmentLine($id) {
        return $this->_CUD("
            UPDATE {$this->inv}detail_inventory_adjustment
            SET system_quantity = 0, physical_quantity = NULL, difference = 0, cost_difference = 0, counted_at = NULL
            WHERE id = ?
        ", [$id]);
    }

    public function qSetAdjustmentLineStock($id, $previous, $resulting) {
        return $this->_CUD("UPDATE {$this->inv}detail_inventory_adjustment SET previous_stock = ?, resulting_stock = ? WHERE id = ?", [$previous, $resulting, $id]);
    }

    public function qAdjustmentTotals($id) {
        return $this->_CUD("
            UPDATE {$this->inv}inventory_adjustment r
            INNER JOIN (
                SELECT inventory_adjustment_id,
                       COUNT(*)                                                AS total_products,
                       SUM(physical_quantity IS NOT NULL)                      AS total_counted,
                       SUM(physical_quantity IS NOT NULL AND difference <> 0)  AS total_differences,
                       COALESCE(SUM(difference), 0)                            AS total_diff_units,
                       COALESCE(SUM(cost_difference), 0)                       AS total_diff_cost
                FROM {$this->inv}detail_inventory_adjustment
                WHERE inventory_adjustment_id = ? AND active = 1
                GROUP BY inventory_adjustment_id
            ) t ON t.inventory_adjustment_id = r.id
            SET r.total_products = t.total_products, r.total_counted = t.total_counted,
                r.total_differences = t.total_differences, r.total_diff_units = t.total_diff_units,
                r.total_diff_cost = t.total_diff_cost
            WHERE r.id = ?
        ", [$id, $id]);
    }

    // $status: '' todos, o draft / applied / cancelled.
    public function qListAdjustments($companyId, $branchId, $status) {
        $where = '';
        $data  = [$companyId, $branchId];

        if ($status !== '') {
            $where  = 'AND r.status = ?';
            $data[] = $status;
        }

        return $this->qRows("
            SELECT r.id, r.folio, r.status, r.operation_date, r.created_at, r.applied_at, r.total_products,
                   r.total_counted, r.total_differences, r.total_diff_cost, r.user_id, r.applied_user_id,
                   w.name AS warehouse
            FROM {$this->inv}inventory_adjustment r
            LEFT JOIN {$this->inv}warehouse w ON w.id = r.warehouse_id
            WHERE r.company_id = ? AND r.branch_id = ? AND r.active = 1 {$where}
            ORDER BY r.id DESC
        ", $data);
    }
}
