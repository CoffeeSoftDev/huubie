<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Productos del Catálogo de insumos: los productos del Catálogo de
    venta que ve la sucursal, lleven inventario o no, con su foto. Aquí se
    enciende «Inventario» y se edita su ficha de inventario (unidad, vida
    útil, área, mínimo, máximo y lotes): la misma ficha de Stock › «Abrir
    ficha» (fichaResponse en core-inventarios). Nombre, precio y categoría se
    cambian en el Catálogo de venta.

    Los de la Matriz, en otra sucursal: «Inventario», unidad y vida útil se
    cambian en la Matriz; área, mínimo, máximo y lotes sí desde aquí. */
class ctrl extends coreCatalogo {

    // Los filtros: categorías de los productos que ve la sucursal y las áreas de sus almacenes.
    public function init() {
        $fail = $this->needShow();
        if ($fail) return $fail + ['categorias' => [], 'areas' => []];

        $names = [];

        foreach ($this->rows() as $p) {
            if ($p['category_id']) $names[(int) $p['category_id']] = trim((string) $p['category']);
        }

        asort($names, SORT_NATURAL | SORT_FLAG_CASE);

        $categorias = [];
        foreach ($names as $id => $name) $categorias[] = ['id' => $id, 'valor' => $name];

        return [
            'status'     => 200,
            'categorias' => $categorias,
            'areas'      => $this->fichaAreas($this->companyId(), $this->branchId())
        ];
    }

    /*  Columnas: Producto, Categoría, Inventario, Unidad, Área, [Último costo],
        Stock, Mín, Máx, Lotes. Filtros: inventory ('' / '1' / '0'),
        category_id, area_id. */
    public function lsProductos() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $inventory = in_array($this->post('inventory'), ['0', '1'], true) ? (int) $this->post('inventory') : null;
        $category  = $this->selectOrNull('category_id');
        $area      = $this->selectOrNull('area_id');
        $costs     = $this->costs();
        $edit      = $this->can('update');
        $areas     = array_column($this->areaList(), 'valor', 'id');
        $stock     = [];
        $row       = [];

        foreach ($this->qStockByProduct(array_map('intval', array_column($this->warehouses(), 'id'))) as $s) {
            $stock[(int) $s['product_id']] = (float) $s['quantity'];
        }

        foreach ($this->rows() as $p) {
            $on = (int) $p['is_inventoriable'] === 1;

            if ($inventory !== null && (int) $on !== $inventory) continue;
            if ($category !== null && (int) $p['category_id'] !== $category) continue;
            if ($area !== null && (int) $p['warehouse_area_id'] !== $area) continue;

            $id   = (int) $p['id'];
            $own  = (int) $p['branch_id'] === $this->branchId();
            $min  = (float) $p['stock_min'];
            $max  = (float) $p['stock_max'];
            $wa   = (int) $p['warehouse_area_id'];
            $qty  = round($stock[$id] ?? 0, 4);

            $item = [
                'id'         => $id,
                'Producto'   => $this->itemCell($p['name'], $p['image'], 'icon-birthday', [$p['sku'], $own ? '' : 'De la Matriz']),
                'Categoría'  => trim((string) $p['category']) !== '' ? h(trim($p['category'])) : $this->dash(),
                'Inventario' => $this->trackCell($id, $on, $own && $edit, $own),
                'Unidad'     => $p['unit'] ? h($p['unit']) : $this->dash(),
                'Área'       => $wa && isset($areas[$wa]) ? $this->chip($areas[$wa], 'sky') : $this->dash()
            ];

            if ($costs) $item['Último costo'] = (float) $p['cost'] > 0 ? '$' . number_format((float) $p['cost'], 2) : $this->dash();

            $item += [
                'Stock' => $on ? $this->stockCell($qty, $min) : $this->dash(),
                'Mín'   => $min > 0 ? h($this->num($min)) : $this->dash(),
                'Máx'   => $max > 0 ? h($this->num($max)) : $this->dash(),
                'Lotes' => $this->yesNo($p['track_lots']),
                'a'     => $edit ? [[
                    'class'      => $this->actionBtnClass(),
                    'html'       => $this->lucideSvg('pencil'),
                    'aria-label' => 'Ficha de inventario',
                    'onclick'    => "productos.edit({$id})"
                ]] : $this->noActions()
            ];

            $row[] = $item;
        }

        return $this->listed('productos', $row);
    }

    /*  El apagador de la columna: on = 1 lo enciende. Solo los de la sucursal
        (los de la Matriz se cambian en la Matriz). Apagar pide existencia en 0. */
    public function inventarioProducto() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $p  = $this->qCatalogProduct($this->postId(), $this->companyId(), $this->branchId(), $this->mainBranchId());
        $on = $this->flag('on');

        if (!$p || $p['kind'] !== 'product') return $this->fail(404, 'Ese producto no está en el Catálogo de la sucursal.');
        if ((int) $p['branch_id'] !== $this->branchId()) return $this->fail(409, 'Es de la Matriz: su inventario se enciende o se apaga en la Matriz.');
        if ((int) $p['is_inventoriable'] === $on) return $this->ok($on ? 'Ya llevaba inventario.' : 'Ya no llevaba inventario.');

        if ($on === 0) {
            $problem = $this->fichaOffProblem((int) $p['id'], $this->companyId(), $p['name']);
            if ($problem) return $this->fail(409, 'No se le puede quitar el inventario: ' . $problem);
        }

        return $this->attempt(function () use ($p, $on) {
            $this->must($this->qUpdateItem(['is_inventoriable', 'updated_at = NOW()'], [$on, (int) $p['id']]), 'inventarioProducto');

            return $this->ok($on ? "«{$p['name']}» ya lleva inventario." : "«{$p['name']}» ya no lleva inventario.");
        }, 'No se pudo cambiar el inventario.');
    }

    // La ficha de inventario: la misma de Stock › «Abrir ficha».
    public function getFicha() {
        return $this->needSave(1) ?: $this->fichaResponse($this->postId());
    }

    public function saveFicha() {
        return $this->needSave(1) ?: $this->fichaSaveResponse($this->postId());
    }

    // -- Auxiliares --

    private $rowsCache = null;

    private function rows() {
        if ($this->rowsCache === null) $this->rowsCache = $this->qProductRows($this->companyId(), $this->branchId(), $this->mainBranchId());

        return $this->rowsCache;
    }

    // El apagador (.cp-inv de catalogo.css). Sin poder cambiarlo se ve y no responde.
    private function trackCell($id, $on, $canChange, $own) {
        $class = 'cp-inv' . ($on ? ' is-on' : '');

        if (!$canChange) {
            $why = $own ? 'Tu rol no lo cambia' : 'Se cambia en la Matriz';

            return '<span class="' . $class . ' is-locked" role="img" aria-label="' . ($on ? 'Lleva inventario' : 'Sin inventario') . '. ' . $why . '"></span>';
        }

        return '<button type="button" class="' . $class . '" onclick="productos.inventory(' . $id . ', ' . ($on ? 1 : 0) . ')"'
             . ' aria-label="' . ($on ? 'Quitarle el inventario' : 'Que lleve inventario') . '" aria-pressed="' . ($on ? 'true' : 'false') . '"></button>';
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
