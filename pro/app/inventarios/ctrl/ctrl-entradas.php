<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Entradas (folio ENT-KAF-0001): compra, producción, devolución, inventario
    inicial... La interfaz es la de inventory/operacion/almacen/entradas (visor
    con KPIs y detalle a la derecha; captura entrada-form.js), aplicada a los
    productos del Catálogo de pro. Por eso los opc y las respuestas tienen los
    nombres de inventory (lsEntradas, showEntradas, getEntrada, saveEntrada...).

    Suma al almacén al guardarse; la Producción nace Pendiente y suma cuando
    alguien con «Editar» la confirma (con lo que de verdad salió).

    Casillas: show (ver), create (capturar), producir (capturar producción),
    update (confirmar producción), cancel (cancelar, pide contraseña),
    ver-costos (costos e importes). */
class ctrl extends core {

    const SECTION     = 'inv-entradas';
    const MAX_LINES   = 200;
    const VOUCHER_MAX = 4194304;

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $capture = array_column($this->captureOrigins(), 'id');

        return $this->baseInit([
            'branch_id'        => $this->branchId(),
            'sucursales'       => $this->branchOptions(),
            'origenes_entrada' => array_map(function ($o) use ($capture) {
                return [
                    'id'                => (string) $o['id'],
                    'valor'             => $o['name'],
                    'code'              => $o['code'],
                    'requires_supplier' => (int) $o['requires_supplier'],
                    'starts_pending'    => (int) $o['starts_pending'],
                    'icon'              => $o['icon'],
                    'description'       => $o['description'],
                    'capture'           => in_array($o['id'], $capture, true)
                ];
            }, $this->qOrigins($this->companyId())),
            'estados_entrada'  => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'Activas',   'valor' => 'Activas (sin Cancelada)'],
                ['id' => 'Aplicada',  'valor' => 'Aplicada'],
                ['id' => 'Pendiente', 'valor' => 'Pendiente'],
                ['id' => 'Cancelada', 'valor' => 'Cancelada']
            ],
            'almacenes'        => $this->warehouseList(),
            'areas'            => $this->areaList(),
            'categorias'       => $this->categoryList(),
            'unidades'         => $this->unitList(),
            'proveedores'      => $this->qSuppliers($this->companyId(), $this->branchId()),
            'productos'        => $this->catalogProducts(),
            'costs'            => $this->costs(),
            // {almacén: día del último conteo aplicado}: la captura no deja fechas anteriores.
            'ajustes'          => (object) $this->qLastAdjustmentDates(array_map('intval', array_column($this->warehouses(), 'id')))
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

    private function productionOriginId() {
        foreach ($this->qOrigins($this->companyId()) as $o) {
            if ($o['code'] === 'PRODUCCION') return (int) $o['id'];
        }

        return -1;
    }

    // -- Lista y KPIs --

    /*  Los filtros del visor: Rango (fi, ff), Tipo de entrada (origin_id) y
        Estado (Activas, Aplicada, Pendiente, Cancelada). La sucursal es la de
        la barra. Sin «show», quien solo produce ve solo las de Producción. */
    private function filtered() {
        $originId = $this->selectOrNull('origin_id');

        if (!$this->can('show')) {
            if (!$this->can('producir')) return null;
            $originId = $this->productionOriginId();
        }

        $status = [
            'Activas'   => 'active',
            'Aplicada'  => 'applied',
            'Pendiente' => 'pending',
            'Cancelada' => 'cancelled'
        ][$this->post('status')] ?? '';

        [$from, $to] = $this->period();

        return $this->qListInflows($this->companyId(), $this->branchId(), $from, $to, $originId, $status);
    }

    public function lsEntradas() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $list = $this->filtered();
        if ($list === null) return $this->fail(403, 'Tu rol no puede ver las entradas.');

        $users = $this->names($list, ['user_id']);
        $costs = $this->costs();
        $rows  = [];

        foreach ($list as $r) {
            $id   = (int) $r['id'];
            $open = "app.selectEntrada('" . h($r['folio']) . "', {$id})";
            $row  = [
                'id'              => $id,
                'Folio'           => ['html' => $this->folioLink($r['folio'], $open)],
                'Fecha'           => $this->dateTime($r['operation_date'], $r['created_at']),
                'Tipo de entrada' => $this->badge($r['origin'] ?: 'Sin tipo', $r['origin_color'], null, $r['origin_icon']),
                'Sucursal'        => h($r['branch'] ?: '-'),
                'Origen'          => $this->placeCell($r['warehouse'], $r['area'])
            ];

            if ($costs) $row['Costo'] = $this->money($r['total']);

            $row['Estado']     = $this->statusBadge($r['status']);
            $row['Registrado'] = h($users[(int) $r['user_id']] ?? '-');
            $row['a']          = [$this->rowIcon('eye', $open, 'Ver detalle')];

            $rows[] = $row;
        }

