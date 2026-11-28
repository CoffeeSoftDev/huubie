<?php
/*  La parte de inventario de la ficha de un producto o de un insumo
    (fayxzvov_inventarios.product_inventory): dónde se guarda (área), mínimo,
    máximo, lote y caducidad y, en los insumos, su grupo y su proveedor habitual.

    Una sola regla para los tres lugares que la editan (propuesta B, 28/11/2026):
      - la ficha del Catálogo de venta   (catalogo/ctrl/core-catalogo.php)
      - la ficha del Catálogo de insumos (inventarios/ctrl/ctrl-insumos.php)
      - Stock › «Abrir ficha»            (inventarios/ctrl/ctrl-stock.php)

    La usa una clase que ya trae post(), flag(), selectOrNull(), fail() y must()
    (los core de Catálogo e Inventarios los tienen). Escribe con _CUD: dentro
    de transaction() un error lanza y revierte. Si la base de Inventarios no
    existe en el servidor, _Read devuelve vacío y la ficha sale sin áreas. */
trait FichaInventario {

    private function fichaDb() {
        return 'fayxzvov_inventarios.';
    }

    private function fichaRows($query, $data) {
        $rows = $this->_Read($query, $data);

        return is_array($rows) ? $rows : [];
    }

    // 12 · 2.5 · 1,250.125: sin ceros de más.
    private function fichaNum($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }

    // -- Opciones de la ficha --

