<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

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

    private function qVisibleProducts() {
        return "
            p.company_id = ?
            AND IFNULL(p.is_custom, 0) = 0
            AND p.kind IN ('product', 'supply')
            AND IFNULL(p.active, 1) = 1
            AND IFNULL(p.is_inventoriable, 0) = 1
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
                IFNULL(pi.average_cost, 0) AS average_cost
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
                p.id, p.name, p.sku, p.kind, p.unit_id, p.cost, p.price, p.shelf_life_days, p.branch_id,
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

    public function qAreaOptions(array $warehouseIds) {
        if (!$warehouseIds) return [];

        return $this->qRows("
            SELECT id, name AS valor
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

    // FIFO: primero el que vence antes; los que no caducan, al final.
    public function qLotsForUpdate($warehouseId, $productId) {
        return $this->qRows("
            SELECT id, quantity
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

    // -- Catalogos del modulo (empresa + plantillas) --

    public function qOrigins($companyId) {
        return $this->qRows("
            SELECT id, code, name, description, icon, color_hex, requires_supplier, updates_cost, starts_pending, is_system
            FROM {$this->inv}inflow_origin
            WHERE (company_id = ? OR company_id IS NULL) AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    public function qReasons($companyId) {
        return $this->qRows("
            SELECT id, code, name, description, icon, color_hex, is_loss, requires_evidence, requires_department, is_system
            FROM {$this->inv}outflow_reason
            WHERE (company_id = ? OR company_id IS NULL) AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
    }

    public function qDepartments($companyId) {
        return $this->qRows("
            SELECT id, name AS valor
            FROM {$this->inv}department
            WHERE (company_id = ? OR company_id IS NULL) AND active = 1
            ORDER BY sort_order, name
        ", [$companyId]);
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

    public function qListInflows($companyId, $branchId, $from, $to, $originId, $status) {
        $where = '';
        $data  = [$companyId, $branchId, $from, $to];

        if ($originId !== null) { $where .= ' AND i.inflow_origin_id = ?'; $data[] = $originId; }
        if ($status !== '')     { $where .= ' AND i.status = ?';           $data[] = $status; }

        return $this->qRows("
            SELECT i.*, o.name AS origin, o.code AS origin_code, o.icon AS origin_icon, o.color_hex AS origin_color,
                   w.name AS warehouse, a.name AS area, s.name AS supplier
            FROM {$this->inv}inventory_inflow i
            LEFT JOIN {$this->inv}inflow_origin o  ON o.id = i.inflow_origin_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = i.warehouse_id
            LEFT JOIN {$this->inv}warehouse_area a ON a.id = i.warehouse_area_id
            LEFT JOIN {$this->inv}supplier s       ON s.id = i.supplier_id
            WHERE i.company_id = ? AND i.branch_id = ? AND i.active = 1
                AND i.operation_date BETWEEN ? AND ?
                {$where}
            ORDER BY i.operation_date DESC, i.id DESC
        ", $data);
    }

    public function qCountPendingInflows($companyId, $branchId) {
        return $this->qCount("
            SELECT COUNT(*) FROM {$this->inv}inventory_inflow
            WHERE company_id = ? AND branch_id = ? AND status = 'pending' AND active = 1
        ", [$companyId, $branchId]);
    }

    public function qGetInflow($id, $companyId, $branchId, $lock = false) {
        return $this->qRow("
            SELECT i.*, o.name AS origin, o.code AS origin_code, o.icon AS origin_icon, o.color_hex AS origin_color,
                   o.updates_cost, w.name AS warehouse, a.name AS area, s.name AS supplier
            FROM {$this->inv}inventory_inflow i
            LEFT JOIN {$this->inv}inflow_origin o  ON o.id = i.inflow_origin_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = i.warehouse_id
            LEFT JOIN {$this->inv}warehouse_area a ON a.id = i.warehouse_area_id
            LEFT JOIN {$this->inv}supplier s       ON s.id = i.supplier_id
            WHERE i.id = ? AND i.company_id = ? AND i.branch_id = ? AND i.active = 1
            LIMIT 1" . ($lock ? ' FOR UPDATE' : ''), [$id, $companyId, $branchId]);
    }

    public function qInflowLines($inflowId) {
        return $this->qRows("
            SELECT d.*, p.name, p.sku, u.code AS unit
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

    public function qListOutflows($companyId, $branchId, $from, $to, $reasonId, $lossOnly) {
        $where = '';
        $data  = [$companyId, $branchId, $from, $to];

        if ($reasonId !== null) { $where .= ' AND s.outflow_reason_id = ?'; $data[] = $reasonId; }
        if ($lossOnly)          { $where .= ' AND r.is_loss = 1'; }

        return $this->qRows("
            SELECT s.*, r.name AS reason, r.code AS reason_code, r.icon AS reason_icon, r.color_hex AS reason_color,
                   r.is_loss, r.is_system, w.name AS warehouse, d.name AS department
            FROM {$this->inv}inventory_outflow s
            LEFT JOIN {$this->inv}outflow_reason r ON r.id = s.outflow_reason_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = s.warehouse_id
            LEFT JOIN {$this->inv}department d     ON d.id = s.department_id
            WHERE s.company_id = ? AND s.branch_id = ? AND s.active = 1
                AND s.operation_date BETWEEN ? AND ?
                {$where}
            ORDER BY s.operation_date DESC, s.id DESC
        ", $data);
    }

    public function qCountLossMonth($companyId, $branchId) {
        return $this->qCount("
            SELECT COUNT(*) FROM {$this->inv}inventory_outflow s
            INNER JOIN {$this->inv}outflow_reason r ON r.id = s.outflow_reason_id AND r.is_loss = 1
            WHERE s.company_id = ? AND s.branch_id = ? AND s.status = 'applied' AND s.active = 1
                AND s.operation_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ", [$companyId, $branchId]);
    }

    public function qGetOutflow($id, $companyId, $branchId, $lock = false) {
        return $this->qRow("
            SELECT s.*, r.name AS reason, r.code AS reason_code, r.icon AS reason_icon, r.color_hex AS reason_color,
                   r.is_loss, r.is_system, w.name AS warehouse, d.name AS department
            FROM {$this->inv}inventory_outflow s
            LEFT JOIN {$this->inv}outflow_reason r ON r.id = s.outflow_reason_id
            LEFT JOIN {$this->inv}warehouse w      ON w.id = s.warehouse_id
            LEFT JOIN {$this->inv}department d     ON d.id = s.department_id
            WHERE s.id = ? AND s.company_id = ? AND s.branch_id = ? AND s.active = 1
            LIMIT 1" . ($lock ? ' FOR UPDATE' : ''), [$id, $companyId, $branchId]);
    }

    public function qOutflowLines($outflowId) {
        return $this->qRows("
            SELECT d.*, p.name, p.sku, u.code AS unit, l.batch_code
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

    // -- Kardex (vista inventory_movement) --

    public function qMoves($productId, array $warehouseIds, $limit = 60) {
        if (!$warehouseIds) return [];

        $data  = array_merge([$productId], $warehouseIds);
        $limit = max(1, (int) $limit);   // en el texto: con placeholder, MySQL recibiría LIMIT '60'

        return $this->qRows("
            SELECT m.movement_type, m.folio, m.concept, m.quantity, m.stock_prev, m.stock_post,
                   m.cost_unit, m.cost_total, m.occurred_at, m.user_id, w.name AS warehouse
            FROM {$this->inv}inventory_movement m
            LEFT JOIN {$this->inv}warehouse w ON w.id = m.warehouse_id
            WHERE m.product_id = ?
                AND m.warehouse_id IN ({$this->qIn($warehouseIds)})
            ORDER BY m.sort_at DESC, m.movement_uid DESC
            LIMIT {$limit}
        ", $data);
    }
}
