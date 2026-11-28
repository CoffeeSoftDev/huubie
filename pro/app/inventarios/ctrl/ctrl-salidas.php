<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Salidas (folio S-KAF-0001): consumo de producción, degustación, pedido
    complementario y las MERMAS (motivo con is_loss = 1: caducidad, dañado,
    error de producción, faltante). La interfaz es la de
    inventory/operacion/almacen/salidas (visor; captura salida-form.js) aplicada
    al Catálogo de pro: los opc y las respuestas llevan los nombres de inventory.

    Restan al guardarse, del lote que vence primero. No se saca más de lo que
    hay. Las salidas del sistema (venta del POS, surtido a sucursal) no se
    capturan ni se cancelan aquí.

    Casillas: show, create, cancel (pide contraseña), print, ver-costos. */
class ctrl extends core {

    const SECTION   = 'inv-salidas';
    const MAX_LINES = 200;

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $capture = array_column($this->captureReasons(), 'id');

        return $this->baseInit([
            'branch_id'      => $this->branchId(),
            'sucursales'     => $this->branchOptions(),
            'motivos_salida' => array_map(function ($r) use ($capture) {
                return [
                    'id'                => (string) $r['id'],
                    'valor'             => $r['name'],
                    'code'              => $r['code'],
                    'is_loss'           => (int) $r['is_loss'],
                    'requires_evidence' => (int) $r['requires_evidence'],
                    'description'       => $r['description'],
                    'capture'           => in_array($r['id'], $capture, true)
                ];
            }, $this->qReasons($this->companyId())),
            'almacenes'      => $this->warehouseList(),
            'productos'      => $this->catalogProducts(),
            'costs'          => $this->costs()
        ]);
    }

    private function captureReasons() {
        if (!$this->can('create')) return [];

        return array_values(array_filter($this->qReasons($this->companyId()), function ($r) {
            return (int) $r['is_system'] === 0;
        }));
    }

    // -- Lista y KPIs --

    // Filtros: Rango (fi, ff), Motivo (reason_id) y Estado (Aplicada, Cancelada).
    private function filtered() {
        $status = ['Aplicada' => 'applied', 'Cancelada' => 'cancelled'][$this->post('status')] ?? '';

        [$from, $to] = $this->period();

        return $this->qListOutflows($this->companyId(), $this->branchId(), $from, $to, $this->selectOrNull('reason_id'), $status);
    }

    public function lsSalidas() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las salidas');
        if ($fail) return $fail;

        $list  = $this->filtered();
        $users = $this->names($list, ['user_id']);
        $costs = $this->costs();
        $rows  = [];

        foreach ($list as $s) {
            $id   = (int) $s['id'];
            $open = "salidas.getSalida({$id})";
            $row  = [
                'id'       => $id,
                'Folio'    => ['html' => $this->folioLink($s['folio'], $open)],
                'Fecha'    => $this->dateTime($s['operation_date'], $s['created_at']),
                'Tipo'     => $this->badge($s['reason'] ?: 'Sin motivo', $s['reason_color'], null, $s['reason_icon']),
                'Sucursal' => h($s['branch'] ?: '-'),
                'Origen'   => h($s['warehouse'] ?: '-')
            ];

            if ($costs) $row['Costo'] = '<span class="text-red-400">' . $this->money($s['total_cost']) . '</span>';

            $row['Estado']     = $this->statusBadge($s['status']);
            $row['Registrado'] = h($users[(int) $s['user_id']] ?? '-');
            $row['a']          = [$this->rowIcon('eye', $open, 'Ver detalle')];

            $rows[] = $row;
        }

        return ['status' => 200, 'row' => $rows];
    }

    // Valor de salidas, registros, unidades y canceladas (las canceladas no suman valor ni unidades).
    public function showSalidas() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las salidas');
        if ($fail) return $fail;

        $list = $this->filtered();
        $live = array_filter($list, function ($s) { return $s['status'] !== 'cancelled'; });

        return [
            'status' => 200,
            'counts' => [
                'total_costo'      => $this->costs() ? round(array_sum(array_column($live, 'total_cost')), 2) : null,
                'total_salidas'    => count($list),
                'total_unidades'   => round(array_sum(array_column($live, 'total_units')), 4),
                'total_canceladas' => count($list) - count($live),
                'total_mermas'     => count(array_filter($live, function ($s) { return (int) $s['is_loss'] === 1; }))
            ]
        ];
    }

    public function lsKpiDetail() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las salidas');
        if ($fail) return $fail;

        $list = $this->filtered();
        $live = array_values(array_filter($list, function ($s) { return $s['status'] !== 'cancelled'; }));

        switch ($this->post('kpi')) {
            case 'kpiPerdida':    $row = $this->kpiByProduct($live, 'cost'); break;
            case 'kpiUnidades':   $row = $this->kpiByProduct($live, 'units'); break;
            case 'kpiRegistros':  $row = $this->kpiByReason($live); break;
            case 'kpiMermas':     $row = $this->kpiByReason(array_values(array_filter($live, function ($s) { return (int) $s['is_loss'] === 1; }))); break;
            case 'kpiCanceladas': $row = $this->kpiCancelled($list); break;
            default:              return $this->fail(400, 'Indicador no reconocido.');
        }

        return ['status' => 200, 'row' => $row];
    }

    private function kpiByProduct($list, $order) {
        $costs    = $this->costs();
        $products = $this->qOutflowProducts(array_map('intval', array_column($list, 'id')));
        $field    = $order === 'units' || !$costs ? 'units' : 'cost';

        usort($products, function ($a, $b) use ($field) { return (float) $b[$field] <=> (float) $a[$field]; });

        $total = array_sum(array_column($products, $field));
        $rows  = [];

        foreach ($products as $i => $p) {
            $row = [
                'id'       => $i + 1,
                'Producto' => $this->productCell($p['name'], $p['sku']),
                'Unidad'   => h($p['unit'] ?: 'PZA'),
                'Cantidad' => $this->num($p['units'])
            ];
            if ($field === 'cost') $row['Valor'] = $this->money($p['cost']);
            $row['Participación'] = $this->percent($p[$field], $total);

            $rows[] = $row;
        }

        if ($rows) {
            $foot = ['Producto' => 'Total', 'Unidad' => '', 'Cantidad' => $this->num(array_sum(array_column($products, 'units')))];
            if ($field === 'cost') $foot['Valor'] = $this->money($total);
            $foot['Participación'] = $this->percent($total, $total);

            $rows[] = $this->totalRow($foot);
        }

        return $rows;
    }

    private function kpiByReason($list) {
        $costs  = $this->costs();
        $groups = [];

        foreach ($list as $s) {
            $key = (int) $s['outflow_reason_id'];

            if (!isset($groups[$key])) $groups[$key] = ['name' => $s['reason'] ?: 'Sin motivo', 'color' => $s['reason_color'], 'icon' => $s['reason_icon'], 'docs' => 0, 'units' => 0, 'cost' => 0];

            $groups[$key]['docs']++;
            $groups[$key]['units'] += (float) $s['total_units'];
            $groups[$key]['cost']  += (float) $s['total_cost'];
        }

        usort($groups, function ($a, $b) { return $b['docs'] <=> $a['docs']; });

        $total = count($list);
        $rows  = [];

        foreach ($groups as $i => $g) {
            $row = [
                'id'        => $i + 1,
                'Motivo'    => $this->badge($g['name'], $g['color'], null, $g['icon']),
                'Registros' => $g['docs'],
                'Unidades'  => $this->num($g['units'])
            ];
            if ($costs) $row['Valor'] = $this->money($g['cost']);
            $row['Participación'] = $this->percent($g['docs'], $total);

            $rows[] = $row;
        }

        if ($rows) {
            $foot = ['Motivo' => 'Total', 'Registros' => $total, 'Unidades' => $this->num(array_sum(array_column($groups, 'units')))];
            if ($costs) $foot['Valor'] = $this->money(array_sum(array_column($groups, 'cost')));
            $foot['Participación'] = $this->percent($total, $total);

            $rows[] = $this->totalRow($foot);
        }

        return $rows;
    }

    private function kpiCancelled($list) {
        $costs = $this->costs();
        $users = $this->names($list, ['cancelled_user_id']);
        $rows  = [];

        foreach ($list as $s) {
            if ($s['status'] !== 'cancelled') continue;

            $row = [
                'id'     => (int) $s['id'],
                'Folio'  => h($s['folio']),
                'Fecha'  => $this->dateTime($s['operation_date']),
                'Motivo' => $this->badge($s['reason'] ?: 'Sin motivo', $s['reason_color'], null, $s['reason_icon']),
                'Canceló' => h($users[(int) $s['cancelled_user_id']] ?? '-'),
                'Por qué' => h($s['cancel_reason'] ?: '-')
            ];
            if ($costs) $row['Valor'] = $this->money($s['total_cost']);

            $rows[] = $row;
        }

        return $rows;
    }

    // -- Detalle --

    public function getSalida() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las salidas');
        if ($fail) return $fail;

        $s = $this->qGetOutflow($this->postId(), $this->companyId(), $this->branchId());
        if (!$s) return $this->fail(404, 'Esa salida no existe en la sucursal.');

        $costs = $this->costs();
        $users = $this->names([$s], ['user_id', 'cancelled_user_id']);

        return [
            'status' => 200,
            'header' => [
                'id'                  => (int) $s['id'],
                'folio'               => $s['folio'],
                'outflow_reason_id'   => (int) $s['outflow_reason_id'],
                'branch_id'           => (int) $s['branch_id'],
                'warehouse_id'        => (int) $s['warehouse_id'],
                'operation_date'      => $s['operation_date'],
                'adjustment_date'     => $this->qLastAdjustmentDates([(int) $s['warehouse_id']])[(int) $s['warehouse_id']] ?? '',
                'is_sale'             => $s['sale_id'] ? 1 : 0,
                'edited_user_name'    => !empty($s['edited_user_id']) ? ($this->qUserNames([(int) $s['edited_user_id']])[(int) $s['edited_user_id']] ?? '') : '',
                'edited_at'           => $s['edited_at'] ?? null,
                'status'              => $this->statusName($s['status']),
                'reason_name'         => $s['reason'],
                'reason_color'        => $s['reason_color'],
                'reason_icon'         => $s['reason_icon'],
                'is_loss'             => (int) $s['is_loss'],
                'is_system'           => (int) $s['is_system'],
                'created_at'          => $s['operation_date'] . ' ' . substr($s['created_at'], 11, 8),
                'branch_name'         => $s['branch'],
                'warehouse_name'      => $s['warehouse'],
                'user_name'           => $users[(int) $s['user_id']] ?? '-',
                'cancelled_user_name' => $s['cancelled_user_id'] ? ($users[(int) $s['cancelled_user_id']] ?? '-') : '',
                'cancelled_at'        => $s['cancelled_at'],
                'cancel_reason'       => $s['cancel_reason'],
                'note'                => $s['note'],
                'evidence_url'        => $s['evidence_url'] ? '/' . ltrim($s['evidence_url'], '/') : '',
                'updated_at'          => $s['updated_at'],
                'total_units'         => (float) $s['total_units'],
                'total_cost'          => $costs ? (float) $s['total_cost'] : 0
            ],
            'detail' => array_map(function ($d) use ($costs) {
                return [
                    'product_id'   => (int) $d['product_id'],
                    'product_name' => $d['name'],
                    'sku'          => $d['sku'],
                    'unit'         => $d['unit'] ?: 'PZA',
                    'quantity'     => (float) $d['quantity'],
                    'cost'         => $costs ? (float) $d['cost'] : 0,
                    'subtotal'     => $costs ? (float) $d['subtotal'] : 0,
                    'batch_code'   => $d['batch_code'],
                    'expires_at'   => $d['expires_at']
                ];
            }, $this->qOutflowLines((int) $s['id']))
        ];
    }

    public function lsStockByWarehouse() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return ['status' => 200, 'stock' => (object) $this->stockMap($this->postId('warehouse_id'))];
    }

    // -- Guardar --

    /*  payload (JSON): shrinkage_reason_id, branch_id, warehouse_id,
        date_outflow, note, evidence_b64 y productos [{product_id, quantity}].
        El costo es el último del Catálogo: no se edita. */
    public function saveSalida() {
        $fail = $this->needBranch() ?: $this->need('create', 'registrar salidas');
        if ($fail) return $fail;

        $p = json_decode($this->post('payload'), true);
        if (!is_array($p)) return $this->fail(400, 'No llegaron los datos de la salida.');

        $reason = null;

        foreach ($this->captureReasons() as $r) {
            if ((int) $r['id'] === (int) ($p['shrinkage_reason_id'] ?? 0)) $reason = $r;
        }

        if (!$reason) return $this->fail(400, 'Elige el motivo de la salida.');

        if ((int) ($p['branch_id'] ?? 0) !== $this->branchId()) return $this->fail(400, 'La salida es de la sucursal de arriba: cámbiala ahí.');

        $warehouse = $this->ownWarehouse((int) ($p['warehouse_id'] ?? 0));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén de donde sale.');

        $date = (string) ($p['date_outflow'] ?? $this->qNow()['today']);
        $bad  = $this->badDate($date) ?: $this->adjustmentBlocks((int) $warehouse['id'], $date);
        if ($bad) return $this->fail(400, $bad);

        $photo = (string) ($p['evidence_b64'] ?? '');

        if ($photo !== '' && !$this->decodePhoto($photo)) return $this->fail(400, 'La foto no se pudo leer. Usa JPG, PNG o WEBP de hasta 5 MB.');
        if ((int) $reason['requires_evidence'] === 1 && $photo === '') return $this->fail(400, '«' . $reason['name'] . '» pide una foto de evidencia.');

        $lines = $this->linesInput($p['productos'] ?? []);
        if (isset($lines['status'])) return $lines;

        $note = mb_substr(trim((string) ($p['note'] ?? '')), 0, 255, 'UTF-8') ?: null;

        return $this->attempt(function () use ($reason, $warehouse, $date, $photo, $lines, $note) {
            $saved = $this->transaction(function () use ($reason, $warehouse, $date, $photo, $lines, $note) {
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
                     'company_id', 'branch_id', 'warehouse_id', 'outflow_reason_id', 'active'],
                    [$folio, $note, count($lines), round($units, 4), round($total, 2), $date, 'applied', $this->userId(),
                     $this->companyId(), $this->branchId(), $whId, (int) $reason['id'], 1]
                ), 'saveSalida');

                $outflowId = $this->newId('saveSalida');

                foreach ($lines as $l) {
                    $have = $this->qStockRow($whId, $l['product_id'], true);
                    $have = $have ? round((float) $have['quantity'], 4) : 0.0;

                    if ($have + 0.00001 < $l['quantity']) {
                        throw new InvStop('Solo hay ' . $this->num(max(0, $have)) . ' ' . $l['unit'] . ' de «' . $l['name'] . '» en ' . $warehouse['name'] . '.');
                    }

                    $lot = $this->takeLots($whId, $l['product_id'], $l['quantity']);

                    [$prev, $post] = $this->stockMove($whId, $l['product_id'], -$l['quantity']);

                    $this->must($this->qCreateOutflowLine(
                        ['quantity', 'cost', 'subtotal', 'previous_stock', 'resulting_stock', 'inventory_outflow_id', 'product_id', 'stock_lot_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['subtotal'], $prev, $post, $outflowId, $l['product_id'], $lot, 1]
                    ), 'saveSalida/line');
                }

                if ($photo !== '') {
                    $this->must($this->qUpdateOutflow(['evidence_url'], [$this->writePhoto($outflowId, $photo, 'salidas'), $outflowId]), 'saveSalida/photo');
                }

                return ['folio' => $folio, 'id' => $outflowId];
            });

            return $this->ok(((int) $reason['is_loss'] === 1 ? 'Merma ' : 'Salida ') . $saved['folio'] . ' registrada.', $saved);
        }, 'No se pudo registrar la salida. Intenta de nuevo.');
    }

    // El mismo producto dos veces se junta en uno. El costo es el último del Catálogo.
    private function linesInput($raw) {
        if (!is_array($raw) || !$raw)      return $this->fail(400, 'Agrega al menos un producto.');
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

    // -- Cancelar (contraseña primero, luego el motivo) --

    // doc 'outflow' = cancelar (casilla cancel); 'outflow-edit' = editar (casilla update).
    public function verifyKey() {
        $edit = $this->post('doc') === 'outflow-edit';
        $fail = $this->needBranch() ?: ($edit ? $this->need('update', 'editar salidas') : $this->need('cancel', 'cancelar salidas'));
        if ($fail) return $fail;

        if (!$this->qGetOutflow($this->postId(), $this->companyId(), $this->branchId())) return $this->fail(404, 'Esa salida no existe en la sucursal.');

        return $this->keyCheck($edit ? 'outflow-edit' : 'outflow', $this->postId());
    }

    // -- Editar (R2): la captura abierta con sus datos, contraseña primero --

    /*  payload: el de saveSalida más id. Regresa al almacén (y a su lote) lo que
        sacó cada renglón viejo, saca lo nuevo del almacén elegido (si es el
        mismo, el efecto neto es la diferencia) y rehace la cadena Antes → Quedó
        con los renglones nuevos en el lugar de los viejos. Las de una venta o un
        surtido no se editan aquí. Todo o nada. */
    public function updateSalida() {
        $fail = $this->needBranch() ?: $this->need('update', 'editar salidas');
        if ($fail) return $fail;

        $p  = json_decode($this->post('payload'), true);
        $id = (int) ($p['id'] ?? 0);

        if (!is_array($p) || $id <= 0) return $this->fail(400, 'No llegaron los datos de la salida.');
        if (!$this->keyAuthorized('outflow-edit', $id)) return $this->fail(403, 'Confirma tu contraseña para editar la salida.');

        $current = $this->qGetOutflow($id, $this->companyId(), $this->branchId());
        if (!$current)                                          return $this->fail(404, 'Esa salida no existe en la sucursal.');
        if ($current['status'] !== 'applied')                   return $this->fail(400, 'No se edita una salida cancelada.');
        if ((int) $current['is_system'] === 1 || $current['sale_id']) return $this->fail(400, 'La creó el sistema (una venta o un surtido): se corrige desde ahí.');

        $reason = null;
        foreach ($this->captureReasons() as $r) if ((int) $r['id'] === (int) ($p['shrinkage_reason_id'] ?? 0)) $reason = $r;
        if (!$reason) return $this->fail(400, 'Elige el motivo de la salida.');

        $warehouse = $this->ownWarehouse((int) ($p['warehouse_id'] ?? 0));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén de donde sale.');

        $date = (string) ($p['date_outflow'] ?? $current['operation_date']);
        $bad  = $this->badDate($date)
            ?: $this->adjustmentBlocks((int) $current['warehouse_id'], $current['operation_date'])
            ?: $this->adjustmentBlocks((int) $warehouse['id'], $date);
        if ($bad) return $this->fail(400, $bad);

        // La foto nueva (si la hay) la sube la pantalla después; sin foto, la merma conserva la suya.
        if ((int) $reason['requires_evidence'] === 1 && !$current['evidence_url'] && empty($p['has_photo'])) {
            return $this->fail(400, '«' . $reason['name'] . '» pide una foto de evidencia.');
        }

        $lines = $this->linesInput($p['productos'] ?? []);
        if (isset($lines['status'])) return $lines;

        $note = mb_substr(trim((string) ($p['note'] ?? '')), 0, 255, 'UTF-8') ?: null;

        return $this->attempt(function () use ($id, $reason, $warehouse, $date, $lines, $note) {
            $folio = $this->transaction(function () use ($id, $reason, $warehouse, $date, $lines, $note) {
                $s = $this->qGetOutflow($id, $this->companyId(), $this->branchId(), true);

                if (!$s || $s['status'] !== 'applied') throw new InvStop('La salida cambió mientras la editabas: vuelve a abrirla.');

                $oldWh   = (int) $s['warehouse_id'];
                $newWh   = (int) $warehouse['id'];
                $movedAt = $this->qLinesMovedAt('detail_inventory_outflow', 'inventory_outflow_id', $id);
                $pairs   = [];

                // Lo que sacó regresa a su almacén y al lote de donde salió.
                foreach ($this->qOutflowLines($id) as $d) {
                    $this->stockMove($oldWh, (int) $d['product_id'], (float) $d['quantity']);

                    if ($d['stock_lot_id']) $this->must($this->qAddToLot((int) $d['stock_lot_id'], (float) $d['quantity']), 'updateSalida/lot');

                    $pairs[] = [(int) $d['product_id'], $oldWh];
                }

                $this->must($this->qDisableLines('detail_inventory_outflow', 'inventory_outflow_id', $id), 'updateSalida/disable');

                $total = 0.0;
                $units = 0.0;

                foreach ($lines as $l) {
                    $have = $this->qStockRow($newWh, $l['product_id'], true);
                    $have = $have ? round((float) $have['quantity'], 4) : 0.0;

                    if ($have + 0.00001 < $l['quantity']) {
                        throw new InvStop('Solo hay ' . $this->num(max(0, $have)) . ' ' . $l['unit'] . ' de «' . $l['name'] . '» en ' . $warehouse['name'] . '.');
                    }

                    $lot = $this->takeLots($newWh, $l['product_id'], $l['quantity']);

                    [$prev, $post] = $this->stockMove($newWh, $l['product_id'], -$l['quantity']);

                    $this->must($this->qCreateOutflowLine(
                        ['quantity', 'cost', 'subtotal', 'previous_stock', 'resulting_stock', 'inventory_outflow_id', 'product_id', 'stock_lot_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['subtotal'], $prev, $post, $id, $l['product_id'], $lot, 1]
                    ), 'updateSalida/line');

                    $total   += $l['subtotal'];
                    $units   += $l['quantity'];
                    $pairs[]  = [$l['product_id'], $newWh];
                }

                $this->must($this->qUpdateOutflow(
                    ['note', 'total_products', 'total_units', 'total_cost', 'operation_date', 'warehouse_id', 'outflow_reason_id', 'edited_user_id', 'edited_at = NOW()'],
                    [$note, count($lines), round($units, 4), round($total, 2), $date, $newWh, (int) $reason['id'], $this->userId(), $id]
                ), 'updateSalida');

                // En el kárdex van donde estaban los viejos y la cadena se rehace desde ahí.
                if ($movedAt) $this->must($this->qSetLinesMovedAt('detail_inventory_outflow', 'inventory_outflow_id', $id, $movedAt), 'updateSalida/moved');

                $this->kardexChains($pairs, $this->companyId());

                return $s['folio'];
            });

            $this->keyConsume('outflow-edit', $id);

            return $this->ok("Salida {$folio} actualizada.", ['folio' => $folio, 'id' => $id]);
        }, 'No se guardó ningún cambio. Intenta de nuevo.');
    }

    // Regresa lo que salió al almacén (y al lote del que salió primero).
    public function cancelSalida() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar salidas');
        if ($fail) return $fail;

        $id = $this->postId();

        if (!$this->keyAuthorized('outflow', $id)) return $this->fail(403, 'Confirma tu contraseña para cancelar la salida.');

        $reason = $this->textOrNull('reason');
        if ($reason === null) return $this->fail(400, 'Escribe por qué se cancela.');

        return $this->attempt(function () use ($id, $reason) {
            $folio = $this->transaction(function () use ($id, $reason) {
                $s = $this->qGetOutflow($id, $this->companyId(), $this->branchId(), true);

                if (!$s)                         throw new InvStop('Esa salida no existe en la sucursal.');
                if ($s['status'] !== 'applied')  throw new InvStop("La salida {$s['folio']} ya estaba cancelada.");
                if ((int) $s['is_system'] === 1) throw new InvStop('La creó el sistema: se cancela desde la venta o el surtido.');

                foreach ($this->qOutflowLines($id) as $d) {
                    [$prev, $post] = $this->stockMove((int) $s['warehouse_id'], (int) $d['product_id'], (float) $d['quantity']);

                    $this->must($this->qSetOutflowLineCancelStock((int) $d['id'], $prev, $post), 'cancelSalida/line');

                    if ($d['stock_lot_id']) $this->must($this->qAddToLot((int) $d['stock_lot_id'], (float) $d['quantity']), 'cancelSalida/lot');
                }

                $this->must($this->qUpdateOutflow(
                    ['status', 'cancelled_at = NOW()', 'cancelled_user_id', 'cancel_reason'],
                    ['cancelled', $this->userId(), $reason, $id]
                ), 'cancelSalida');

                return $s['folio'];
            });

            $this->keyConsume('outflow', $id);

            return $this->ok("Salida {$folio} cancelada: lo que salió regresó al almacén.");
        }, 'No se pudo cancelar. Intenta de nuevo.');
    }

    // -- Evidencia (foto) desde el detalle --

    public function saveSalidaEvidence() {
        $fail = $this->needBranch() ?: $this->need('create', 'subir evidencia');
        if ($fail) return $fail;

        $s = $this->qGetOutflow($this->postId(), $this->companyId(), $this->branchId());
        if (!$s) return $this->fail(404, 'Esa salida no existe en la sucursal.');
        if ($s['status'] === 'cancelled') return $this->fail(400, 'No se cambia la evidencia de una salida cancelada.');

        $b64 = $this->post('evidence_b64');

        if ($b64 === '' && (int) $s['is_loss'] === 1) return $this->fail(400, 'Una merma se queda con su foto: cámbiala en lugar de quitarla.');
        if ($b64 !== '' && !$this->decodePhoto($b64)) return $this->fail(400, 'La foto no se pudo leer. Usa JPG, PNG o WEBP de hasta 5 MB.');

        return $this->attempt(function () use ($s, $b64) {
            $url = $b64 === '' ? null : $this->writePhoto((int) $s['id'], $b64, 'salidas');

            $this->must($this->qUpdateOutflow(['evidence_url'], [$url, (int) $s['id']]), 'saveSalidaEvidence');

            return $this->ok($b64 === '' ? 'Evidencia eliminada.' : 'Evidencia actualizada.');
        }, 'No se pudo guardar la evidencia.');
    }
}

Permission::dispatch(new ctrl(), 'inv-salidas');
