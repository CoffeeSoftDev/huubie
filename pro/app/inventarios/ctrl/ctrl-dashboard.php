<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Dashboard (R3): el «Dashboard del almacén» de inventory/operacion/almacen
    aplicado al Catálogo de pro. Tarjetas del stock de la sucursal (valor,
    productos, bajo, agotado; clic = su desglose), «Por resurtir» y la
    bitácora: un renglón por documento de la vista inventory_movement, con
    filtros de periodo, tipo y usuario; el ojo abre sus productos.

    Mismo corte que Stock: agotado = nada; bajo = algo, hasta su mínimo. El
    valor va al último costo del Catálogo.

    Casillas: show, ver-costos (sin ella, «Valor del inventario» se cambia por
    «Con existencia» y la bitácora sale sin pesos). */
class ctrl extends core {

    const SECTION = 'inv-dashboard';
    const LOW     = 10;

    const MOVEMENTS = [
        'ENTRADA'       => ['Entrada',     '#16A34A', '#DCFCE7', 'arrow-down-to-line'],
        'SALIDA'        => ['Salida',      '#DC2626', '#FEE2E2', 'arrow-up-from-line'],
        'AJUSTE'        => ['Ajuste',      '#B45309', '#FEF3C7', 'clipboard-check'],
        'TRANSFERENCIA' => ['Traspaso',    '#2563EB', '#DBEAFE', 'arrow-right-left'],
        'CANCELACION'   => ['Cancelación', '#4B5563', '#F3F4F6', 'ban']
    ];

    private function whIds() {
        return array_map('intval', array_column($this->warehouses(), 'id'));
    }

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $tipos = [['id' => '', 'valor' => 'Todos']];
        foreach (self::MOVEMENTS as $code => $m) $tipos[] = ['id' => $code, 'valor' => $m[0] === 'Cancelación' ? 'Cancelaciones' : $m[0] . 's'];

        $names    = $this->qUserNames($this->qMovementUserIds($this->companyId(), $this->whIds()));
        $usuarios = [['id' => '', 'valor' => 'Todos']];

        asort($names);
        foreach ($names as $id => $name) $usuarios[] = ['id' => (int) $id, 'valor' => $name ?: 'Usuario ' . $id];

