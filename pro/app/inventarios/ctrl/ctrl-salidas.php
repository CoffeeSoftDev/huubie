<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Salidas (folio S-KAF-0001): consumo de producción, degustación, pedido
    complementario y las MERMAS (motivo con is_loss = 1: caducidad, dañado,
    error de producción, faltante). Restan al guardarse, del lote que vence
    primero. No se saca más de lo que hay.

    Las salidas del sistema (venta del POS, surtido a sucursal) no se capturan
    ni se cancelan aquí.

    Casillas: show, create, cancel (pide contraseña), print, ver-costos. */
class ctrl extends core {

    const SECTION   = 'inv-salidas';
    const MAX_LINES = 200;

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->baseInit([
            'reasons' => array_map(function ($r) {
                return ['id' => (int) $r['id'], 'valor' => $r['name']];
            }, $this->qReasons($this->companyId())),
            'counts'  => ['loss' => $this->qCountLossMonth($this->companyId(), $this->branchId())]
        ]);
    }

    private function captureReasons() {
        return array_values(array_filter($this->qReasons($this->companyId()), function ($r) {
            return (int) $r['is_system'] === 0;
        }));
    }

    public function formOptions() {
        $fail = $this->needBranch() ?: $this->need('create', 'registrar salidas');
        if ($fail) return $fail;

        return [
            'status'      => 200,
            'today'       => $this->qNow()['today'],
            'costs'       => $this->costs(),
            'reasons'     => array_map(function ($r) {
                return [
                    'id'         => (int) $r['id'],
                    'valor'      => $r['name'],
                    'code'       => $r['code'],
                    'loss'       => (int) $r['is_loss'],
                    'evidence'   => (int) $r['requires_evidence'],
                    'department' => (int) $r['requires_department'],
                    'note'       => $r['description']
                ];
            }, $this->captureReasons()),
            'departments' => $this->qDepartments($this->companyId()),
            'warehouses'  => $this->warehouseOptions(),
            'products'    => $this->captureProducts()
        ];
    }

    // -- Lista --

    // tab 'loss': solo mermas.
    public function lsOutflows() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las salidas');
        if ($fail) return $fail;

        [$from, $to] = $this->period();

        $loss  = $this->post('tab') === 'loss';
        $list  = $this->qListOutflows($this->companyId(), $this->branchId(), $from, $to, $this->selectOrNull('reason_id'), $loss);
        $users = $this->names($list, ['user_id']);
        $costs = $this->costs();
        $rows  = [];
        $total = 0.0;

        foreach ($list as $r) {
            if ($r['status'] !== 'cancelled') $total += (float) $r['total_cost'];
            $rows[] = $this->outflowRow($r, $users, $costs);
        }

        return [
            'status'  => 200,
            'row'     => $rows,
            'summary' => array_merge(['docs' => count($list)], $costs ? ['total' => round($total, 2)] : []),
            'loss'    => $this->qCountLossMonth($this->companyId(), $this->branchId())
        ];
    }

    private function outflowRow($r, $users, $costs) {
        $id  = (int) $r['id'];
        $row = [
            'id'           => $id,
            'Folio'        => cellTitle($r['folio'], $r['note'] ?: ''),
            'Fecha'        => $this->dateCell($r['operation_date'], $r['created_at']),
            'Motivo'       => $this->colorChip($r['reason'] ?: 'Sin motivo', $r['reason_color'])
                . ((int) $r['is_loss'] === 1 && $r['reason_code'] !== 'MERMA' ? '<div class="cp-celda-sub">Merma</div>' : ''),
            'Departamento' => $r['department'] ? h($r['department']) : '<span class="cp-celda-sub">—</span>',
            'Almacén'      => h($r['warehouse']),
            'Productos'    => (int) $r['total_products']
        ];

        if ($costs) $row['Importe'] = moneyCell($r['total_cost']);

        $row['Estado']  = $this->statusChip($r['status']);
        $row['Capturó'] = h($users[(int) $r['user_id']] ?? '—');
        $row['a']       = [$this->rowButton('eye', 'Ver detalle', "salidas.show({$id})")];

        if ($r['status'] === 'applied' && (int) $r['is_system'] === 0 && $this->can('cancel')) {
            $row['a'][] = $this->rowButton('ban', 'Cancelar', "salidas.cancel({$id})", 'warn');
        }

        return $row;
    }

    // -- Detalle --

    public function getOutflow() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las salidas');
        if ($fail) return $fail;

        $r = $this->qGetOutflow($this->postId(), $this->companyId(), $this->branchId());
        if (!$r) return $this->fail(404, 'Esa salida no existe en la sucursal.');

        $costs = $this->costs();
        $users = $this->names([$r], ['user_id', 'cancelled_user_id']);
        $lines = [];

        foreach ($this->qOutflowLines((int) $r['id']) as $d) {
            $line = [
                'Clave'    => $d['sku'] ? h($d['sku']) : '<span class="cp-celda-sub">—</span>',
                'Producto' => h($d['name']),
                'Cantidad' => $this->qty($d['quantity'], $d['unit'] ?: 'PZA'),
                'Lote'     => $d['batch_code'] ? h($d['batch_code']) : '<span class="cp-celda-sub">—</span>'
            ];

            if ($costs) {
                $line['Costo']   = money($d['cost']);
                $line['Importe'] = money($d['subtotal']);
            }

            $line['Antes'] = h($this->plain($d['previous_stock']));
            $line['Quedó'] = '<span class="font-semibold">' . h($this->plain($d['resulting_stock'])) . '</span>';

            $lines[] = $line;
        }

        return [
            'status' => 200,
            'data'   => [
                'id'            => (int) $r['id'],
                'folio'         => $r['folio'],
                'status'        => $r['status'],
                'reason'        => $r['reason'],
                'reason_color'  => $r['reason_color'],
                'is_loss'       => (int) $r['is_loss'],
                'department'    => $r['department'],
                'warehouse'     => $r['warehouse'],
                'note'          => $r['note'],
                'evidence'      => $r['evidence_url'] ? '/' . ltrim($r['evidence_url'], '/') : '',
                'date'          => date('d/m/Y', strtotime($r['operation_date'])),
                'created'       => date('d/m/Y H:i', strtotime($r['created_at'])),
                'user'          => $users[(int) $r['user_id']] ?? '—',
                'cancelled'     => $r['cancelled_at'] ? date('d/m/Y H:i', strtotime($r['cancelled_at'])) . ' · ' . ($users[(int) $r['cancelled_user_id']] ?? '—') : '',
                'cancel_reason' => $r['cancel_reason'],
                'total'         => $costs ? round((float) $r['total_cost'], 2) : null,
                'can_cancel'    => $r['status'] === 'applied' && (int) $r['is_system'] === 0 && $this->can('cancel')
            ],
            'lines'  => $lines
        ];
    }

    private function plain($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }

    // -- Captura --

    public function addOutflow() {
        $fail = $this->needBranch() ?: $this->need('create', 'registrar salidas');
        if ($fail) return $fail;

        $reason = null;

        foreach ($this->captureReasons() as $r) {
            if ((int) $r['id'] === $this->postId('reason_id')) $reason = $r;
        }

        if (!$reason) return $this->fail(400, 'Elige el motivo de la salida.');

        $warehouse = $this->ownWarehouse($this->postId('warehouse_id'));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén de donde sale.');

        $today = $this->qNow()['today'];
        $date  = $this->dateOrNull($this->post('operation_date'));

        if (!$date)         return $this->fail(400, 'Escribe la fecha de la salida.');
        if ($date > $today) return $this->fail(400, 'La fecha no puede ser futura.');

        $department = $this->selectOrNull('department_id');

        if ($department !== null && !in_array($department, array_map('intval', array_column($this->qDepartments($this->companyId()), 'id')), true)) {
            return $this->fail(400, 'Ese departamento no es de la empresa.');
        }

        if ((int) $reason['requires_department'] === 1 && $department === null) {
            return $this->fail(400, '«' . $reason['name'] . '» pide el departamento que lo consume.');
        }

        $photo = $this->post('photo_b64');

        if ($photo !== '' && !$this->decodePhoto($photo)) return $this->fail(400, 'La foto no se pudo leer. Usa JPG, PNG o WEBP de hasta 5 MB.');
        if ((int) $reason['requires_evidence'] === 1 && $photo === '') return $this->fail(400, '«' . $reason['name'] . '» pide una foto de evidencia.');

        $lines = $this->linesInput();
        if (isset($lines['status'])) return $lines;

        return $this->attempt(function () use ($reason, $warehouse, $date, $department, $photo, $lines) {
            $folio = $this->transaction(function () use ($reason, $warehouse, $date, $department, $photo, $lines) {
                $whId  = (int) $warehouse['id'];
                $folio = $this->nextFolio('S');
                $total = 0.0;
                $units = 0.0;

                foreach ($lines as $l) {
                    $total += $l['subtotal'];
                    $units += $l['quantity'];
                }

                $this->must($this->qCreateOutflow(
                    ['folio', 'note', 'total_products', 'total_units', 'total_cost', 'operation_date', 'status', 'user_id',
                     'company_id', 'branch_id', 'warehouse_id', 'outflow_reason_id', 'department_id', 'active'],
                    [$folio, $this->textOrNull('note'), count($lines), round($units, 4), round($total, 2), $date, 'applied', $this->userId(),
                     $this->companyId(), $this->branchId(), $whId, (int) $reason['id'], $department, 1]
                ), 'addOutflow');

                $outflowId = $this->newId('addOutflow');

                foreach ($lines as $l) {
                    $have = $this->qStockRow($whId, $l['product_id'], true);
                    $have = $have ? round((float) $have['quantity'], 4) : 0.0;

                    if ($have + 0.00001 < $l['quantity']) {
                        throw new InvStop('Solo hay ' . $this->plain(max(0, $have)) . ' ' . $l['unit'] . ' de «' . $l['name'] . '» en ' . $warehouse['name'] . '.');
                    }

                    $lot = $this->takeLots($whId, $l['product_id'], $l['quantity']);

                    [$prev, $post] = $this->stockMove($whId, $l['product_id'], -$l['quantity']);

                    $this->must($this->qCreateOutflowLine(
                        ['quantity', 'cost', 'subtotal', 'previous_stock', 'resulting_stock', 'inventory_outflow_id', 'product_id', 'stock_lot_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['subtotal'], $prev, $post, $outflowId, $l['product_id'], $lot, 1]
                    ), 'addOutflow/line');
                }

                if ($photo !== '') {
                    $this->must($this->qUpdateOutflow(['evidence_url'], [$this->writePhoto($outflowId, $photo, 'salidas'), $outflowId]), 'addOutflow/photo');
                }

                return $folio;
            });

            $what = (int) $reason['is_loss'] === 1 ? 'Merma' : 'Salida';

            return $this->ok("{$what} {$folio} guardada.", ['folio' => $folio]);
        }, 'No se pudo guardar la salida. Intenta de nuevo.');
    }

    /*  Renglones (JSON en lines): product_id y quantity. El mismo producto dos
        veces se junta en uno. El costo es el último del Catálogo: no se edita. */
    private function linesInput() {
        $raw = $this->postedJson('lines');

        if (!$raw)                         return $this->fail(400, 'Agrega al menos un producto.');
        if (count($raw) > self::MAX_LINES) return $this->fail(400, 'Son demasiados renglones: máximo ' . self::MAX_LINES . ' por salida.');

        $products = array_column($this->products(), null, 'id');
        $lines    = [];

        foreach ($raw as $item) {
            $id = (int) ($item['product_id'] ?? 0);
            $p  = $products[$id] ?? null;

            if (!$p) return $this->fail(400, 'Uno de los productos ya no lleva inventario en la sucursal. Vuelve a abrir la captura.');

            $qty = round((float) ($item['quantity'] ?? 0), 4);
            $bad = $this->badQuantity($qty, $p);
            if ($bad) return $this->fail(400, $bad);

            if (isset($lines[$id])) {
                $lines[$id]['quantity'] = round($lines[$id]['quantity'] + $qty, 4);
                continue;
            }

            $lines[$id] = ['product_id' => $id, 'name' => $p['name'], 'unit' => $p['unit'] ?: 'PZA', 'quantity' => $qty, 'cost' => round((float) $p['cost'], 4)];
        }

        foreach ($lines as &$l) $l['subtotal'] = round($l['quantity'] * $l['cost'], 2);
        unset($l);

        return array_values($lines);
    }

    // -- Cancelar --

    // Regresa lo que salió al almacén (y al lote del que salió primero).
    public function cancelOutflow() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar salidas');
        if ($fail) return $fail;

        $reason = $this->textOrNull('reason');
        if ($reason === null) return $this->fail(400, 'Escribe por qué se cancela.');

        $key = $this->needKey('cancelar');
        if ($key) return $key;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $reason) {
            $folio = $this->transaction(function () use ($id, $reason) {
                $r = $this->qGetOutflow($id, $this->companyId(), $this->branchId(), true);

                if (!$r)                          throw new InvStop('Esa salida no existe en la sucursal.');
                if ($r['status'] !== 'applied')   throw new InvStop("La salida {$r['folio']} ya estaba cancelada.");
                if ((int) $r['is_system'] === 1)  throw new InvStop('La creó el sistema: se cancela desde la venta o el surtido.');

                foreach ($this->qOutflowLines($id) as $d) {
                    [$prev, $post] = $this->stockMove((int) $r['warehouse_id'], (int) $d['product_id'], (float) $d['quantity']);

                    $this->must($this->qSetOutflowLineCancelStock((int) $d['id'], $prev, $post), 'cancelOutflow/line');

                    if ($d['stock_lot_id']) $this->must($this->qAddToLot((int) $d['stock_lot_id'], (float) $d['quantity']), 'cancelOutflow/lot');
                }

                $this->must($this->qUpdateOutflow(
                    ['status', 'cancelled_at = NOW()', 'cancelled_user_id', 'cancel_reason'],
                    ['cancelled', $this->userId(), $reason, $id]
                ), 'cancelOutflow');

                return $r['folio'];
            });

            return $this->ok("Salida {$folio} cancelada: lo que salió regresó al almacén.");
        }, 'No se pudo cancelar. Intenta de nuevo.');
    }
}

Permission::dispatch(new ctrl(), 'inv-salidas');
