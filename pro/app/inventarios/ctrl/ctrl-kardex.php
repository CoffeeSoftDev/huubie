<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Kárdex: el «Visor de Movimientos» de inventory/operacion/almacen/movimientos
    aplicado al Catálogo de pro. La tabla junta los movimientos del periodo por
    producto (cuántos, entradas, salidas, neto, el último); el ojo abre a la
    derecha cada movimiento con lo que había y lo que quedó. Solo lectura: sale
    de la vista inventory_movement (entradas, salidas, traspasos, ajustes y
    cancelaciones).

    Casillas: show, print, ver-costos (sin ella, sin pesos). */
class ctrl extends core {

    const SECTION = 'inv-kardex';
    const LIMIT   = 3000;
    const TYPES   = [
        'ENTRADA'       => ['ENTRADA',      'rgba(63,193,137,0.15)',                   '#15803D'],
        'SALIDA'        => ['SALIDA',       'rgba(224,36,36,0.15)',                    '#B91C1C'],
        'TRANSFERENCIA' => ['TRASPASO',     'rgb(var(--brand-600, 192 90 64) / 0.15)', 'rgb(var(--brand-600, 192 90 64))'],
        'AJUSTE'        => ['AJUSTE',       'rgba(167,139,250,0.15)',                  '#7C3AED'],
        'CANCELACION'   => ['CANCELACIÓN',  'rgba(156,163,175,0.18)',                  '#4B5563']
    ];

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->baseInit([
            'branch_id'  => $this->branchId(),
            'sucursales' => $this->branchOptions(),
            'costs'      => $this->costs()
        ]);
    }

    private function moves() {
        [$from, $to] = $this->period();

        $type = array_key_exists($this->post('movement_type'), self::TYPES) ? $this->post('movement_type') : '';

        return $this->qKardex($this->companyId(), array_map('intval', array_column($this->warehouses(), 'id')), $from, $to, $type, $this->selectOrNull('item_id'), self::LIMIT);
    }

    // Columnas: Producto, Movs, Entradas, Salidas, Neto, Últ. mov
    public function lsMovimientos() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el kárdex');
        if ($fail) return $fail;

        $moves = $this->moves();
        $users = $this->names($moves, ['user_id']);
        $costs = $this->costs();
        $prod  = [];

        // Vienen del más nuevo al más viejo: el primero de cada producto es su último movimiento.
        foreach ($moves as $m) {
            $id  = (int) $m['product_id'];
            $qty = (float) $m['quantity'];

            if (!isset($prod[$id])) {
                $prod[$id] = [
                    'itemId'   => $id,
                    'producto' => $m['product'] ?: 'Producto borrado',
                    'sku'      => $m['sku'] ?: '',
                    'unidad'   => $m['unit'] ?: 'PZA',
                    'count'    => 0,
                    'entradas' => 0,
                    'salidas'  => 0,
                    'neto'     => 0.0,
                    'costoTot' => 0.0,
                    'lastType' => $m['movement_type'],
                    'lastDate' => $m['occurred_at'] ?: '',
                    'movs'     => []
                ];
            }

            $prod[$id]['count']++;
            if ($qty >= 0) $prod[$id]['entradas']++; else $prod[$id]['salidas']++;
            $prod[$id]['neto']     += $qty;
            $prod[$id]['costoTot'] += $costs ? (float) $m['cost_total'] : 0;

            $prod[$id]['movs'][] = [
                'tipo'      => $m['movement_type'],
                'tipoTxt'   => self::TYPES[$m['movement_type']][0] ?? $m['movement_type'],
                'folio'     => $m['folio'],
                'nota'      => $m['concept'],
                'cant'      => $qty,
                'stockPrev' => (float) $m['stock_prev'],
                'stockPost' => (float) $m['stock_post'],
                'costoTot'  => $costs ? (float) $m['cost_total'] : null,
                'almacen'   => $m['warehouse'] ?: '-',
                'usuario'   => $users[(int) $m['user_id']] ?? '-',
                'fecha'     => $m['occurred_at'] ?: ''
            ];
        }

        $rows = [];
        $data = [];

        foreach ($prod as $id => $p) {
            $neto = round($p['neto'], 4);

            $rows[] = [
                'id'       => $id,
                'Producto' => h($p['producto']) . ($p['sku'] ? '<br><span class="text-[10px] text-gray-400">' . h($p['sku']) . '</span>' : ''),
                'Movs'     => '<span class="font-semibold">' . $p['count'] . '</span>',
                'Entradas' => '<span class="text-green-600 font-semibold">' . $p['entradas'] . '</span>',
                'Salidas'  => '<span class="text-red-600 font-semibold">' . $p['salidas'] . '</span>',
                'Neto'     => '<span class="font-bold ' . ($neto < 0 ? 'text-red-600' : 'text-green-600') . '">' . ($neto > 0 ? '+' : '') . h($this->num($neto)) . '</span> <span class="text-[10px] text-gray-400">' . h($p['unidad']) . '</span>',
                'Últ. Mov' => $this->typeBadge($p['lastType']) . ' <span class="text-[10px] text-gray-400">' . h($this->dateTime(substr($p['lastDate'], 0, 10), $p['lastDate'])) . '</span>',
                'a'        => [$this->rowIcon('eye', "app.selectProducto({$id})", 'Ver movimientos')]
            ];

            $p['neto'] = $neto;
            $data[]    = $p;
        }

        return ['status' => 200, 'row' => $rows, 'data' => $data, 'more' => count($moves) >= self::LIMIT];
    }

    private function typeBadge($type) {
        $c = self::TYPES[$type] ?? [$type, 'rgba(156,163,175,0.18)', '#6B7280'];

        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c[1]};color:{$c[2]};'>" . h($c[0]) . '</span>';
    }

    // Total, entradas, salidas y traspasos del periodo (los renglones, no los documentos).
    public function showMovimientos() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el kárdex');
        if ($fail) return $fail;

        $types = array_count_values(array_column($this->moves(), 'movement_type'));

        return [
            'status' => 200,
            'counts' => [
                'total'           => array_sum($types),
                'total_entradas'  => $types['ENTRADA'] ?? 0,
                'total_salidas'   => $types['SALIDA'] ?? 0,
                'total_traspasos' => $types['TRANSFERENCIA'] ?? 0
            ]
        ];
    }
}

Permission::dispatch(new ctrl(), 'inv-kardex');