        return ['status' => 200, 'row' => $rows];
    }

    // Almacén y, en gris, el área: «Almacén Cuarta / Refrigerador».
    private function placeCell($warehouse, $area) {
        return h($warehouse ?: '-') . ($area ? ' <span class="text-gray-400">/ ' . h($area) . '</span>' : '');
    }

    // Las tarjetas: entradas, costo, unidades y aplicadas (las canceladas no suman).
    public function showEntradas() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $list = $this->filtered() ?: [];
        $live = array_filter($list, function ($r) { return $r['status'] !== 'cancelled'; });

        return [
            'status' => 200,
            'costs'  => $this->costs(),
            'counts' => [
                'total_entradas'  => count($list),
                'total_costo'     => $this->costs() ? round(array_sum(array_column($live, 'total')), 2) : null,
                'total_unidades'  => round(array_sum(array_column($live, 'total_units')), 4),
                'total_aplicadas' => count(array_filter($list, function ($r) { return $r['status'] === 'applied'; })),
                'total_pendientes' => count(array_filter($list, function ($r) { return $r['status'] === 'pending'; }))
            ]
        ];
    }

    // El desglose de cada tarjeta (kpi = el id de la tarjeta).
    public function lsKpiDetail() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $list = array_values(array_filter($this->filtered() ?: [], function ($r) { return $r['status'] !== 'cancelled'; }));

        switch ($this->post('kpi')) {
            case 'kpiEntradas':  $row = $this->kpiByOrigin($list); break;
            case 'kpiCosto':     $row = $this->kpiByProduct($list, 'cost'); break;
            case 'kpiUnidades':  $row = $this->kpiByProduct($list, 'units'); break;
            case 'kpiAplicadas': $row = $this->kpiApplied($list); break;
            default:             return $this->fail(400, 'Indicador no reconocido.');
        }

        return ['status' => 200, 'row' => $row];
    }

    private function kpiByOrigin($list) {
        $costs  = $this->costs();
        $groups = [];

        foreach ($list as $r) {
            $key = (int) $r['inflow_origin_id'];

            if (!isset($groups[$key])) $groups[$key] = ['name' => $r['origin'] ?: 'Sin tipo', 'color' => $r['origin_color'], 'icon' => $r['origin_icon'], 'docs' => 0, 'units' => 0, 'cost' => 0];

            $groups[$key]['docs']++;
            $groups[$key]['units'] += (float) $r['total_units'];
            $groups[$key]['cost']  += (float) $r['total'];
        }

        usort($groups, function ($a, $b) { return $b['docs'] <=> $a['docs']; });

        $total = count($list);
        $rows  = [];

        foreach ($groups as $i => $g) {
            $row = [
                'id'              => $i + 1,
                'Tipo de entrada' => $this->badge($g['name'], $g['color'], null, $g['icon']),
                'Entradas'        => $g['docs'],
                'Unidades'        => $this->num($g['units'])
            ];
            if ($costs) $row['Costo'] = $this->money($g['cost']);
            $row['Participación'] = $this->percent($g['docs'], $total);

            $rows[] = $row;
        }

        if ($rows) {
            $foot = ['Tipo de entrada' => 'Total', 'Entradas' => $total, 'Unidades' => $this->num(array_sum(array_column($groups, 'units')))];
            if ($costs) $foot['Costo'] = $this->money(array_sum(array_column($groups, 'cost')));
            $foot['Participación'] = $this->percent($total, $total);

            $rows[] = $this->totalRow($foot);
        }

        return $rows;
    }

    private function kpiByProduct($list, $order) {
        $costs    = $this->costs();
        $products = $this->qInflowProducts(array_map('intval', array_column($list, 'id')));
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
            if ($field === 'cost') $row['Costo'] = $this->money($p['cost']);
            $row['Participación'] = $this->percent($p[$field], $total);

            $rows[] = $row;
        }

        if ($rows) {
            $foot = ['Producto' => 'Total', 'Unidad' => '', 'Cantidad' => $this->num(array_sum(array_column($products, 'units')))];
            if ($field === 'cost') $foot['Costo'] = $this->money($total);
            $foot['Participación'] = $this->percent($total, $total);

            $rows[] = $this->totalRow($foot);
        }

        return $rows;
    }

    private function kpiApplied($list) {
        $costs = $this->costs();
        $rows  = [];
        $units = 0.0;
        $cost  = 0.0;

        foreach ($list as $r) {
            if ($r['status'] !== 'applied') continue;

            $row = [
                'id'              => (int) $r['id'],
                'Folio'           => h($r['folio']),
                'Fecha'           => $this->dateTime($r['operation_date']),
                'Tipo de entrada' => $this->badge($r['origin'] ?: 'Sin tipo', $r['origin_color'], null, $r['origin_icon']),
                'Sucursal'        => h($r['branch'] ?: '-'),
                'Unidades'        => $this->num($r['total_units'])
            ];
            if ($costs) $row['Costo'] = $this->money($r['total']);

            $units += (float) $r['total_units'];
            $cost  += (float) $r['total'];
            $rows[] = $row;
        }

        if ($rows) {
            $foot = ['Folio' => 'Total', 'Fecha' => '', 'Tipo de entrada' => '', 'Sucursal' => '', 'Unidades' => $this->num($units)];
            if ($costs) $foot['Costo'] = $this->money($cost);

            $rows[] = $this->totalRow($foot);
        }

        return $rows;
    }

    // -- Detalle (el visor de la derecha) --

    public function getEntrada() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $r = $this->qGetInflow($this->postId(), $this->companyId(), $this->branchId());
        if (!$r) return $this->fail(404, 'Esa entrada no existe en la sucursal.');

        if (!$this->can('show') && !($this->can('producir') && $r['origin_code'] === 'PRODUCCION')) {
            return $this->fail(403, 'Tu rol no puede ver esta entrada.');
        }

        $costs = $this->costs();
        $users = $this->names([$r], ['user_id', 'confirmed_user_id', 'cancelled_user_id']);
        $name  = function ($key) use ($r, $users) {
            return $r[$key] ? ($users[(int) $r[$key]] ?? '-') : '';
        };

        return [
            'status' => 200,
            'costs'  => $costs,
            'header' => [
                'id'                  => (int) $r['id'],
                'folio'               => $r['folio'],
                'inflow_origin_id'    => (int) $r['inflow_origin_id'],
                'branch_id'           => (int) $r['branch_id'],
                'warehouse_id'        => (int) $r['warehouse_id'],
                'warehouse_area_id'   => $r['warehouse_area_id'] ? (int) $r['warehouse_area_id'] : '',
                'supplier_id'         => $r['supplier_id'] ? (int) $r['supplier_id'] : '',
                'operation_date'      => $r['operation_date'],
                'adjustment_date'     => $this->qLastAdjustmentDates([(int) $r['warehouse_id']])[(int) $r['warehouse_id']] ?? '',
                'edited_user_name'    => $r['edited_user_id'] ? ($this->qUserNames([(int) $r['edited_user_id']])[(int) $r['edited_user_id']] ?? '') : '',
                'edited_at'           => $r['edited_at'],
                'date_inflow'         => $r['operation_date'] . ' ' . substr($r['created_at'], 11, 8),
                'status'              => $this->statusName($r['status']),
                'origin_name'         => $r['origin'],
                'origin_code'         => $r['origin_code'],
                'is_system'           => (int) $r['origin_system'],
                'origin_badge'        => $this->badge($r['origin'] ?: 'Sin tipo', $r['origin_color'], null, $r['origin_icon']),
                'branch_name'         => $r['branch'],
                'warehouse_name'      => $r['warehouse'],
                'area_name'           => $r['area'],
                'supplier_name'       => $r['supplier'],
                'invoice_folio'       => $r['invoice_folio'],
                'user_name'           => $name('user_id'),
                'confirmed_user_name' => $name('confirmed_user_id'),
                'confirmed_at'        => $r['confirmed_at'],
                'cancelled_user_name' => $name('cancelled_user_id'),
                'cancelled_at'        => $r['cancelled_at'],
                'cancel_reason'       => $r['cancel_reason'],
                'note'                => $r['note'],
                'voucher_url'         => $r['voucher_url'] ? '/' . ltrim($r['voucher_url'], '/') : ''
            ],
            'detail' => array_map(function ($d) use ($costs) {
                return [
                    'id'              => (int) $d['id'],
                    'product_id'      => (int) $d['product_id'],
                    'product_name'    => $d['name'],
                    'sku'             => $d['sku'],
                    'unit'            => $d['unit'] ?: 'PZA',
                    'decimals'        => (int) $d['decimals'],
                    'quantity'        => (float) $d['quantity'],
                    'cost'            => $costs ? (float) $d['cost'] : 0,
                    'tax'             => $costs ? (float) $d['tax'] : 0,
                    'previous_stock'  => (float) $d['previous_stock'],
                    'resulting_stock' => (float) $d['resulting_stock'],
                    'batch_code'      => $d['batch_code'],
                    'expires_at'      => $d['expires_at'],
                    'image'           => $this->photoUrl($d['image'])
                ];
            }, $this->qInflowLines((int) $r['id']))
        ];
    }

    // -- Lo que pide la captura --

    public function lsStockByWarehouse() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return ['status' => 200, 'stock' => (object) $this->stockMap($this->postId('warehouse_id'))];
    }

    // Proveedor nuevo desde la captura. Si ya existe con ese nombre, se reutiliza.
    public function createSupplier() {
        $fail = $this->needBranch() ?: $this->need('create', 'dar de alta proveedores');
        if ($fail) return $fail;

        $name  = trim(preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone = preg_replace('/\D/', '', $this->post('phone'));
        $email = $this->post('email');

        if ($name === '') return $this->fail(400, 'El nombre del proveedor es obligatorio.');
        if (mb_strlen($phone) > 10) return $this->fail(400, 'El teléfono lleva máximo 10 dígitos.');
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) return $this->fail(400, 'Ese correo no es válido.');

        foreach ($this->qSuppliers($this->companyId(), $this->branchId()) as $s) {
            if (mb_strtolower($s['valor'], 'UTF-8') === mb_strtolower($name, 'UTF-8')) {
                return $this->ok('El proveedor ya existía, se reutilizó.', ['id' => (int) $s['id'], 'valor' => $s['valor'], 'existed' => true]);
            }
        }

        return $this->attempt(function () use ($name, $phone, $email) {
            $id = $this->transaction(function () use ($name, $phone, $email) {
                $this->must($this->qCreateSupplier(
                    ['name', 'contact_name', 'phone', 'email', 'company_id', 'active'],
                    [mb_substr($name, 0, 160, 'UTF-8'), $this->textOrNull('contact_name', 120), $phone ?: null, $email ?: null, $this->companyId(), 1]
                ), 'createSupplier');

                return $this->newId('createSupplier');
            });

            return $this->ok('Proveedor creado.', ['id' => $id, 'valor' => $name, 'existed' => false]);
        }, 'No se pudo crear el proveedor.');
    }

    // El formulario previo de «Agregar Entrada»: tipo, sucursal, almacén y fecha.
    public function verifyNuevaEntrada() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $origin = $this->captureOrigin($this->postId('inflow_origin_id'));
        if (!$origin) return $this->fail(400, 'Elige un tipo de entrada que tu rol pueda capturar.');

        if ($this->postId('branch_id') !== $this->branchId()) return $this->fail(400, 'La entrada es de la sucursal de arriba: cámbiala ahí.');
        if (!$this->ownWarehouse($this->postId('warehouse_id'))) return $this->fail(400, 'Elige un almacén de la sucursal.');

        $bad = $this->badDate($this->post('date_inflow'));
        if ($bad) return $this->fail(400, $bad);

        $supplierId = $this->postId('supplier_id');
        $needs      = (int) $origin['requires_supplier'] === 1;

        if ($needs && !$this->ownSupplier($supplierId)) return $this->fail(400, 'Este tipo de entrada pide elegir un proveedor.');

        return [
            'status' => 200,
            'data'   => [
                'origen'       => (string) $origin['id'],
                'branch_id'    => (string) $this->branchId(),
                'warehouse_id' => (string) $this->postId('warehouse_id'),
                'fecha'        => $this->post('date_inflow'),
                'supplier_id'  => $needs ? (string) $supplierId : ''
            ]
        ];
    }

    private function captureOrigin($id) {
        foreach ($this->captureOrigins() as $o) {
            if ((int) $o['id'] === (int) $id) return $o;
        }

        return null;
    }

    private function ownSupplier($id) {
        return $id > 0 && in_array((int) $id, array_map('intval', array_column($this->qSuppliers($this->companyId(), $this->branchId()), 'id')), true);
    }

    // -- Guardar --

    /*  payload (JSON): inflow_origin_id, branch_id, warehouse_id,
        warehouse_area_id, supplier_id, date_inflow, note, invoice_folio,
        voucher_b64 y productos [{product_id, quantity, cost, tax,
        price_without_tax}]. cost = costo CON impuesto (lo que se pagó, el que
        se captura); la base sin impuesto sale de ahí. */
    public function saveEntrada() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $p = json_decode($this->post('payload'), true);
        if (!is_array($p)) return $this->fail(400, 'No llegaron los datos de la entrada.');

        $origin = $this->captureOrigin((int) ($p['inflow_origin_id'] ?? 0));
        if (!$origin) return $this->fail(403, 'Elige un tipo de entrada que tu rol pueda capturar.');

        if ((int) ($p['branch_id'] ?? 0) !== $this->branchId()) return $this->fail(400, 'La entrada es de la sucursal de arriba: cámbiala ahí.');

        $warehouse = $this->ownWarehouse((int) ($p['warehouse_id'] ?? 0));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén donde entra.');

        $area = (int) ($p['warehouse_area_id'] ?? 0) ?: null;
        if ($area !== null && !in_array($area, array_map('intval', array_column($this->qAreaOptions([(int) $warehouse['id']]), 'id')), true)) {
            return $this->fail(400, 'Esa área no es de ese almacén.');
        }

        $date = (string) ($p['date_inflow'] ?? '');
        $bad  = $this->badDate($date) ?: $this->adjustmentBlocks((int) $warehouse['id'], $date);
        if ($bad) return $this->fail(400, $bad);

        $supplierId = (int) ($p['supplier_id'] ?? 0) ?: null;
        if ($supplierId !== null && !$this->ownSupplier($supplierId)) return $this->fail(400, 'Ese proveedor no es de la empresa.');
        if ((int) $origin['requires_supplier'] === 1 && $supplierId === null) return $this->fail(400, 'Este tipo de entrada pide proveedor.');

        $voucher = (string) ($p['voucher_b64'] ?? '');
        if ($voucher !== '' && !$this->decodeVoucher($voucher)) return $this->fail(400, 'El comprobante debe ser una imagen o un PDF de hasta 4 MB.');

        $lines = $this->linesInput($p['productos'] ?? [], $date);
        if (isset($lines['status'])) return $lines;

        $pending = (int) $origin['starts_pending'] === 1;
        $note    = mb_substr(trim((string) ($p['note'] ?? '')), 0, 255, 'UTF-8') ?: null;
        $invoice = mb_substr(trim((string) ($p['invoice_folio'] ?? '')), 0, 50, 'UTF-8') ?: null;

        return $this->attempt(function () use ($origin, $warehouse, $area, $date, $supplierId, $lines, $pending, $note, $invoice, $voucher) {
            $saved = $this->transaction(function () use ($origin, $warehouse, $area, $date, $supplierId, $lines, $pending, $note, $invoice, $voucher) {
                $folio = $this->nextFolio('ENT');
                $t     = $this->totals($lines);

                $this->must($this->qCreateInflow(
                    ['folio', 'note', 'invoice_folio', 'total_products', 'total_units', 'subtotal', 'tax', 'total', 'operation_date',
                     'status', 'user_id', 'company_id', 'branch_id', 'warehouse_id', 'warehouse_area_id', 'inflow_origin_id', 'supplier_id', 'active'],
                    [$folio, $note, $invoice, count($lines), $t['units'], $t['subtotal'], $t['tax'], $t['total'], $date,
                     $pending ? 'pending' : 'applied', $this->userId(), $this->companyId(), $this->branchId(), (int) $warehouse['id'], $area, (int) $origin['id'], $supplierId, 1]
                ), 'saveEntrada');

                $inflowId = $this->newId('saveEntrada');

                foreach ($lines as $l) {
                    $this->must($this->qCreateInflowLine(
                        ['quantity', 'cost', 'tax', 'subtotal', 'batch_code', 'expires_at', 'inventory_inflow_id', 'product_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['tax'], $l['subtotal'], $l['lots'] ? $folio : null, $l['expires_at'], $inflowId, $l['product_id'], 1]
                    ), 'saveEntrada/line');
                }

                if (!$pending) {
                    $this->applyInflow(
                        $this->qGetInflow($inflowId, $this->companyId(), $this->branchId(), true),
                        $this->qInflowLines($inflowId)
                    );
                }

                if ($voucher !== '') {
                    $this->must($this->qUpdateInflow(['voucher_url'], [$this->storeVoucher($folio, $voucher), $inflowId]), 'saveEntrada/voucher');
                }

                return ['folio' => $folio, 'id' => $inflowId];
            });

            return $this->ok(
                $pending ? "Orden de producción {$saved['folio']} registrada: suma al almacén cuando se confirme." : "Entrada {$saved['folio']} registrada.",
                $saved + ['pending' => $pending]
            );
        }, 'No se pudo registrar la entrada. Intenta de nuevo.');
    }

    /*  Los renglones. Sin «ver-costos» el costo es el del Catálogo. Si el
        producto lleva lotes, el lote es el folio y la caducidad sale de su vida
        útil (sin vida útil, el lote queda sin caducidad). */
    private function linesInput($raw, $date) {
        if (!is_array($raw) || !$raw)      return $this->fail(400, 'Agrega al menos un producto.');
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
            $tax  = $costs ? (float) ($item['tax'] ?? 0) : 0.0;

            if ($cost < 0 || $tax < 0) return $this->fail(400, 'El costo y el impuesto de «' . $p['name'] . '» no pueden ser negativos.');

            $lots    = (int) $p['track_lots'] === 1;
            $shelf   = (int) $p['shelf_life_days'];
            $expires = $lots && $shelf > 0 ? date('Y-m-d', strtotime($date . ' +' . $shelf . ' days')) : null;

            $lines[] = [
                'product_id' => (int) $p['id'],
                'quantity'   => $qty,
                'cost'       => round($cost, 4),
                'tax'        => round($tax, 2),
                'base'       => $tax > 0 ? $cost / (1 + $tax / 100) : $cost,
                'subtotal'   => round($qty * $cost, 2),
                'lots'       => $lots,
                'expires_at' => $expires
            ];
        }

        return $lines;
    }

    // Unidades, subtotal (sin impuesto), impuesto y total de los renglones.
    private function totals($lines) {
        $units = $base = $total = 0.0;

        foreach ($lines as $l) {
            $units += $l['quantity'];
            $base  += $l['quantity'] * $l['base'];
            $total += $l['quantity'] * $l['cost'];
        }

        return [
            'units'    => round($units, 4),
            'subtotal' => round($base, 2),
            'tax'      => round($total - $base, 2),
            'total'    => round($total, 2)
        ];
    }

    // -- Confirmar producción --

    /*  quantities (JSON): {renglón: lo que de verdad salió}. Sin dato, lo
        capturado. Un renglón en 0 no mueve nada. */
    public function confirmEntrada() {
        $fail = $this->needBranch() ?: $this->need('update', 'confirmar la producción');
        if ($fail) return $fail;

        $id   = $this->postId();
        $real = json_decode($this->post('quantities', '{}'), true);
        $real = is_array($real) ? $real : [];

        return $this->attempt(function () use ($id, $real) {
            $done = $this->transaction(function () use ($id, $real) {
                $r = $this->qGetInflow($id, $this->companyId(), $this->branchId(), true);

                if (!$r)                        throw new InvStop('Esa entrada no existe en la sucursal.');
                if ($r['status'] !== 'pending') throw new InvStop("La entrada {$r['folio']} no está pendiente de confirmar.");

                $move  = [];
                $units = $base = $total = 0.0;

                foreach ($this->qInflowLines($id) as $d) {
                    $qty = array_key_exists((string) $d['id'], $real) ? round((float) $real[(string) $d['id']], 4) : (float) $d['quantity'];
                    $unit = $d['unit'] ?: 'PZA';

                    if ($qty < 0) throw new InvStop("La cantidad de «{$d['name']}» no puede ser negativa.");
                    if ((int) $d['decimals'] !== 1 && floor($qty) != $qty) throw new InvStop("«{$d['name']}» se cuenta en {$unit}: sin decimales.");

                    $cost = (float) $d['cost'];
                    $tax  = (float) $d['tax'];

                    $this->must($this->qSetInflowLineQty((int) $d['id'], $qty, round($qty * $cost, 2)), 'confirmEntrada/qty');

                    $units += $qty;
                    $total += $qty * $cost;
                    $base  += $qty * ($tax > 0 ? $cost / (1 + $tax / 100) : $cost);

                    if ($qty > 0) $move[] = array_merge($d, ['quantity' => $qty]);
                }

                if (!$move) throw new InvStop('Escribe cuánto se produjo de al menos un producto.');

                $this->applyInflow($r, $move);

                $this->must($this->qUpdateInflow(
                    ['status', 'confirmed_at = NOW()', 'confirmed_user_id', 'total_units', 'subtotal', 'tax', 'total'],
                    ['applied', $this->userId(), round($units, 4), round($base, 2), round($total - $base, 2), round($total, 2), $id]
                ), 'confirmEntrada');

                return ['folio' => $r['folio'], 'count' => count($move), 'units' => $units];
            });

            return $this->ok("Producción {$done['folio']} confirmada: {$done['count']} " . ($done['count'] === 1 ? 'producto' : 'productos')
                . ' (' . $this->num($done['units']) . ' uds al almacén).');
        }, 'No se pudo confirmar la producción. Intenta de nuevo.');
    }

    // -- Cancelar (contraseña primero, luego el motivo) --

    // doc 'inflow' = cancelar (casilla cancel); 'inflow-edit' = editar (casilla update).
    public function verifyKey() {
        $edit = $this->post('doc') === 'inflow-edit';
        $fail = $this->needBranch() ?: ($edit ? $this->need('update', 'editar entradas') : $this->need('cancel', 'cancelar entradas'));
        if ($fail) return $fail;

        if (!$this->qGetInflow($this->postId(), $this->companyId(), $this->branchId())) return $this->fail(404, 'Esa entrada no existe en la sucursal.');

        return $this->keyCheck($edit ? 'inflow-edit' : 'inflow', $this->postId());
    }

    // -- Editar (R2): la captura abierta con sus datos, contraseña primero --

    /*  payload: el de saveEntrada más id. Aplicada: se quita exacto lo que
        sumó cada renglón viejo (de su almacén y de su lote) y se suma lo nuevo;
        los renglones nuevos se ponen en el lugar de los viejos en el kárdex y la
        cadena Antes → Quedó se rehace. Pendiente (producción): solo cambian los
        datos. No se pasa de un tipo que suma a uno que nace pendiente ni al revés. */
    public function updateEntrada() {
        $fail = $this->needBranch() ?: $this->need('update', 'editar entradas');
        if ($fail) return $fail;

        $p  = json_decode($this->post('payload'), true);
        $id = (int) ($p['id'] ?? 0);

        if (!is_array($p) || $id <= 0) return $this->fail(400, 'No llegaron los datos de la entrada.');
        if (!$this->keyAuthorized('inflow-edit', $id)) return $this->fail(403, 'Confirma tu contraseña para editar la entrada.');

        $current = $this->qGetInflow($id, $this->companyId(), $this->branchId());
        if (!$current)                          return $this->fail(404, 'Esa entrada no existe en la sucursal.');
        if ($current['status'] === 'cancelled') return $this->fail(400, 'No se edita una entrada cancelada.');

        $origin = null;
        foreach ($this->qOrigins($this->companyId()) as $o) if ((int) $o['id'] === (int) ($p['inflow_origin_id'] ?? 0)) $origin = $o;

        if (!$origin || (int) $origin['is_system'] === 1) return $this->fail(400, 'Elige un tipo de entrada.');
        if (((int) $origin['starts_pending'] === 1) !== ($current['status'] === 'pending')) {
            return $this->fail(400, 'No se cambia entre Producción (pendiente) y un tipo que suma al guardar: cancela y captura otra.');
        }

        $warehouse = $this->ownWarehouse((int) ($p['warehouse_id'] ?? 0));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén donde entra.');

        $area = (int) ($p['warehouse_area_id'] ?? 0) ?: null;
        if ($area !== null && !in_array($area, array_map('intval', array_column($this->qAreaOptions([(int) $warehouse['id']]), 'id')), true)) {
            return $this->fail(400, 'Esa área no es de ese almacén.');
        }

        $date = (string) ($p['date_inflow'] ?? $current['operation_date']);
        $bad  = $this->badDate($date)
            ?: $this->adjustmentBlocks((int) $current['warehouse_id'], $current['operation_date'])
            ?: $this->adjustmentBlocks((int) $warehouse['id'], $date);
        if ($bad) return $this->fail(400, $bad);

        $supplierId = (int) ($p['supplier_id'] ?? 0) ?: null;
        if ($supplierId !== null && !$this->ownSupplier($supplierId)) return $this->fail(400, 'Ese proveedor no es de la empresa.');
        if ((int) $origin['requires_supplier'] === 1 && $supplierId === null) return $this->fail(400, 'Este tipo de entrada pide proveedor.');

        $voucher = (string) ($p['voucher_b64'] ?? '');
        if ($voucher !== '' && !$this->decodeVoucher($voucher)) return $this->fail(400, 'El comprobante debe ser una imagen o un PDF de hasta 4 MB.');

        $lines = $this->linesInput($p['productos'] ?? [], $date);
        if (isset($lines['status'])) return $lines;

        $note    = mb_substr(trim((string) ($p['note'] ?? '')), 0, 255, 'UTF-8') ?: null;
        $invoice = mb_substr(trim((string) ($p['invoice_folio'] ?? '')), 0, 50, 'UTF-8') ?: null;

        return $this->attempt(function () use ($id, $origin, $warehouse, $area, $date, $supplierId, $lines, $note, $invoice, $voucher) {
            $folio = $this->transaction(function () use ($id, $origin, $warehouse, $area, $date, $supplierId, $lines, $note, $invoice, $voucher) {
                $r = $this->qGetInflow($id, $this->companyId(), $this->branchId(), true);

                if (!$r || $r['status'] === 'cancelled') throw new InvStop('La entrada cambió mientras la editabas: vuelve a abrirla.');

                $applied = $r['status'] === 'applied';
                $oldWh   = (int) $r['warehouse_id'];
                $newWh   = (int) $warehouse['id'];
                $old     = $this->qInflowLines($id);
                $movedAt = $this->qLinesMovedAt('detail_inventory_inflow', 'inventory_inflow_id', $id);
                $pairs   = [];

                // Se quita exacto lo que sumó (aunque quede en negativo si ya se usó) y de su lote.
                if ($applied) {
                    foreach ($old as $d) {
                        $qty = (float) $d['quantity'];
                        if ($qty <= 0) continue;

                        $this->stockMove($oldWh, (int) $d['product_id'], -$qty);

                        $lot = $this->qLotOfDetail((int) $d['id']);
                        if ($lot) $this->must($this->qSetLot((int) $lot['id'], max(0, round((float) $lot['quantity'] - $qty, 4))), 'updateEntrada/lot');

                        $pairs[] = [(int) $d['product_id'], $oldWh];
                    }
                }

                $this->must($this->qDisableLines('detail_inventory_inflow', 'inventory_inflow_id', $id), 'updateEntrada/disable');

                $t = $this->totals($lines);

                $this->must($this->qUpdateInflow(
                    ['note', 'invoice_folio', 'total_products', 'total_units', 'subtotal', 'tax', 'total', 'operation_date',
                     'warehouse_id', 'warehouse_area_id', 'inflow_origin_id', 'supplier_id', 'edited_user_id', 'edited_at = NOW()'],
                    [$note, $invoice, count($lines), $t['units'], $t['subtotal'], $t['tax'], $t['total'], $date,
                     $newWh, $area, (int) $origin['id'], $supplierId, $this->userId(), $id]
                ), 'updateEntrada');

                foreach ($lines as $l) {
                    $this->must($this->qCreateInflowLine(
                        ['quantity', 'cost', 'tax', 'subtotal', 'batch_code', 'expires_at', 'inventory_inflow_id', 'product_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['tax'], $l['subtotal'], $l['lots'] ? $r['folio'] : null, $l['expires_at'], $id, $l['product_id'], 1]
                    ), 'updateEntrada/line');

                    $pairs[] = [$l['product_id'], $newWh];
                }

                if ($applied) {
                    $this->applyInflow($this->qGetInflow($id, $this->companyId(), $this->branchId()), $this->qInflowLines($id));

                    // En el kárdex van donde estaban los viejos y la cadena se rehace desde ahí.
                    if ($movedAt) $this->must($this->qSetLinesMovedAt('detail_inventory_inflow', 'inventory_inflow_id', $id, $movedAt), 'updateEntrada/moved');

                    $this->kardexChains($pairs, $this->companyId());
                }

                if ($voucher !== '') {
                    $this->must($this->qUpdateInflow(['voucher_url'], [$this->storeVoucher($r['folio'], $voucher), $id]), 'updateEntrada/voucher');
                }

                return $r['folio'];
            });

            $this->keyConsume('inflow-edit', $id);

            return $this->ok("Entrada {$folio} actualizada.", ['folio' => $folio, 'id' => $id]);
        }, 'No se guardó ningún cambio. Intenta de nuevo.');
    }

    /*  Pendiente: solo cambia de estado. Aplicada: resta lo que sumó; si ya se
        usó parte (no alcanza la existencia) no se cancela. El último costo del
        Catálogo no se regresa. */
    public function reverseEntrada() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar entradas');
        if ($fail) return $fail;

        $id = $this->postId();

        if (!$this->keyAuthorized('inflow', $id)) return $this->fail(403, 'Confirma tu contraseña para cancelar la entrada.');

        $reason = $this->textOrNull('reason');
        if ($reason === null) return $this->fail(400, 'Escribe por qué se cancela.');

        return $this->attempt(function () use ($id, $reason) {
            $folio = $this->transaction(function () use ($id, $reason) {
                $r = $this->qGetInflow($id, $this->companyId(), $this->branchId(), true);

                if (!$r)                          throw new InvStop('Esa entrada no existe en la sucursal.');
                if ($r['status'] === 'cancelled') throw new InvStop("La entrada {$r['folio']} ya estaba cancelada.");
                if ((int) $r['origin_system'] === 1) throw new InvStop('La creó el sistema (el «Recibí» de una requisición): se corrige desde ahí.');

                if ($r['status'] === 'applied') {
                    foreach ($this->qInflowLines($id) as $d) {
                        $qty = (float) $d['quantity'];
                        if ($qty <= 0) continue;

                        $stock = $this->qStockRow((int) $r['warehouse_id'], (int) $d['product_id'], true);
                        $have  = $stock ? (float) $stock['quantity'] : 0;

                        if ($have + 0.00001 < $qty) {
                            throw new InvStop('Ya se usó parte de «' . $d['name'] . '»: hay ' . $this->num($have) . ' y la entrada sumó ' . $this->num($qty) . '. Registra una salida en lugar de cancelar.');
                        }

                        [$prev, $post] = $this->stockMove((int) $r['warehouse_id'], (int) $d['product_id'], -$qty);

                        $this->must($this->qSetInflowLineCancelStock((int) $d['id'], $prev, $post), 'reverseEntrada/line');

                        $lot = $this->qLotOfDetail((int) $d['id']);
                        if ($lot) $this->must($this->qSetLot((int) $lot['id'], max(0, round((float) $lot['quantity'] - $qty, 4))), 'reverseEntrada/lot');
                    }
                }

                $this->must($this->qUpdateInflow(
                    ['status', 'cancelled_at = NOW()', 'cancelled_user_id', 'cancel_reason'],
                    ['cancelled', $this->userId(), $reason, $id]
                ), 'reverseEntrada');

                return $r['folio'];
            });

            $this->keyConsume('inflow', $id);

            return $this->ok("Entrada {$folio} cancelada.");
        }, 'No se pudo cancelar. Intenta de nuevo.');
    }

    // -- Comprobante (foto o PDF de la factura) --

    // Sube, cambia o quita (voucher_b64 vacío) el comprobante desde el detalle.
    public function saveEntradaVoucher() {
        $fail = $this->needBranch();
        if ($fail) return $fail;
        if (!$this->can('create') && !$this->can('update')) return $this->fail(403, 'Tu rol no puede subir comprobantes.');

        $r = $this->qGetInflow($this->postId(), $this->companyId(), $this->branchId());
        if (!$r) return $this->fail(404, 'Esa entrada no existe en la sucursal.');
        if ($r['status'] === 'cancelled') return $this->fail(400, 'No se cambia el comprobante de una entrada cancelada.');

        $b64 = $this->post('voucher_b64');

        if ($b64 !== '' && !$this->decodeVoucher($b64)) return $this->fail(400, 'El comprobante debe ser una imagen o un PDF de hasta 4 MB.');

        return $this->attempt(function () use ($r, $b64) {
            $url = $b64 === '' ? null : $this->storeVoucher($r['folio'], $b64);

            if ($b64 === '') $this->dropVouchers($r['folio']);

            $this->must($this->qUpdateInflow(['voucher_url'], [$url, (int) $r['id']]), 'saveEntradaVoucher');

            return $this->ok($b64 === '' ? 'Comprobante eliminado.' : 'Comprobante guardado.');
        }, 'No se pudo guardar el comprobante.');
    }

    private function decodeVoucher($b64) {
        if (!preg_match('#^data:(image/(jpeg|png|webp)|application/pdf);base64,#', $b64, $m)) return null;

        $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
        if ($data === false || strlen($data) > self::VOUCHER_MAX) return null;

        return ['ext' => $m[1] === 'application/pdf' ? 'pdf' : ($m[2] === 'jpeg' ? 'jpg' : $m[2]), 'data' => $data];
    }

    private function voucherDir() {
        $rel  = 'pro_files/' . $this->companyId() . '/' . $this->branchId() . '/inventarios/entradas/';
        $root = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']), '/') : '';

        return [$rel, $root . '/' . $rel];
    }

    // pro_files/<empresa>/<sucursal>/inventarios/entradas/<folio>.<ext>; borra la versión anterior.
    private function storeVoucher($folio, $b64) {
        $file = $this->decodeVoucher($b64);
        if (!$file) throw new RuntimeException('storeVoucher: archivo inválido');

        [$rel, $disk] = $this->voucherDir();

        if (!is_dir($disk) && !@mkdir($disk, 0775, true) && !is_dir($disk)) throw new RuntimeException('storeVoucher: no se pudo crear ' . $disk);

        $this->dropVouchers($folio);

        $name = preg_replace('/[^A-Za-z0-9_-]/', '', $folio) . '.' . $file['ext'];

        if (@file_put_contents($disk . $name, $file['data']) === false) throw new RuntimeException('storeVoucher: no se pudo escribir ' . $disk . $name);

        return $rel . $name;
    }

    private function dropVouchers($folio) {
        [, $disk] = $this->voucherDir();

        foreach (glob($disk . preg_replace('/[^A-Za-z0-9_-]/', '', $folio) . '.*') ?: [] as $old) @unlink($old);
    }

    // -- Formatos (plantillas de lote: «Producción lunes») --

    public function lsFormatos() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $formats  = $this->qFormats($this->companyId(), $this->branchId(), $this->userId());
        $catalog  = array_column($this->catalogProducts(), null, 'id');
        $byFormat = [];

        foreach ($this->qFormatItems(array_map('intval', array_column($formats, 'id'))) as $it) {
            $p = $catalog[(string) $it['product_id']] ?? null;
            if (!$p) continue;

            $byFormat[(int) $it['inflow_format_id']][] = array_merge($p, ['cantidad' => (float) $it['quantity']]);
        }

        return [
            'status'   => 200,
            'formatos' => array_map(function ($f) use ($byFormat) {
                return ['id' => (int) $f['id'], 'name' => $f['name'], 'scope' => $f['scope'], 'productos' => $byFormat[(int) $f['id']] ?? []];
            }, $formats)
        ];
    }

    public function saveFormato() {
        $fail = $this->needBranch();
        if ($fail) return $fail;
        if (!$this->captureOrigins()) return $this->fail(403, 'Tu rol no puede capturar entradas.');

        $name  = mb_substr(trim($this->post('name')), 0, 80, 'UTF-8');
        $scope = in_array($this->post('scope'), ['user', 'subsidiary', 'company'], true) ? $this->post('scope') : 'user';
        $items = $this->postedJson('productos') ?: [];
        $ids   = array_column($this->products(), null, 'id');

        if ($name === '') return $this->fail(400, 'El nombre del formato es obligatorio.');

        $items = array_values(array_filter($items, function ($it) use ($ids) {
            return isset($ids[(int) ($it['id'] ?? 0)]) && (float) ($it['cantidad'] ?? 0) > 0;
        }));

        if (!$items) return $this->fail(400, 'El formato no tiene productos.');

        return $this->attempt(function () use ($name, $scope, $items) {
            $id = $this->transaction(function () use ($name, $scope, $items) {
                $this->must($this->qCreateFormat(
                    ['name', 'scope', 'user_id', 'company_id', 'branch_id', 'active'],
                    [$name, $scope, $this->userId(), $this->companyId(), $this->branchId(), 1]
                ), 'saveFormato');

                $formatId = $this->newId('saveFormato');

                foreach ($items as $i => $it) {
                    $this->must($this->qCreateFormatItem(
                        ['quantity', 'sort_order', 'inflow_format_id', 'product_id', 'active'],
                        [round((float) $it['cantidad'], 4), $i, $formatId, (int) $it['id'], 1]
                    ), 'saveFormato/item');
                }

                return $formatId;
            });

            return $this->ok('Formato guardado.', ['id' => $id]);
        }, 'No se pudo guardar el formato.');
    }

    // Lo borra quien lo guardó, o el Dueño.
    public function deleteFormato() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $f = $this->qGetFormat($this->postId(), $this->companyId());
        if (!$f) return $this->fail(404, 'Ese formato ya no existe.');

        if ((int) $f['user_id'] !== $this->userId() && empty($_SESSION['is_owner']) && empty($_SESSION['is_root'])) {
            return $this->fail(403, 'Solo quien lo guardó puede borrarlo.');
        }

        return $this->attempt(function () use ($f) {
            $this->must($this->qDeleteFormat((int) $f['id']), 'deleteFormato');

            return $this->ok('Formato eliminado.');
        }, 'No se pudo eliminar el formato.');
    }
}

Permission::dispatch(new ctrl(), 'inv-entradas');
