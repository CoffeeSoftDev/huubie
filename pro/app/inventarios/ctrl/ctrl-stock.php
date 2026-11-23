<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Stock: cuánto hay de cada producto del Catálogo con inventario, en los
    almacenes de la sucursal. Pestañas: Existencias y Por caducar (lotes).
    Desde la fila: su kárdex y su configuración (mínimo, máximo, lotes, área). */
class ctrl extends core {

    const SECTION = 'inv-stock';

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $whIds = array_map('intval', array_column($this->warehouses(), 'id'));

        return $this->baseInit([
            'categories' => $this->categoryOptions($this->products()),
            'counts'     => [
                'stock' => count($this->products()),
                'lots'  => count($this->qExpiringLots($whIds, 7))
            ]
        ]);
    }

    // -- Existencias --

    /*  level: '' todos, 'low' bajo el mínimo, 'out' agotados, 'over' sobre el
        máximo. category: el nombre (las categorías son de cada sucursal). */
    public function lsStock() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $whIds    = $this->pickWarehouses();
        $stock    = [];
        $category = $this->post('category');
        $kind     = $this->post('kind');
        $level    = $this->post('level');
        $costs    = $this->costs();

        foreach ($this->qStockByProduct($whIds) as $row) $stock[(int) $row['product_id']] = $row;

        $expiry  = $this->qNextExpiry($whIds);
        $rows    = [];
        $summary = ['products' => 0, 'low' => 0, 'out' => 0, 'value' => 0.0];

        foreach ($this->products() as $p) {
            $id  = (int) $p['id'];
            $qty = isset($stock[$id]) ? round((float) $stock[$id]['quantity'], 4) : 0.0;
            $lvl = $this->level($qty, (float) $p['stock_min'], (float) $p['stock_max']);

            if ($category !== '' && trim((string) $p['category']) !== $category) continue;
            if ($kind !== '' && $p['kind'] !== $kind) continue;
            if ($level !== '' && $lvl !== $level) continue;

            $summary['products']++;
            if ($lvl === 'low') $summary['low']++;
            if ($lvl === 'out') $summary['out']++;
            if ($qty > 0) $summary['value'] += $qty * (float) $p['cost'];

            $rows[] = $this->stockRow($p, $qty, $lvl, $expiry[$id] ?? null, $stock[$id]['last_movement_at'] ?? null, $costs);
        }

        if (!$costs) unset($summary['value']);

        return ['status' => 200, 'row' => $rows, 'summary' => $summary, 'count' => count($this->products())];
    }

    private function level($qty, $min, $max) {
        if ($qty <= 0)                return 'out';
        if ($min > 0 && $qty < $min)  return 'low';
        if ($max > 0 && $qty > $max)  return 'over';

        return 'ok';
    }

    private function levelChip($level, $qty) {
        switch ($level) {
            case 'out':  return chip($qty < 0 ? 'Negativo' : 'Agotado', 'red');
            case 'low':  return chip('Bajo mínimo', 'amber');
            case 'over': return chip('Sobre máximo', 'sky');
            default:     return chip('Normal', 'emerald');
        }
    }

    private function stockRow($p, $qty, $level, $expires, $lastMove, $costs) {
        $id  = (int) $p['id'];
        $min = (float) $p['stock_min'];
        $max = (float) $p['stock_max'];

        $row = [
            'id'          => $id,
            'Producto'    => cellTitle($p['name'], $p['sku'] ?: ''),
            'Categoría'   => $p['category'] ? h($p['category']) : '<span class="cp-celda-sub">—</span>',
            'Tipo'        => $this->kindChip($p['kind']),
            'Existencia'  => '<span class="font-semibold">' . $this->qty($qty, $p['unit'] ?: 'PZA') . '</span>',
            'Mín / Máx'   => ($min > 0 || $max > 0)
                ? h($this->qtyText($min)) . ' / ' . ($max > 0 ? h($this->qtyText($max)) : '—')
                : '<span class="cp-celda-sub">—</span>',
            'Estado'      => $this->levelChip($level, $qty),
            'Caduca'      => $this->expiryCell($expires),
            'Último mov.' => $lastMove ? $this->dateCell(substr($lastMove, 0, 10), $lastMove) : '<span class="cp-celda-sub">—</span>'
        ];

        if ($costs) {
            $row['Costo'] = moneyCell($p['cost']);
            $row['Valor'] = $qty > 0 ? moneyCell($qty * (float) $p['cost']) : '<span class="cp-celda-sub">—</span>';
        }

        $row['a'] = [$this->rowButton('history', 'Kárdex', "stock.kardex({$id})")];

        if ($this->can('update')) $row['a'][] = $this->rowButton('sliders', 'Mínimo, máximo y lotes', "stock.setting({$id})");

        return $row;
    }

    private function qtyText($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }

    // 25/11/2026 y debajo «en 2 días» / «venció hace 3 días».
    private function expiryCell($date) {
        if (!$date) return '<span class="cp-celda-sub">—</span>';

        $days = (int) floor((strtotime($date) - strtotime($this->qNow()['today'])) / 86400);

        return '<div>' . h(date('d/m/Y', strtotime($date))) . '</div>' . $this->daysLeft($days, true);
    }

    private function daysLeft($days, $small = false) {
        if ($days < 0)  $text = $days === -1 ? 'Venció ayer' : 'Venció hace ' . abs($days) . ' días';
        elseif ($days === 0) $text = 'Vence hoy';
        elseif ($days === 1) $text = 'Mañana';
        else $text = "En {$days} días";

        $tone = $days <= 0 ? 'red' : ($days <= 3 ? 'amber' : 'slate');

        return $small ? '<div class="cp-celda-sub">' . h($text) . '</div>' : chip($text, $tone);
    }

    private function categoryOptions($products) {
        $names = [];

        foreach ($products as $p) {
            $name = trim((string) $p['category']);
            if ($name !== '') $names[$name] = $name;
        }

        ksort($names, SORT_NATURAL | SORT_FLAG_CASE);

        return array_map(function ($name) {
            return ['id' => $name, 'valor' => $name];
        }, array_values($names));
    }

    // -- Por caducar --

    // days: '7', '15', '30' o '' (todos los lotes con caducidad, también los vencidos).
    public function lsLots() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $days  = $this->post('days');
        $days  = in_array($days, ['7', '15', '30'], true) ? (int) $days : null;
        $costs = $this->costs();
        $names = array_column($this->products(), null, 'id');
        $rows  = [];
        $whIds = $this->pickWarehouses();

        foreach ($this->qExpiringLots($whIds, $days) as $lot) {
            $p = $names[(int) $lot['product_id']] ?? null;
            if (!$p) continue;

            $row = [
                'id'        => (int) $lot['id'],
                'Producto'  => cellTitle($p['name'], $p['sku'] ?: ''),
                'Lote'      => $lot['batch_code'] ? h($lot['batch_code']) : '<span class="cp-celda-sub">Sin lote</span>',
                'Almacén'   => h($lot['warehouse']),
                'Quedan'    => $this->qty($lot['quantity'], $p['unit'] ?: 'PZA'),
                'Producido' => $lot['produced_at'] ? h(date('d/m/Y', strtotime($lot['produced_at']))) : '<span class="cp-celda-sub">—</span>',
                'Caduca'    => h(date('d/m/Y', strtotime($lot['expires_at']))),
                'Faltan'    => $this->daysLeft((int) $lot['days_left'])
            ];

            if ($costs) $row['Valor'] = moneyCell((float) $lot['quantity'] * (float) $lot['cost']);

            $rows[] = $row;
        }

        return ['status' => 200, 'row' => $rows, 'count' => count($this->qExpiringLots(array_map('intval', array_column($this->warehouses(), 'id')), 7))];
    }

    // -- Kárdex de un producto --

    public function getKardex() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $p = $this->product($this->postId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el inventario de la sucursal.');

        $whIds = $this->pickWarehouses();
        $moves = $this->qMoves((int) $p['id'], $whIds, 80);
        $users = $this->names($moves, ['user_id']);
        $costs = $this->costs();
        $unit  = $p['unit'] ?: 'PZA';
        $types = [
            'ENTRADA'       => ['Entrada', 'emerald'],
            'SALIDA'        => ['Salida', 'red'],
            'TRANSFERENCIA' => ['Traspaso', 'sky'],
            'AJUSTE'        => ['Ajuste', 'amber'],
            'CANCELACION'   => ['Cancelación', 'slate']
        ];
        $rows  = [];

        foreach ($moves as $m) {
            $type = $types[$m['movement_type']] ?? [$m['movement_type'], 'slate'];
            $qty  = (float) $m['quantity'];

            $row = [
                'Fecha'    => $this->dateCell(substr($m['occurred_at'], 0, 10), $m['occurred_at']),
                'Tipo'     => chip($type[0], $type[1]),
                'Folio'    => cellTitle($m['folio'], $m['concept'] ?: ''),
                'Cantidad' => '<span class="font-semibold ' . ($qty < 0 ? 'text-red-600' : 'text-emerald-700') . '">' . ($qty > 0 ? '+' : '') . h($this->qtyText($qty)) . '</span>',
                'Antes'    => h($this->qtyText($m['stock_prev'])),
                'Quedó'    => '<span class="font-semibold">' . h($this->qtyText($m['stock_post'])) . '</span>'
            ];

            if ($costs) $row['Costo'] = moneyCell($m['cost_unit']);

            $row['Usuario'] = h($users[(int) $m['user_id']] ?? '—');

            $rows[] = $row;
        }

        return [
            'status'  => 200,
            'product' => ['id' => (int) $p['id'], 'name' => $p['name'], 'sku' => $p['sku'], 'unit' => $unit],
            'row'     => $rows
        ];
    }

    // -- Configuración de inventario del producto --

    public function getSetting() {
        $fail = $this->needBranch() ?: $this->need('update', 'cambiar el mínimo y el máximo');
        if ($fail) return $fail;

        $p = $this->product($this->postId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el inventario de la sucursal.');

        $setting = $this->qProductSetting((int) $p['id']);
        $whIds   = array_map('intval', array_column($this->warehouses(), 'id'));

        return [
            'status' => 200,
            'data'   => [
                'id'                => (int) $p['id'],
                'name'              => $p['name'],
                'unit'              => $p['unit'] ?: 'PZA',
                'shelf_life_days'   => $p['shelf_life_days'],
                'stock_min'         => $setting ? (float) $setting['stock_min'] : '',
                'stock_max'         => $setting ? (float) $setting['stock_max'] : '',
                'track_lots'        => $setting ? (int) $setting['track_lots'] : ($p['shelf_life_days'] ? 1 : 0),
                'warehouse_area_id' => $setting && $setting['warehouse_area_id'] ? (int) $setting['warehouse_area_id'] : ''
            ],
            'areas'  => $this->qAreaOptions($whIds)
        ];
    }

    public function saveSetting() {
        $fail = $this->needBranch() ?: $this->need('update', 'cambiar el mínimo y el máximo');
        if ($fail) return $fail;

        $p = $this->product($this->postId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el inventario de la sucursal.');

        $min  = $this->post('stock_min') === '' ? 0 : (float) $this->post('stock_min');
        $max  = $this->post('stock_max') === '' ? 0 : (float) $this->post('stock_max');
        $lots = $this->flag('track_lots');
        $area = $this->selectOrNull('warehouse_area_id');

        if ($min < 0 || $max < 0)       return $this->fail(400, 'El mínimo y el máximo no pueden ser negativos.');
        if ($max > 0 && $max < $min)    return $this->fail(400, 'El máximo debe ser mayor que el mínimo (o 0 para no tener máximo).');

        $whIds = array_map('intval', array_column($this->warehouses(), 'id'));

        if ($area !== null && !in_array($area, array_map('intval', array_column($this->qAreaOptions($whIds), 'id')), true)) {
            return $this->fail(400, 'Esa área no es de los almacenes de la sucursal.');
        }

        return $this->attempt(function () use ($p, $min, $max, $lots, $area) {
            $id = (int) $p['id'];

            if ($this->qProductSetting($id)) {
                $this->must($this->qUpdateProductSetting(
                    ['stock_min', 'stock_max', 'track_lots', 'warehouse_area_id', 'active'],
                    [$min, $max, $lots, $area, 1, $id]
                ), 'saveSetting');
            } else {
                $this->must($this->qCreateProductSetting(
                    ['stock_min', 'stock_max', 'track_lots', 'warehouse_area_id', 'company_id', 'product_id', 'active'],
                    [$min, $max, $lots, $area, $this->companyId(), $id, 1]
                ), 'saveSetting/create');
            }

            return $this->ok('Guardado.');
        }, 'No se pudo guardar. Intenta de nuevo.');
    }
}

Permission::dispatch(new ctrl(), 'inv-stock');