        return $this->baseInit([
            'branch_id' => $this->branchId(),
            'tipos'     => $tipos,
            'usuarios'  => $usuarios,
            'costs'     => $this->costs()
        ]);
    }

    // -- Tarjetas --

    // Cada producto con inventario y lo que hay de él en los almacenes de la sucursal.
    private function stockList() {
        $stock = [];
        $list  = [];

        foreach ($this->qStockByProduct($this->whIds()) as $row) $stock[(int) $row['product_id']] = (float) $row['quantity'];

        foreach ($this->products() as $p) {
            $list[] = [
                'p'   => $p,
                'qty'  => round($stock[(int) $p['id']] ?? 0, 4),
                'min'  => (float) $p['stock_min'],
                'cost' => (float) $p['cost']
            ];
        }

        return $list;
    }

    private function isLow($r) {
        return $r['qty'] > 0 && $r['min'] > 0 && $r['qty'] <= $r['min'];
    }

    public function showDashboard() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el dashboard');
        if ($fail) return $fail;

        $list  = $this->stockList();
        $value = 0.0;
        $with  = 0;
        $low   = 0;
        $out   = 0;

        foreach ($list as $r) {
            $value += $r['qty'] * $r['cost'];
            if ($r['qty'] > 0) $with++;
            if ($this->isLow($r)) $low++;
            if ($r['qty'] <= 0) $out++;
        }

        // Por resurtir: con mínimo y en él o debajo; los más urgentes primero.
        $urgent = array_values(array_filter($list, function ($r) { return $r['min'] > 0 && $r['qty'] <= $r['min']; }));
        usort($urgent, function ($a, $b) { return ($a['qty'] / $a['min']) <=> ($b['qty'] / $b['min']) ?: strcmp($a['p']['name'], $b['p']['name']); });

        return [
            'status' => 200,
            'counts' => [
                'valor'      => $this->costs() ? '$' . number_format($value, 2, '.', ',') : null,
                'existencia' => $with,
                'productos'  => count($list),
                'bajo'       => $low,
                'agotado'    => $out
            ],
            'lowStock' => array_map(function ($r) {
                return [
                    'nombre' => $r['p']['name'],
                    'stock'  => $this->num($r['qty']),
                    'minimo' => $this->num($r['min']),
                    'unidad' => $r['p']['unit'] ?: '',
                    'out'    => $r['qty'] <= 0
                ];
            }, array_slice($urgent, 0, self::LOW))
        ];
    }

    // El desglose de una tarjeta: los productos que forman su número.
    public function lsKpiDetail() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el dashboard');
        if ($fail) return $fail;

        $list  = $this->stockList();
        $costs = $this->costs();
        $kpi   = $this->post('kpi');

        switch ($kpi) {
            case 'kpiValor':
                $list = array_values(array_filter($list, function ($r) { return abs($r['qty']) > 0.00001; }));
                usort($list, function ($a, $b) use ($costs) {
                    return $costs ? ($b['qty'] * $b['cost']) <=> ($a['qty'] * $a['cost']) : $b['qty'] <=> $a['qty'];
                });

                $row = array_map(function ($r) use ($costs) {
                    $cells = [
                        'Producto'   => $this->productCell($r['p']['name'], $r['p']['sku']),
                        'Categoría'  => $this->categoryCell($r['p']),
                        'Existencia' => $this->qtyCell($r['qty'], $r['p']['unit'])
                    ];

                    if ($costs) {
                        $cells['Último costo'] = $this->money($r['cost']);
                        $cells['Valor']        = '<span class="font-semibold">' . $this->money($r['qty'] * $r['cost']) . '</span>';
                    }

                    return $cells + ['opc' => 0];
                }, $list);
                break;

            case 'kpiProductos':
                $row = array_map(function ($r) {
                    return [
                        'Producto'   => $this->productCell($r['p']['name'], $r['p']['sku']),
                        'Categoría'  => $this->categoryCell($r['p']),
                        'Existencia' => $this->qtyCell($r['qty'], $r['p']['unit']),
                        'Mínimo'     => $this->qtyCell($r['min'], $r['p']['unit']),
                        'Estado'     => $this->stockStatus($r),
                        'opc'        => 0
                    ];
                }, $list);
                break;

            case 'kpiBajo':
                $list = array_values(array_filter($list, function ($r) { return $this->isLow($r); }));
                usort($list, function ($a, $b) { return ($a['qty'] / $a['min']) <=> ($b['qty'] / $b['min']); });

                $row = array_map(function ($r) {
                    return [
                        'Producto'   => $this->productCell($r['p']['name'], $r['p']['sku']),
                        'Categoría'  => $this->categoryCell($r['p']),
                        'Existencia' => $this->qtyCell($r['qty'], $r['p']['unit']),
                        'Mínimo'     => $this->qtyCell($r['min'], $r['p']['unit']),
                        'Faltante'   => '<span class="font-semibold text-amber-700">' . $this->qtyCell($r['min'] - $r['qty'], $r['p']['unit']) . '</span>',
                        'opc'        => 0
                    ];
                }, $list);
                break;

            case 'kpiAgotado':
                $list = array_values(array_filter($list, function ($r) { return $r['qty'] <= 0; }));

                $row = array_map(function ($r) {
                    return [
                        'Producto'   => $this->productCell($r['p']['name'], $r['p']['sku']),
                        'Categoría'  => $this->categoryCell($r['p']),
                        'Existencia' => '<span class="font-semibold text-red-600">' . $this->qtyCell($r['qty'], $r['p']['unit']) . '</span>',
                        'Mínimo'     => $this->qtyCell($r['min'], $r['p']['unit']),
                        'opc'        => 0
                    ];
                }, $list);
                break;

            default:
                return $this->fail(400, 'Indicador no reconocido.');
        }

        return ['status' => 200, 'sucursal' => $this->scope()['branch'], 'row' => $row];
    }

    // -- Bitácora --

    // Columnas: Fecha, Movimiento, Folio, Usuario, Almacén, Productos, Unidades, [Costo]
    public function lsMovimientos() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el dashboard');
        if ($fail) return $fail;

        [$from, $to] = $this->period();

        $type  = array_key_exists($this->post('tipo'), self::MOVEMENTS) ? $this->post('tipo') : '';
        $user  = $this->selectOrNull('user_id');
        $costs = $this->costs();
        $ls    = $this->qMovementLog($this->companyId(), $this->whIds(), $from, $to, $type, $user);
        $users = $this->names($ls, ['user_id']);
        $row   = [];

        foreach ($ls as $m) {
            // Como JSON y sin escape HTML: la tabla pone el atributo con jQuery (no decodifica &quot;).
            $args  = json_encode($m['movement_type']) . ', ' . json_encode((string) $m['folio']);
            $cells = [
                'id'         => $m['folio'],
                'Fecha'      => $this->dateTime(substr($m['occurred_at'], 0, 10), $m['occurred_at']),
                'Movimiento' => $this->moveBadge($m['movement_type']),
                'Folio'      => h($m['folio'] ?: '-'),
                'Usuario'    => h($users[(int) $m['user_id']] ?? '-'),
                'Almacén'    => h($m['warehouse'] ?: '-'),
                'Productos'  => (int) $m['productos'],
                'Unidades'   => h($this->num($m['unidades']))
            ];

            if ($costs) $cells['Costo'] = $this->money($m['costo']);

            $cells['a']   = [$this->rowIcon('eye', "app.getMovimiento({$args})", 'Ver detalle')];
            $cells['opc'] = 0;
            $row[]        = $cells;
        }

        return ['status' => 200, 'row' => $row];
    }

    // El ojo de la bitácora: los productos del documento con lo que había y lo que quedó.
    public function getMovimiento() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el dashboard');
        if ($fail) return $fail;

        $type  = $this->post('tipo');
        $folio = trim($this->post('folio'));

        if (!isset(self::MOVEMENTS[$type]) || $folio === '') return $this->fail(400, 'Movimiento no válido.');

        $ls = $this->qMovementDetail($this->companyId(), $this->whIds(), $type, $folio);
        if (!$ls) return $this->fail(404, 'No se encontró el movimiento en esta sucursal.');

        $costs = $this->costs();
        $total = 0.0;
        $row   = [];

        foreach ($ls as $p) {
            $qty    = (float) $p['quantity'];
            $total += abs((float) $p['cost_total']);
            $cells  = [
                'Producto'   => $this->productCell($p['name'] ?: 'Producto borrado', $p['sku']),
                'Cantidad'   => '<span class="font-semibold ' . ($qty < 0 ? 'text-red-600' : 'text-green-600') . '">' . ($qty > 0 ? '+' : '') . $this->qtyCell($qty, $p['unit']) . '</span>',
                'Existencia' => $this->stockChange($p['stock_prev'], $p['stock_post'])
            ];

            if ($costs) {
                $cells['Costo unitario'] = $this->money($p['cost_unit']);
                $cells['Importe']        = $this->money(abs((float) $p['cost_total']));
            }

            $row[] = $cells + ['opc' => 0];
        }

        $first = $ls[0];
        $users = $this->names([$first], ['user_id']);

        return [
            'status' => 200,
            'header' => [
                'badge'     => $this->moveBadge($type),
                'folio'     => $folio,
                'fecha'     => $this->dateTime(substr($first['occurred_at'], 0, 10), $first['occurred_at']),
                'usuario'   => $users[(int) $first['user_id']] ?? '-',
                'almacen'   => $first['warehouse'] ?: '-',
                'nota'      => trim((string) ($first['note'] ?: '')),
                'productos' => count($ls),
                'costo'     => $costs && $total > 0 ? '$' . number_format($total, 2, '.', ',') : ''
            ],
            'row' => $row
        ];
    }

    // -- Celdas --

    private function moveBadge($type) {
        $m = self::MOVEMENTS[$type] ?? [$type, '#6B7280', '#F3F4F6', 'circle'];

        return $this->badge($m[0], $m[1], $m[2], $m[3]);
    }

    private function stockChange($before, $after) {
        if ($before === null && $after === null) return '<span class="text-gray-400">-</span>';

        return '<span class="text-gray-500">' . ($before === null ? '-' : h($this->num($before))) . '</span>'
             . ' <span class="text-gray-400">→</span> '
             . '<span class="font-semibold">' . ($after === null ? '-' : h($this->num($after))) . '</span>';
    }

    private function qtyCell($value, $unit) {
        $unit = trim((string) $unit);

        return h($this->num($value)) . ($unit !== '' ? ' <span class="text-[10px] uppercase text-gray-400">' . h($unit) . '</span>' : '');
    }

    private function categoryCell($p) {
        $name = trim((string) ($p['category'] ?? ''));

        return $name !== '' ? h($name) : '<span class="italic text-gray-400">Sin categoría</span>';
    }

    private function stockStatus($r) {
        if ($r['qty'] <= 0)    return $this->badge('Agotado', '#DC2626', '#FEE2E2');
        if ($this->isLow($r))  return $this->badge('Stock bajo', '#B45309', '#FEF3C7');

        return $this->badge('Disponible', '#16A34A', '#DCFCE7');
    }
}

Permission::dispatch(new ctrl(), 'inv-dashboard');
