<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Kárdex: cada vez que cambió la existencia en los almacenes de la sucursal
    (entradas, salidas, traspasos, ajustes y cancelaciones), del más nuevo al
    más viejo, con lo que había y lo que quedó. Solo lectura: sale de la vista
    inventory_movement.

    Casillas: show, print, ver-costos (sin ella, sin pesos). */
class ctrl extends core {

    const SECTION = 'inv-kardex';
    const LIMIT   = 2000;
    const TYPES   = [
        'ENTRADA'       => ['Entrada', 'emerald'],
        'SALIDA'        => ['Salida', 'red'],
        'TRANSFERENCIA' => ['Traspaso', 'sky'],
        'AJUSTE'        => ['Ajuste', 'amber'],
        'CANCELACION'   => ['Cancelación', 'slate']
    ];

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $types = [];
        foreach (self::TYPES as $code => $type) $types[] = ['id' => $code, 'valor' => $type[0]];

        return $this->baseInit([
            'types'    => $types,
            'products' => array_map(function ($p) {
                return ['id' => (int) $p['id'], 'valor' => ($p['sku'] ? $p['sku'] . ' · ' : '') . $p['name']];
            }, $this->products())
        ]);
    }

    // Filtros: periodo (fi, ff), warehouse_id, type, product_id.
    public function lsMoves() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el kárdex');
        if ($fail) return $fail;

        [$from, $to] = $this->period();

        $type      = array_key_exists($this->post('type'), self::TYPES) ? $this->post('type') : '';
        $productId = $this->selectOrNull('product_id');
        $moves     = $this->qKardex($this->companyId(), $this->pickWarehouses(), $from, $to, $type, $productId, self::LIMIT + 1);
        $more      = count($moves) > self::LIMIT;

        if ($more) array_pop($moves);

        $users   = $this->names($moves, ['user_id']);
        $costs   = $this->costs();
        $many    = count($this->warehouses()) > 1;
        $rows    = [];
        $summary = ['moves' => count($moves), 'in' => 0, 'out' => 0, 'more' => $more];
        $units   = ['in' => 0.0, 'out' => 0.0];
        $value   = ['in' => 0.0, 'out' => 0.0];

        foreach ($moves as $m) {
            $qty  = (float) $m['quantity'];
            $side = $qty >= 0 ? 'in' : 'out';
            $kind = self::TYPES[$m['movement_type']] ?? [$m['movement_type'], 'slate'];
            $unit = $m['unit'] ?: 'PZA';

            $summary[$side]++;
            $units[$side] += abs($qty);
            $value[$side] += abs((float) $m['cost_total']);

            $row = [
                'Fecha'    => $this->dateCell(substr($m['occurred_at'], 0, 10), $m['occurred_at']),
                'Tipo'     => chip($kind[0], $kind[1]),
                'Folio'    => cellTitle($m['folio'], $m['concept'] ?: ''),
                'Producto' => cellTitle($m['product'] ?: 'Producto borrado', $m['sku'] ?: '')
            ];

            if ($many) $row['Almacén'] = h($m['warehouse']);

            $row['Cantidad'] = '<span class="font-semibold ' . ($qty < 0 ? 'text-red-600' : 'text-emerald-700') . '">'
                . ($qty > 0 ? '+' : '') . h($this->num($qty)) . '</span> <span class="cp-celda-sub">' . h($unit) . '</span>';
            $row['Antes']    = h($this->num($m['stock_prev']));
            $row['Quedó']    = '<span class="font-semibold">' . h($this->num($m['stock_post'])) . '</span>';

            if ($costs) {
                $row['Costo']   = moneyCell($m['cost_unit']);
                $row['Importe'] = moneyCell(abs((float) $m['cost_total']));
            }

            $row['Usuario'] = h($users[(int) $m['user_id']] ?? '—');

            $rows[] = $row;
        }

        // Las unidades solo se suman con un producto elegido: kilos y piezas no se mezclan.
        if ($productId !== null && $moves) {
            $summary['unit']      = $moves[0]['unit'] ?: 'PZA';
            $summary['units_in']  = round($units['in'], 4);
            $summary['units_out'] = round($units['out'], 4);
        }

        if ($costs) {
            $summary['value_in']  = round($value['in'], 2);
            $summary['value_out'] = round($value['out'], 2);
        }

        return ['status' => 200, 'row' => $rows, 'summary' => $summary];
    }
}

Permission::dispatch(new ctrl(), 'inv-kardex');
