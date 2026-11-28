<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Insumos del Catálogo de insumos: lo que se compra y se cuenta pero
    no se vende (harina, leche, domos). Viven en fayxzvov_pos.product con
    kind 'supply', precio 0, sin POS ni tienda y siempre con inventario.

    Ficha: identificación (foto, nombre, grupo, SKU), compra (unidad, último costo,
    proveedor habitual) e inventario (área, mínimo, máximo, vida útil, lotes).
    Lo de inventario lo guarda FichaInventario, la misma regla del Catálogo de
    venta y de Stock.

    En una sucursal que no es la Matriz también salen los de la Matriz: se ven
    y se cuentan aquí, pero se editan en la Matriz (como en el Catálogo de venta). */
class ctrl extends coreCatalogo {

    // El filtro de grupo.
    public function init() {
        $fail = $this->needShow();
        if ($fail) return $fail + ['groups' => []];

        return ['status' => 200, 'groups' => $this->fichaGroups($this->companyId())];
    }

    // Opciones de la ficha. keep_*: el grupo y el proveedor que ya tenía, aunque estén de baja.
    public function formOptions() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        return [
            'status'    => 200,
            'units'     => array_map(function ($u) {
                return ['id' => (int) $u['id'], 'valor' => $u['code'] . ' · ' . $u['name']];
            }, $this->qUnits($this->companyId())),
            'groups'    => $this->fichaGroups($this->companyId(), $this->postId('keep_group_id')),
            'suppliers' => $this->fichaSuppliers($this->companyId(), $this->branchId(), $this->postId('keep_supplier_id')),
            'areas'     => $this->fichaAreas($this->companyId(), $this->branchId()),
            'costs'     => $this->costs()
        ];
    }

    // Columnas: Insumo, Grupo, Unidad, [Último costo], Área, Stock, Mín, Máx, Lotes, Estado.
    public function lsInsumos() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $active = $this->activeFilter();
        $group  = $this->selectOrNull('group_id');
        $costs  = $this->costs();
        $areas  = array_column($this->areaList(), 'valor', 'id');
        $stock  = [];
        $row    = [];

        foreach ($this->qStockByProduct(array_map('intval', array_column($this->warehouses(), 'id'))) as $s) {
            $stock[(int) $s['product_id']] = (float) $s['quantity'];
        }

        foreach ($this->qSupplyRows($this->companyId(), $this->branchId(), $this->mainBranchId(), $active) as $s) {
            if ($group !== null && (int) $s['supply_group_id'] !== $group) continue;

            $id   = (int) $s['id'];
            $qty  = round($stock[$id] ?? 0, 4);
            $min  = (float) $s['stock_min'];
            $max  = (float) $s['stock_max'];
            $own  = (int) $s['branch_id'] === $this->branchId();
            $area = (int) $s['warehouse_area_id'];

            $item = [
                'id'     => $id,
                'Insumo' => $this->itemCell($s['name'], $s['image'], 'icon-cube', [$s['sku'], $own ? '' : 'De la Matriz']),
                'Grupo'  => $s['supply_group'] ? $this->badge($s['supply_group'], $s['group_color'] ?: '#64748B') : $this->dash(),
                'Unidad' => $s['unit'] ? h($s['unit']) : $this->dash()
            ];

            if ($costs) $item['Último costo'] = (float) $s['cost'] > 0 ? '$' . number_format((float) $s['cost'], 2) : $this->dash();

            $item += [
                'Área'   => $area && isset($areas[$area]) ? $this->chip($areas[$area], 'sky') : $this->dash(),
                'Stock'  => $this->stockCell($qty, $min),
                'Mín'    => $min > 0 ? h($this->num($min)) : $this->dash(),
                'Máx'    => $max > 0 ? h($this->num($max)) : $this->dash(),
                'Lotes'  => $this->yesNo($s['track_lots']),
                'Estado' => $this->activeCell($s['active']),
                'a'      => $own ? $this->rowActions('insumos', $id, $s['active']) : $this->noActions()
            ];

            $row[] = $item;
        }

        return $this->listed('insumos', $row);
    }

    public function getInsumo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $s = $this->qSupply($this->postId(), $this->companyId(), $this->branchId());
        if (!$s) return $this->fail(404, 'Ese insumo no es de esta sucursal.');

        return ['status' => 200, 'data' => $s + $this->fichaRead((int) $s['id'], $s['shelf_life_days'])];
    }

    public function addInsumo() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->supplyInput(0);
        if (isset($in['status'])) return $in;

        $ficha = $this->fichaInput($this->fichaAreas($this->companyId(), $this->branchId()), $this->fichaRead(0, $in['shelf_life_days']), true, $this->companyId(), $this->branchId());
        if (isset($ficha['status'])) return $ficha;

        $photo = $this->photoInput();
        if (isset($photo['status'])) return $photo;

        // La foto se nombra con el id: primero el insumo y luego la foto, todo o nada.
        return $this->attempt(function () use ($in, $ficha, $photo) {
            $this->transaction(function () use ($in, $ficha, $photo) {
                $this->must($this->qCreateItem(
                    ['name', 'description', 'sku', 'kind', 'unit_id', 'price', 'cost', 'shelf_life_days',
                     'is_custom', 'is_inventoriable', 'sell_pos', 'in_catalog', 'company_id', 'branch_id', 'active'],
                    [$in['name'], $in['description'], $in['sku'], 'supply', $in['unit_id'], 0, $in['cost'], $in['shelf_life_days'],
                     0, 1, 0, 0, $this->companyId(), $this->branchId(), 1]
                ), 'addInsumo');

                $id = $this->newId('addInsumo');

                $this->fichaSave($id, $this->companyId(), $ficha);

                if ($photo['b64'] !== '') $this->must($this->qUpdateItem(['image'], [$this->writePhoto($id, $photo['b64'], 'insumos'), $id]), 'addInsumo/image');
            });

            return $this->ok('Insumo dado de alta. Ya sale en Entradas, Salidas, Traspasos y Stock.');
        }, 'No se pudo guardar el insumo.');
    }

    public function editInsumo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qSupply($id, $this->companyId(), $this->branchId());

        if (!$current) return $this->fail(404, 'Ese insumo no es de esta sucursal.');

        $in = $this->supplyInput($id);
        if (isset($in['status'])) return $in;

        $ficha = $this->fichaInput($this->fichaAreas($this->companyId(), $this->branchId()), $this->fichaRead($id, $current['shelf_life_days']), true, $this->companyId(), $this->branchId());
        if (isset($ficha['status'])) return $ficha;

        $photo = $this->photoInput();
        if (isset($photo['status'])) return $photo;

        return $this->attempt(function () use ($id, $in, $ficha, $photo, $current) {
            $image = $this->transaction(function () use ($id, $in, $ficha, $photo, $current) {
                $image = $this->nextPhoto($id, $photo, $current['image'], 'insumos');

                $this->must($this->qUpdateItem(
                    ['name', 'description', 'image', 'sku', 'unit_id', 'cost', 'shelf_life_days', 'updated_at = NOW()'],
                    [$in['name'], $in['description'], $image, $in['sku'], $in['unit_id'], $in['cost'], $in['shelf_life_days'], $id]
                ), 'editInsumo');

                $this->fichaSave($id, $this->companyId(), $ficha);

                return $image;
            });

            if ($image !== $current['image']) $this->dropPhoto($current['image'], $id);

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el insumo.');
    }

    // Dar de baja pide existencia en 0: si no, quedaría contado y fuera de Stock.
    public function statusInsumo() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $s      = $this->qSupply($this->postId(), $this->companyId(), $this->branchId());
        $active = $this->flag('active');

        if (!$s) return $this->fail(404, 'Ese insumo no es de esta sucursal.');

        if ($active === 0) {
            $problem = $this->fichaOffProblem((int) $s['id'], $this->companyId(), $s['name']);
            if ($problem) return $this->fail(409, 'No se puede dar de baja: ' . $problem);
        }

        if ($active === 1) {
            $dup = $this->qFindItemByName($this->companyId(), $this->branchId(), trim($s['name']), (int) $s['id']);
            if ($dup && (int) $dup['active'] === 1) return $this->fail(409, "Ya hay otro activo que se llama «{$dup['name']}»: cámbiale el nombre a uno antes.");
        }

        return $this->attempt(function () use ($s, $active) {
            $this->must($this->qUpdateItem(['active', 'updated_at = NOW()'], [$active, (int) $s['id']]), 'statusInsumo');

            return $this->ok($active === 1 ? 'Insumo activado.' : 'Insumo dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el insumo.');
    }

    // -- Auxiliares --

    // Nombre, SKU, unidad, costo, vida útil y descripción, validados. Con 'status' es el error.
    private function supplyInput($exceptId) {
        $name = $this->requiredText('name', 'el nombre del insumo', 255);
        if (is_array($name)) return $name;

        $sku       = $this->post('sku') === '' ? null : mb_substr($this->post('sku'), 0, 80, 'UTF-8');
        $unitId    = $this->selectOrNull('unit_id');
        $rawCost   = str_replace(['$', ',', ' '], '', $this->post('cost'));
        $rawLife   = $this->post('shelf_life_days');
        $shelfLife = $rawLife === '' ? null : (int) $rawLife;

        if ($unitId === null || !in_array($unitId, array_map('intval', array_column($this->qUnits($this->companyId()), 'id')), true)) {
            return $this->fail(400, 'Elige la unidad en que se cuenta (kilo, litro, pieza...).');
        }

        if ($rawCost !== '' && (!is_numeric($rawCost) || (float) $rawCost < 0)) return $this->fail(400, 'El costo debe ser un número mayor o igual a 0.');
        if ($rawLife !== '' && (!preg_match('/^\d+$/', $rawLife) || $shelfLife > 3650)) return $this->fail(400, 'La vida útil va de 0 a 3650 días.');

        $dup = $this->qFindItemByName($this->companyId(), $this->branchId(), $name, $exceptId);
        if ($dup) return $this->fail(409, $this->takenText($dup, 'el nombre'));

        if ($sku !== null) {
            $dup = $this->qFindItemBySku($this->companyId(), $this->branchId(), $sku, $exceptId);
            if ($dup) return $this->fail(409, $this->takenText($dup, 'el SKU'));
        }

        // Sin «ver-costos» el campo no se ve ni viaja: se queda el que tenía (o 0 al darlo de alta).
        if ($this->costs()) {
            $cost = $rawCost === '' ? 0 : round((float) $rawCost, 4);
        } else {
            $current = $exceptId > 0 ? $this->qSupply($exceptId, $this->companyId(), $this->branchId()) : null;
            $cost    = $current ? (float) $current['cost'] : 0;
        }

        return [
            'name'            => $name,
            'sku'             => $sku,
            'unit_id'         => $unitId,
            'cost'            => $cost,
            'shelf_life_days' => $shelfLife,
            'description'     => $this->textOrNull('description', 1000)
        ];
    }

    // «Ya lo usa «Harina»» con dónde buscarlo.
    private function takenText($dup, $what) {
        $where = $dup['kind'] === 'supply' ? '' : ' en el Catálogo de venta';
        $off   = (int) $dup['active'] === 0 ? ' (está dado de baja)' : '';

        return ucfirst($what) . " ya lo usa «{$dup['name']}»{$where}{$off}.";
    }

}

Permission::dispatch(new ctrl(), 'inv-catalogo');