    // Las áreas de los almacenes activos de la sucursal (el select «Dónde se guarda»).
    protected function fichaAreas($companyId, $branchId) {
        return array_map(function ($a) {
            return ['id' => (int) $a['id'], 'valor' => $a['valor'], 'warehouse_id' => (int) $a['warehouse_id']];
        }, $this->fichaRows("
            SELECT a.id, a.name AS valor, a.warehouse_id
            FROM {$this->fichaDb()}warehouse_area a
            INNER JOIN {$this->fichaDb()}warehouse w ON w.id = a.warehouse_id
            WHERE w.company_id = ?
                AND w.branch_id = ?
                AND w.active = 1
                AND a.active = 1
            ORDER BY a.sort_order, a.name
        ", [$companyId, $branchId]));
    }

    // Las unidades activas de la empresa: «KG · Kilo». $keepId: la que ya tenía, aunque esté de baja.
    protected function fichaUnits($companyId, $keepId = 0) {
        return array_map(function ($u) {
            return ['id' => (int) $u['id'], 'valor' => $u['code'] . ' · ' . $u['name']];
        }, $this->fichaRows("
            SELECT id, code, name
            FROM {$this->fichaDb()}unit
            WHERE company_id = ?
                AND (active = 1 OR id = ?)
            ORDER BY sort_order, name
        ", [$companyId, (int) $keepId]));
    }

    /*  Unidad y vida útil del producto (viven en fayxzvov_pos.product), validadas.
        Con 'status' es la respuesta de error. $keepUnit: la que ya tenía. $required:
        el insumo no se guarda sin unidad; el producto de venta sí («Sin unidad» = pieza). */
    protected function fichaProductInput($companyId, $keepUnit = 0, $required = false) {
        $unitId  = $this->selectOrNull('unit_id');
        $rawLife = trim($this->post('shelf_life_days'));

        if ($unitId === null && $required) return $this->fail(400, 'Elige la unidad en que se cuenta (kilo, litro, pieza...).');

        if ($unitId !== null && !in_array($unitId, array_column($this->fichaUnits($companyId, $keepUnit), 'id'), true)) {
            return $this->fail(400, 'La unidad elegida no existe o está dada de baja.');
        }

        if ($rawLife !== '' && (!preg_match('/^\d+$/', $rawLife) || (int) $rawLife > 3650)) {
            return $this->fail(400, 'La vida útil va de 0 a 3650 días.');
        }

        return ['unit_id' => $unitId, 'shelf_life_days' => $rawLife === '' ? null : (int) $rawLife];
    }

    // Los grupos de insumos de la empresa. $keepId: el que ya tenía, aunque esté de baja.
    protected function fichaGroups($companyId, $keepId = 0) {
        return array_map(function ($g) {
            return ['id' => (int) $g['id'], 'valor' => $g['valor']];
        }, $this->fichaRows("
            SELECT id, name AS valor
            FROM {$this->fichaDb()}supply_group
            WHERE company_id = ?
                AND (active = 1 OR id = ?)
            ORDER BY sort_order, name
        ", [$companyId, (int) $keepId]));
    }

    // Los proveedores que ve la sucursal (los de toda la empresa y los suyos).
    protected function fichaSuppliers($companyId, $branchId, $keepId = 0) {
        return array_map(function ($s) {
            return ['id' => (int) $s['id'], 'valor' => $s['valor']];
        }, $this->fichaRows("
            SELECT id, name AS valor
            FROM {$this->fichaDb()}supplier
            WHERE company_id = ?
                AND (branch_id IS NULL OR branch_id = ?)
                AND (active = 1 OR id = ?)
            ORDER BY name
        ", [$companyId, $branchId, (int) $keepId]));
    }

    // -- Leer --

    /*  Lo guardado, listo para el formulario. Sin fila: lo que trae un producto
        nuevo (lote y caducidad si tiene vida útil). En cero, el mínimo y el
        máximo van vacíos para que se lea el «0 = sin máximo» del campo. */
    protected function fichaRead($productId, $shelfLife = null) {
        $rows = $this->fichaRows("
            SELECT warehouse_area_id, stock_min, stock_max, track_lots, supply_group_id, supplier_id
            FROM {$this->fichaDb()}product_inventory
            WHERE product_id = ?
            LIMIT 1
        ", [(int) $productId]);

        $row   = $rows ? $rows[0] : null;
        $id    = function ($key) use ($row) { return $row && $row[$key] ? (int) $row[$key] : ''; };
        $value = function ($key) use ($row) { return $row && (float) $row[$key] > 0 ? (float) $row[$key] : ''; };

        return [
            'warehouse_area_id' => $id('warehouse_area_id'),
            'stock_min'         => $value('stock_min'),
            'stock_max'         => $value('stock_max'),
            'track_lots'        => $row ? (int) $row['track_lots'] : ((int) $shelfLife > 0 ? 1 : 0),
            'supply_group_id'   => $id('supply_group_id'),
            'supplier_id'       => $id('supplier_id')
        ];
    }

    // -- Validar --

    /*  Lo que llega del formulario, validado. Con 'status' es la respuesta de
        error. $areas: las que ofrece la sucursal (fichaAreas). $current: lo
        guardado (fichaRead): un área de otra sucursal no se ve en el select y
        sin esto se perdería al guardar. $supply: también grupo y proveedor. */
    protected function fichaInput(array $areas, array $current, $supply = false, $companyId = 0, $branchId = 0) {
        $rawMin = str_replace(',', '', $this->post('stock_min'));
        $rawMax = str_replace(',', '', $this->post('stock_max'));

        if (($rawMin !== '' && !is_numeric($rawMin)) || ($rawMax !== '' && !is_numeric($rawMax))) {
            return $this->fail(400, 'El mínimo y el máximo deben ser números.');
        }

        $min = $rawMin === '' ? 0 : round((float) $rawMin, 3);
        $max = $rawMax === '' ? 0 : round((float) $rawMax, 3);

        if ($min < 0 || $max < 0)    return $this->fail(400, 'El mínimo y el máximo no pueden ser negativos.');
        if ($max > 0 && $max < $min) return $this->fail(400, 'El máximo debe ser mayor que el mínimo (o 0 para no tener máximo).');

        $areaIds = array_column($areas, 'id');
        $area    = $this->selectOrNull('warehouse_area_id');

        if ($area !== null && !in_array($area, $areaIds, true)) {
            return $this->fail(400, 'Esa área no es de los almacenes de la sucursal.');
        }

        if ($area === null && $current['warehouse_area_id'] !== '' && !in_array($current['warehouse_area_id'], $areaIds, true)) {
            $area = $current['warehouse_area_id'];
        }

        $in = [
            'stock_min'         => $min,
            'stock_max'         => $max,
            'track_lots'        => $this->flag('track_lots'),
            'warehouse_area_id' => $area
        ];

        if (!$supply) return $in;

        $group    = $this->selectOrNull('supply_group_id');
        $supplier = $this->selectOrNull('supplier_id');

        if ($group !== null && !in_array($group, array_column($this->fichaGroups($companyId, (int) $current['supply_group_id']), 'id'), true)) {
            return $this->fail(400, 'Ese grupo de insumos no existe o está dado de baja.');
        }

        if ($supplier !== null && !in_array($supplier, array_column($this->fichaSuppliers($companyId, $branchId, (int) $current['supplier_id']), 'id'), true)) {
            return $this->fail(400, 'Ese proveedor no existe o está dado de baja.');
        }

        return $in + ['supply_group_id' => $group, 'supplier_id' => $supplier];
    }

    // -- Llevar inventario o no --

    // Lo que hay del producto en todos los almacenes de la empresa.
    protected function fichaStock($productId, $companyId) {
        $rows = $this->fichaRows("
            SELECT IFNULL(SUM(quantity), 0) AS quantity
            FROM {$this->fichaDb()}stock
            WHERE product_id = ?
                AND company_id = ?
                AND active = 1
        ", [(int) $productId, (int) $companyId]);

        return $rows ? (float) $rows[0]['quantity'] : 0.0;
    }

    /*  Por qué no se le puede quitar el inventario (o dar de baja el insumo);
        null = sí se puede. Con existencia se quedaría contada para siempre. */
    protected function fichaOffProblem($productId, $companyId, $name) {
        $qty = $this->fichaStock($productId, $companyId);

        if ($qty > 0.00001) {
            return "«{$name}» todavía tiene " . $this->fichaNum($qty) . ' en existencia: dale salida antes.';
        }

        if ($qty < -0.00001) {
            return "«{$name}» está en " . $this->fichaNum($qty) . ' (se vendió sin existencia): registra una entrada para dejarlo en 0 antes.';
        }

        return null;
    }

    // -- Guardar --

    // Inserta o actualiza la fila del producto. Dentro de transaction().
    protected function fichaSave($productId, $companyId, array $in) {
        $exists = $this->fichaRows("SELECT id FROM {$this->fichaDb()}product_inventory WHERE product_id = ? LIMIT 1", [(int) $productId]);

        if ($exists) {
            $sets = implode(', ', array_map(function ($key) { return "{$key} = ?"; }, array_keys($in)));

            return $this->must($this->_CUD(
                "UPDATE {$this->fichaDb()}product_inventory SET {$sets}, active = 1, updated_at = NOW() WHERE product_id = ?",
                array_merge(array_values($in), [(int) $productId])
            ), 'fichaSave/update');
        }

        $columns = array_merge(array_keys($in), ['company_id', 'product_id', 'active']);
        $marks   = implode(', ', array_fill(0, count($columns), '?'));

        return $this->must($this->_CUD(
            "INSERT INTO {$this->fichaDb()}product_inventory (" . implode(', ', $columns) . ") VALUES ({$marks})",
            array_merge(array_values($in), [(int) $companyId, (int) $productId, 1])
        ), 'fichaSave/insert');
    }
}
