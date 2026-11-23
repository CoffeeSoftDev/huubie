<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Entradas (folio ENT-KAF-0001): compra, producción, devolución, inventario
    inicial... Suma al almacén al guardarse; la Producción nace Pendiente y
    suma cuando alguien con «Editar» la confirma.

    Casillas: show (ver), create (capturar), producir (capturar producción),
    update (confirmar producción), cancel (cancelar, pide contraseña),
    ver-costos (costos e importes). */
class ctrl extends core {

    const SECTION = 'inv-entradas';
    const MAX_LINES = 200;

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->baseInit([
            'origins' => $this->originFilter(),
            'counts'  => ['pending' => $this->qCountPendingInflows($this->companyId(), $this->branchId())]
        ]);
    }

    // Tipos que puede capturar: sin «producir» no ve Producción; con solo «producir», solo esa.
    private function captureOrigins() {
        $create  = $this->can('create');
        $produce = $this->can('producir');

        return array_values(array_filter($this->qOrigins($this->companyId()), function ($o) use ($create, $produce) {
            if ((int) $o['is_system'] === 1) return false;

            return $o['code'] === 'PRODUCCION' ? $produce : $create;
        }));
    }

    private function originFilter() {
        return array_map(function ($o) {
            return ['id' => (int) $o['id'], 'valor' => $o['name']];
        }, $this->qOrigins($this->companyId()));
    }

    // Lo del modal de captura, leído al abrirlo (la existencia cambia todo el día).
    public function formOptions() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $origins = $this->captureOrigins();
        if (!$origins) return $this->fail(403, 'Tu rol no puede capturar entradas.');

        return [
            'status'    => 200,
            'today'     => $this->qNow()['today'],
            'costs'     => $this->costs(),
            'origins'   => array_map(function ($o) {
                return [
                    'id'       => (int) $o['id'],
                    'valor'    => $o['name'],
                    'code'     => $o['code'],
                    'supplier' => (int) $o['requires_supplier'],
                    'pending'  => (int) $o['starts_pending'],
                    'note'     => $o['description']
                ];
            }, $origins),
            'warehouses' => $this->warehouseOptions(),
            'suppliers'  => $this->qSuppliers($this->companyId(), $this->branchId()),
            'products'   => $this->captureProducts()
        ];
    }

    // -- Lista --

    /*  tab 'pending': las producciones por confirmar, sin importar la fecha.
        Sin «show», quien solo produce ve solo las de Producción. */
    public function lsInflows() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $originId = $this->selectOrNull('origin_id');

        if (!$this->can('show')) {
            if (!$this->can('producir')) return $this->fail(403, 'Tu rol no puede ver las entradas.');
            $originId = $this->productionOriginId();
        }

        $pending = $this->post('tab') === 'pending';
        $status  = $pending ? 'pending' : (in_array($this->post('status'), ['pending', 'applied', 'cancelled'], true) ? $this->post('status') : '');
        [$from, $to] = $pending ? ['2000-01-01', '2999-12-31'] : $this->period();

        $list  = $this->qListInflows($this->companyId(), $this->branchId(), $from, $to, $originId, $status);
        $users = $this->names($list, ['user_id']);
        $costs = $this->costs();
        $rows  = [];
        $total = 0.0;

        foreach ($list as $r) {
            if ($r['status'] !== 'cancelled') $total += (float) $r['total'];
            $rows[] = $this->inflowRow($r, $users, $costs);
        }

        return [
            'status'  => 200,
            'row'     => $rows,
            'summary' => array_merge(['docs' => count($list)], $costs ? ['total' => round($total, 2)] : []),
            'pending' => $this->qCountPendingInflows($this->companyId(), $this->branchId())
        ];
    }

    private function productionOriginId() {
        foreach ($this->qOrigins($this->companyId()) as $o) {
            if ($o['code'] === 'PRODUCCION') return (int) $o['id'];
        }

        return -1;
    }

    private function inflowRow($r, $users, $costs) {
        $id  = (int) $r['id'];
        $row = [
            'id'        => $id,
            'Folio'     => cellTitle($r['folio'], $r['invoice_folio'] ? 'Factura ' . $r['invoice_folio'] : ($r['note'] ?: '')),
            'Fecha'     => $this->dateCell($r['operation_date'], $r['created_at']),
            'Tipo'      => $this->colorChip($r['origin'] ?: 'Sin tipo', $r['origin_color']),
            'Proveedor' => $r['supplier'] ? h($r['supplier']) : '<span class="cp-celda-sub">—</span>',
            'Almacén'   => h($r['warehouse']),
            'Productos' => (int) $r['total_products']
        ];

        if ($costs) $row['Importe'] = moneyCell($r['total']);

        $row['Estado']  = $this->statusChip($r['status']);
        $row['Capturó'] = h($users[(int) $r['user_id']] ?? '—');
        $row['a']       = $this->inflowActions($r, $id);

        return $row;
    }

    private function inflowActions($r, $id) {
        $actions = [$this->rowButton('eye', 'Ver detalle', "entradas.show({$id})")];

        if ($r['status'] === 'pending' && $this->can('update')) {
            $actions[] = $this->rowButton('check', 'Confirmar producción', "entradas.confirm({$id})", 'ok');
        }

        if ($r['status'] !== 'cancelled' && $this->can('cancel')) {
            $actions[] = $this->rowButton('ban', 'Cancelar', "entradas.cancel({$id})", 'warn');
        }

        return $actions;
    }

    // -- Detalle --

    public function getInflow() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $r = $this->qGetInflow($this->postId(), $this->companyId(), $this->branchId());
        if (!$r) return $this->fail(404, 'Esa entrada no existe en la sucursal.');

        if (!$this->can('show') && !($this->can('producir') && $r['origin_code'] === 'PRODUCCION')) {
            return $this->fail(403, 'Tu rol no puede ver esta entrada.');
        }

        $costs = $this->costs();
        $users = $this->names([$r], ['user_id', 'confirmed_user_id', 'cancelled_user_id']);
        $lines = [];

        foreach ($this->qInflowLines((int) $r['id']) as $d) {
            $line = [
                'Clave'    => $d['sku'] ? h($d['sku']) : '<span class="cp-celda-sub">—</span>',
                'Producto' => h($d['name']),
                'Cantidad' => $this->qty($d['quantity'], $d['unit'] ?: 'PZA')
            ];

            if ($costs) {
                $line['Costo']   = money($d['cost']);
                $line['Importe'] = money($d['subtotal']);
            }

            $line['Lote']   = $d['batch_code'] ? h($d['batch_code']) : '<span class="cp-celda-sub">—</span>';
            $line['Caduca'] = $d['expires_at'] ? h(date('d/m/Y', strtotime($d['expires_at']))) : '<span class="cp-celda-sub">—</span>';

            if ($r['status'] !== 'pending') {
                $line['Antes'] = h($this->qtyPlain($d['previous_stock']));
                $line['Quedó'] = '<span class="font-semibold">' . h($this->qtyPlain($d['resulting_stock'])) . '</span>';
            }

            $lines[] = $line;
        }

        $name = function ($key) use ($r, $users) {
            return $r[$key] ? ($users[(int) $r[$key]] ?? '—') : '';
        };

        return [
            'status' => 200,
            'data'   => [
                'id'            => (int) $r['id'],
                'folio'         => $r['folio'],
                'status'        => $r['status'],
                'origin'        => $r['origin'],
                'origin_color'  => $r['origin_color'],
                'warehouse'     => $r['warehouse'],
                'supplier'      => $r['supplier'],
                'invoice_folio' => $r['invoice_folio'],
                'note'          => $r['note'],
                'date'          => date('d/m/Y', strtotime($r['operation_date'])),
                'created'       => date('d/m/Y H:i', strtotime($r['created_at'])),
                'user'          => $name('user_id'),
                'confirmed'     => $r['confirmed_at'] ? date('d/m/Y H:i', strtotime($r['confirmed_at'])) . ' · ' . $name('confirmed_user_id') : '',
                'cancelled'     => $r['cancelled_at'] ? date('d/m/Y H:i', strtotime($r['cancelled_at'])) . ' · ' . $name('cancelled_user_id') : '',
                'cancel_reason' => $r['cancel_reason'],
                'total'         => $costs ? round((float) $r['total'], 2) : null,
                'units'         => (float) $r['total_units'],
                'can_confirm'   => $r['status'] === 'pending' && $this->can('update'),
                'can_cancel'    => $r['status'] !== 'cancelled' && $this->can('cancel')
            ],
            'lines'  => $lines
        ];
    }

    private function qtyPlain($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }

    // -- Captura --

    public function addInflow() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $origin = null;

        foreach ($this->captureOrigins() as $o) {
            if ((int) $o['id'] === $this->postId('origin_id')) $origin = $o;
        }

        if (!$origin) return $this->fail(403, 'Elige un tipo de entrada que tu rol pueda capturar.');

        $warehouse = $this->ownWarehouse($this->postId('warehouse_id'));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén donde entra.');

        $today = $this->qNow()['today'];
        $date  = $this->dateOrNull($this->post('operation_date'));

        if (!$date)          return $this->fail(400, 'Escribe la fecha de la entrada.');
        if ($date > $today)  return $this->fail(400, 'La fecha no puede ser futura.');

        $supplier = $this->supplierInput((int) $origin['requires_supplier'] === 1);
        if (isset($supplier['status'])) return $supplier;

        $lines = $this->linesInput($date);
        if (isset($lines['status'])) return $lines;

        $pending = (int) $origin['starts_pending'] === 1;

        return $this->attempt(function () use ($origin, $warehouse, $date, $supplier, $lines, $pending) {
            $folio = $this->transaction(function () use ($origin, $warehouse, $date, $supplier, $lines, $pending) {
                $supplierId = $supplier['id'];

                if ($supplierId === null && $supplier['name'] !== '') {
                    $this->must($this->qCreateSupplier(
                        ['name', 'company_id', 'branch_id', 'active'],
                        [$supplier['name'], $this->companyId(), null, 1]
                    ), 'addInflow/supplier');

                    $supplierId = $this->newId('addInflow/supplier');
                }

                $folio = $this->nextFolio('ENT');
                $total = 0.0;
                $units = 0.0;

                foreach ($lines as $l) {
                    $total += $l['subtotal'];
                    $units += $l['quantity'];
                }

                $this->must($this->qCreateInflow(
                    ['folio', 'note', 'invoice_folio', 'total_products', 'total_units', 'subtotal', 'tax', 'total', 'operation_date',
                     'status', 'user_id', 'company_id', 'branch_id', 'warehouse_id', 'inflow_origin_id', 'supplier_id', 'active'],
                    [$folio, $this->textOrNull('note'), $this->textOrNull('invoice_folio', 50), count($lines), round($units, 4), round($total, 2), 0, round($total, 2), $date,
                     $pending ? 'pending' : 'applied', $this->userId(), $this->companyId(), $this->branchId(), (int) $warehouse['id'], (int) $origin['id'], $supplierId, 1]
                ), 'addInflow');

                $inflowId = $this->newId('addInflow');

                foreach ($lines as $l) {
                    $this->must($this->qCreateInflowLine(
                        ['quantity', 'cost', 'tax', 'subtotal', 'batch_code', 'expires_at', 'inventory_inflow_id', 'product_id', 'active'],
                        [$l['quantity'], $l['cost'], 0, $l['subtotal'], $l['batch_code'] ?? ($l['lots'] ? $folio : null), $l['expires_at'], $inflowId, $l['product_id'], 1]
                    ), 'addInflow/line');
                }

                if (!$pending) {
                    $this->applyInflow(
                        $this->qGetInflow($inflowId, $this->companyId(), $this->branchId(), true),
                        $this->qInflowLines($inflowId)
                    );
                }

                return $folio;
            });

            return $this->ok($pending ? "Producción {$folio} guardada. Suma al almacén cuando se confirme." : "Entrada {$folio} guardada.", ['folio' => $folio]);
        }, 'No se pudo guardar la entrada. Intenta de nuevo.');
    }

    // ['id' => int|null, 'name' => ''] o la respuesta de error.
    private function supplierInput($required) {
        $id   = $this->selectOrNull('supplier_id');
        $name = trim(preg_replace('/\s+/u', ' ', $this->post('supplier_name')));

        if ($id !== null) {
            $own = array_map('intval', array_column($this->qSuppliers($this->companyId(), $this->branchId()), 'id'));
            if (!in_array($id, $own, true)) return $this->fail(400, 'Ese proveedor no es de la empresa.');

            return ['id' => $id, 'name' => ''];
        }

        if ($name !== '') {
            foreach ($this->qSuppliers($this->companyId(), $this->branchId()) as $s) {
                if (mb_strtolower($s['valor'], 'UTF-8') === mb_strtolower($name, 'UTF-8')) return ['id' => (int) $s['id'], 'name' => ''];
            }

            return ['id' => null, 'name' => mb_substr($name, 0, 160, 'UTF-8')];
        }

        return $required ? $this->fail(400, 'Este tipo de entrada pide proveedor.') : ['id' => null, 'name' => ''];
    }

    /*  Los renglones (JSON en lines): product_id, quantity, cost, batch_code,
        expires_at. Sin «ver-costos» el costo es el último del Catálogo. Si el
        producto lleva lotes, la caducidad sale de la que escribieron o de su
        vida útil; sin ninguna de las dos no se guarda. */
    private function linesInput($date) {
        $raw = $this->postedJson('lines');

        if (!$raw)                         return $this->fail(400, 'Agrega al menos un producto.');
        if (count($raw) > self::MAX_LINES) return $this->fail(400, 'Son demasiados renglones: máximo ' . self::MAX_LINES . ' por entrada.');

        $products = array_column($this->products(), null, 'id');
        $costs    = $this->costs();
        $lines    = [];

        foreach ($raw as $item) {
            $p = $products[(int) ($item['product_id'] ?? 0)] ?? null;
            if (!$p) return $this->fail(400, 'Uno de los productos ya no lleva inventario en la sucursal. Vuelve a abrir la captura.');

            $qty = round((float) ($item['quantity'] ?? 0), 4);
            $bad = $this->badQuantity($qty, $p);
            if ($bad) return $this->fail(400, $bad);

            $cost = $costs ? (float) ($item['cost'] ?? 0) : (float) $p['cost'];
            if ($cost < 0) return $this->fail(400, 'El costo de «' . $p['name'] . '» no puede ser negativo.');

            $lots    = (int) $p['track_lots'] === 1;
            $batch   = $lots ? mb_substr(trim((string) ($item['batch_code'] ?? '')), 0, 40, 'UTF-8') : '';
            $expires = $lots ? $this->dateOrNull($item['expires_at'] ?? '') : null;

            if ($lots && !$expires && $p['shelf_life_days'] !== null && (int) $p['shelf_life_days'] > 0) {
                $expires = date('Y-m-d', strtotime($date . ' +' . (int) $p['shelf_life_days'] . ' days'));
            }

            if ($lots && !$expires) return $this->fail(400, '«' . $p['name'] . '» lleva caducidad: escribe la fecha.');
            if ($lots && $expires < $date) return $this->fail(400, 'La caducidad de «' . $p['name'] . '» es anterior a la fecha de la entrada.');

            $lines[] = [
                'product_id' => (int) $p['id'],
                'quantity'   => $qty,
                'cost'       => round($cost, 4),
                'subtotal'   => round($qty * $cost, 2),
                'lots'       => $lots,
                'batch_code' => $batch !== '' ? $batch : null,
                'expires_at' => $expires
            ];
        }

        return $lines;
    }

    // -- Confirmar producción --

    public function confirmInflow() {
        $fail = $this->needBranch() ?: $this->need('update', 'confirmar la producción');
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $folio = $this->transaction(function () use ($id) {
                $r = $this->qGetInflow($id, $this->companyId(), $this->branchId(), true);

                if (!$r)                       throw new InvStop('Esa entrada no existe en la sucursal.');
                if ($r['status'] !== 'pending') throw new InvStop("La entrada {$r['folio']} ya no está pendiente.");

                $this->applyInflow($r, $this->qInflowLines($id));

                $this->must($this->qUpdateInflow(
                    ['status', 'confirmed_at = NOW()', 'confirmed_user_id'],
                    ['applied', $this->userId(), $id]
                ), 'confirmInflow');

                return $r['folio'];
            });

            return $this->ok("Producción {$folio} confirmada: ya está en el almacén.");
        }, 'No se pudo confirmar. Intenta de nuevo.');
    }

    // -- Cancelar --

    /*  Pendiente: solo cambia de estado. Aplicada: resta lo que sumó; si ya se
        usó parte (no alcanza la existencia) no se cancela. El último costo del
        Catálogo no se regresa. */
    public function cancelInflow() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar entradas');
        if ($fail) return $fail;

        $reason = $this->textOrNull('reason');
        if ($reason === null) return $this->fail(400, 'Escribe por qué se cancela.');

        $key = $this->needKey('cancelar');
        if ($key) return $key;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $reason) {
            $folio = $this->transaction(function () use ($id, $reason) {
                $r = $this->qGetInflow($id, $this->companyId(), $this->branchId(), true);

                if (!$r)                         throw new InvStop('Esa entrada no existe en la sucursal.');
                if ($r['status'] === 'cancelled') throw new InvStop("La entrada {$r['folio']} ya estaba cancelada.");

                if ($r['status'] === 'applied') {
                    foreach ($this->qInflowLines($id) as $d) {
                        $qty   = (float) $d['quantity'];
                        $stock = $this->qStockRow((int) $r['warehouse_id'], (int) $d['product_id'], true);
                        $have  = $stock ? (float) $stock['quantity'] : 0;

                        if ($have + 0.00001 < $qty) {
                            throw new InvStop('Ya se usó parte de «' . $d['name'] . '»: hay ' . $this->qtyPlain($have) . ' y la entrada sumó ' . $this->qtyPlain($qty) . '. Registra una salida en lugar de cancelar.');
                        }

                        [$prev, $post] = $this->stockMove((int) $r['warehouse_id'], (int) $d['product_id'], -$qty);

                        $this->must($this->qSetInflowLineCancelStock((int) $d['id'], $prev, $post), 'cancelInflow/line');

                        $lot = $this->qLotOfDetail((int) $d['id']);
                        if ($lot) $this->must($this->qSetLot((int) $lot['id'], max(0, round((float) $lot['quantity'] - $qty, 4))), 'cancelInflow/lot');
                    }
                }

                $this->must($this->qUpdateInflow(
                    ['status', 'cancelled_at = NOW()', 'cancelled_user_id', 'cancel_reason'],
                    ['cancelled', $this->userId(), $reason, $id]
                ), 'cancelInflow');

                return $r['folio'];
            });

            return $this->ok("Entrada {$folio} cancelada.");
        }, 'No se pudo cancelar. Intenta de nuevo.');
    }
}

Permission::dispatch(new ctrl(), 'inv-entradas');
