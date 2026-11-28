<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-requisiciones.php';

/*  Requisiciones (R4): la sucursal pide insumos a otra (casi siempre la
    Matriz). Lista y calendario de lo que pidió, la captura de inventory (la
    hoja de orden-form.js), enviar, editar (en espera pide contraseña),
    cancelar mientras nadie la surta y «Recibí»: lo surtido entra a su
    almacén. Imprimir y compartir el comprobante por WhatsApp.

    Casillas: show, create (nueva), update (editar, enviar y «Recibí»),
    cancel (cancelar la suya), print, ver-costos (importe estimado). */
class ctrl extends coreReq {

    const SECTION = 'inv-requisiciones';
    const LADO    = 'pedidos';

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $branches = $this->branchList();
        $main     = $this->mainBranchId();

        // «Solicitar a» arranca en la Matriz; si la sucursal ES la Matriz, en la siguiente.
        $ask = $main;
        if ($this->branchId() === $main) {
            foreach ($branches as $b) if ($b['id'] !== $main) { $ask = $b['id']; break; }
        }

        return $this->baseInit([
            'branch_id'     => $this->branchId(),
            'ask_branch_id' => $ask,
            'sucursales'    => $branches,
            'departamentos' => $this->departmentList(),
            'unidades'      => array_map(function ($u) { return ['id' => $u['id'], 'valor' => $u['code']]; }, $this->unitList()),
            'productos'     => $this->catalogProducts(),
            'estados'       => $this->statusOptions(),
            'costs'         => $this->costs()
        ]);
    }

    public function lsRequisiciones() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las requisiciones');
        if ($fail) return $fail;

        return ['status' => 200, 'row' => $this->listRows()];
    }

    public function lsCalendario() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las requisiciones');
        if ($fail) return $fail;

        return $this->calendarResponse();
    }

    public function getRequisicion() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        return $r ? $this->detailResponse($r) : $this->fail(404, 'Esa requisición no es de la sucursal.');
    }

    public function printRequisicion() {
        $fail = $this->needBranch() ?: $this->need('print', 'imprimir requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        return $r ? $this->printResponse($r) : $this->fail(404, 'Esa requisición no es de la sucursal.');
    }

    public function shareRequisicion() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver las requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        return $r ? $this->shareResponse($r) : $this->fail(404, 'Esa requisición no es de la sucursal.');
    }

    // -- Capturar --

    /*  payload (el de orden-form): submit, destination_branch_id,
        department_id, date_order, note y productos [{product_id, quantity,
        unit_id, note}]. submit = En espera; si no, Borrador. */
    public function saveRequisicion() {
        $fail = $this->needBranch() ?: $this->need('create', 'hacer requisiciones');
        if ($fail) return $fail;

        $in = $this->requisitionInput(json_decode($this->post('payload'), true), true);
        if (isset($in['status'])) return $in;

        $p      = json_decode($this->post('payload'), true);
        $submit = !empty($p['submit']);
        $wh     = $this->warehouses();

        return $this->attempt(function () use ($in, $submit, $wh) {
            $saved = $this->transaction(function () use ($in, $submit, $wh) {
                $folio = $this->nextFolio('REQ');

                $this->must($this->qCreateRequisition(
                    ['folio', 'note', 'total_products', 'total_units', 'total_cost', 'needed_date', 'requisition_status_id', 'user_id',
                     'company_id', 'branch_id', 'source_branch_id', 'warehouse_id', 'department_id', 'active'],
                    [$folio, $in['note'], count($in['lines']), $in['units'], $in['cost'], $in['needed'], $this->statusId($submit ? 'EN_ESPERA' : 'BORRADOR'), $this->userId(),
                     $this->companyId(), $this->branchId(), $in['source'], $wh ? (int) $wh[0]['id'] : null, $in['department'], 1]
                ), 'saveRequisicion');

                $id = $this->newId('saveRequisicion');

                if ($submit) $this->must($this->qUpdateRequisition(['sent_at = NOW()'], [$id]), 'saveRequisicion/sent');

                $this->createLines($id, $in['lines']);

                return ['id' => $id, 'folio' => $folio];
            });

            return $this->ok($submit ? "Requisición {$saved['folio']} enviada." : "Requisición {$saved['folio']} guardada como borrador.", $saved + ['submit' => $submit]);
        }, 'No se pudo guardar la requisición. Intenta de nuevo.');
    }

    // Borrador: sin contraseña. En espera (nadie la ha surtido): con contraseña.
    public function updateRequisicion() {
        $fail = $this->needBranch() ?: $this->need('update', 'editar requisiciones');
        if ($fail) return $fail;

        $p  = json_decode($this->post('payload'), true);
        $id = (int) ($p['id'] ?? 0);
        $r  = $this->sideRequisition($id);

        if (!$r) return $this->fail(404, 'Esa requisición no es de la sucursal.');
        if (!in_array($r['status_code'], ['BORRADOR', 'EN_ESPERA'], true)) return $this->fail(400, 'Ya la empezaron a surtir: no se edita.');
        if ($r['status_code'] === 'EN_ESPERA' && !$this->keyAuthorized('req-edit', $id)) return $this->fail(403, 'Confirma tu contraseña para editar la requisición.');

        $in = $this->requisitionInput($p, false);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($id, $in) {
            $folio = $this->transaction(function () use ($id, $in) {
                $this->qLockRequisition($id);
                $r = $this->qGetRequisition($id, $this->companyId());

                if (!$r || !in_array($r['status_code'], ['BORRADOR', 'EN_ESPERA'], true)) throw new InvStop('La requisición cambió mientras la editabas: vuelve a abrirla.');

                $this->must($this->qDisableRequisitionLines($id), 'updateRequisicion/disable');
                $this->createLines($id, $in['lines']);

                $this->must($this->qUpdateRequisition(
                    ['note', 'total_products', 'total_units', 'total_cost', 'needed_date', 'source_branch_id', 'department_id'],
                    [$in['note'], count($in['lines']), $in['units'], $in['cost'], $in['needed'], $in['source'], $in['department'], $id]
                ), 'updateRequisicion');

                return $r['folio'];
            });

            $this->keyConsume('req-edit', $id);

            return $this->ok("Requisición {$folio} actualizada.", ['id' => $id, 'folio' => $folio]);
        }, 'No se guardó ningún cambio. Intenta de nuevo.');
    }

    public function sendRequisicion() {
        $fail = $this->needBranch() ?: (($this->can('create') || $this->can('update')) ? null : $this->fail(403, 'Tu rol no puede enviar requisiciones.'));
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        if (!$r)                               return $this->fail(404, 'Esa requisición no es de la sucursal.');
        if ($r['status_code'] !== 'BORRADOR')   return $this->fail(400, 'Ya estaba enviada.');
        if ((int) $r['lines_count'] === 0)      return $this->fail(400, 'Agrega al menos un producto antes de enviarla.');

        return $this->attempt(function () use ($r) {
            $this->must($this->qUpdateRequisition(['requisition_status_id', 'sent_at = NOW()'], [$this->statusId('EN_ESPERA'), (int) $r['id']]), 'sendRequisicion');

            return $this->ok("Requisición {$r['folio']} enviada a {$r['source_branch']}.");
        }, 'No se pudo enviar la requisición.');
    }

    // Mientras nadie la surta. El motivo queda en la requisición.
    public function cancelRequisicion() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar requisiciones');
        if ($fail) return $fail;

        $r      = $this->sideRequisition($this->postId());
        $reason = $this->textOrNull('reason');

        if (!$r)              return $this->fail(404, 'Esa requisición no es de la sucursal.');
        if ($reason === null) return $this->fail(400, 'Escribe por qué se cancela.');

        return $this->attempt(function () use ($r, $reason) {
            $folio = $this->transaction(function () use ($r, $reason) {
                $this->qLockRequisition((int) $r['id']);
                $now = $this->qGetRequisition((int) $r['id'], $this->companyId());

                if (!in_array($now['status_code'], ['BORRADOR', 'EN_ESPERA'], true)) throw new InvStop('Ya la empezaron a surtir: pide a quien surte que la revierta.');

                $this->must($this->qUpdateRequisition(['requisition_status_id', 'reject_reason'], [$this->statusId('CANCELADA'), $reason, (int) $r['id']]), 'cancelRequisicion');

                return $now['folio'];
            });

            return $this->ok("Requisición {$folio} cancelada.");
        }, 'No se pudo cancelar la requisición.');
    }

    // doc 'req-edit': editar una requisición en espera.
    public function verifyKey() {
        $fail = $this->needBranch() ?: $this->need('update', 'editar requisiciones');
        if ($fail) return $fail;

        if (!$this->sideRequisition($this->postId())) return $this->fail(404, 'Esa requisición no es de la sucursal.');

        return $this->keyCheck('req-edit', $this->postId());
    }

    // -- Recibí --

    /*  Lo surtido que aún no se recibe entra al almacén de la sucursal en UNA
        entrada del sistema (tipo «Surtido de la Matriz», con el costo y el
        lote de la salida). Entregada y recibida completa = Confirmada. */
    public function receiveRequisicion() {
        $fail = $this->needBranch() ?: $this->need('update', 'recibir requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());
        if (!$r) return $this->fail(404, 'Esa requisición no es de la sucursal.');
        if (!in_array($r['status_code'], ['SURTIDO_PARCIAL', 'ENTREGADO'], true)) return $this->fail(400, 'No hay nada surtido por recibir.');

        $warehouse = $this->ownWarehouse($this->postId('warehouse_id')) ?: $this->ownWarehouse((int) $r['warehouse_id']) ?: ($this->warehouses()[0] ?? null);
        if (!$warehouse) return $this->fail(400, 'La sucursal no tiene almacén donde recibir.');

        $origin = $this->qCatalogByCode('inflow_origin', 'SURTIDO_SUC', $this->companyId());
        if (!$origin) return $this->fail(409, 'Falta el tipo de entrada «Surtido de la Matriz» en el Catálogo de insumos.');

        return $this->attempt(function () use ($r, $warehouse, $origin) {
            $saved = $this->transaction(function () use ($r, $warehouse, $origin) {
                $id = (int) $r['id'];
                $this->qLockRequisition($id);

                $now     = $this->qGetRequisition($id, $this->companyId());
                $pending = array_values(array_filter($this->qRequisitionSupplies($id), function ($s) { return !$s['inventory_inflow_id']; }));

                if (!$pending) throw new InvStop('Ya se había recibido todo lo surtido.');

                $lines = [];
                foreach ($pending as $s) {
                    foreach ($this->qOutflowLines((int) $s['inventory_outflow_id']) as $d) {
                        $lines[] = [
                            'product_id' => (int) $d['product_id'],
                            'quantity'   => (float) $d['quantity'],
                            'cost'       => (float) $d['cost'],
                            'subtotal'   => round((float) $d['quantity'] * (float) $d['cost'], 2),
                            'batch_code' => $d['batch_code'] ?: $now['folio'],
                            'expires_at' => $d['expires_at']
                        ];
                    }
                }

                if (!$lines) throw new InvStop('Lo surtido no trae productos.');

                $folio = $this->nextFolio('ENT');
                $units = array_sum(array_column($lines, 'quantity'));
                $total = array_sum(array_column($lines, 'subtotal'));

                $this->must($this->qCreateInflow(
                    ['folio', 'note', 'total_products', 'total_units', 'subtotal', 'tax', 'total', 'operation_date', 'status', 'user_id',
                     'company_id', 'branch_id', 'warehouse_id', 'inflow_origin_id', 'active'],
                    [$folio, 'Recibido de la requisición ' . $now['folio'] . ' (' . $now['source_branch'] . ')', count($lines), round($units, 4), round($total, 2), 0, round($total, 2),
                     $this->qNow()['today'], 'applied', $this->userId(), $this->companyId(), $this->branchId(), (int) $warehouse['id'], (int) $origin['id'], 1]
                ), 'receiveRequisicion');

                $inflowId = $this->newId('receiveRequisicion');

                foreach ($lines as $l) {
                    $this->must($this->qCreateInflowLine(
                        ['quantity', 'cost', 'tax', 'subtotal', 'batch_code', 'expires_at', 'inventory_inflow_id', 'product_id', 'active'],
                        [$l['quantity'], $l['cost'], 0, $l['subtotal'], $l['batch_code'], $l['expires_at'], $inflowId, $l['product_id'], 1]
                    ), 'receiveRequisicion/line');
                }

                $this->applyInflow($this->qGetInflow($inflowId, $this->companyId(), $this->branchId(), true), $this->qInflowLines($inflowId));

                foreach ($pending as $s) {
                    $this->must($this->qUpdateRequisitionSupply(['inventory_inflow_id'], [$inflowId, (int) $s['id']]), 'receiveRequisicion/supply');
                }

                // Entregada (completa o dada por terminada) y ya recibida: Confirmada.
                if ($now['status_code'] === 'ENTREGADO') {
                    $this->must($this->qUpdateRequisition(
                        ['requisition_status_id', 'confirmed_at = NOW()', 'confirmed_user_id'],
                        [$this->statusId('CONFIRMADO'), $this->userId(), $id]
                    ), 'receiveRequisicion/confirm');
                }

                return ['folio' => $now['folio'], 'inflow' => $folio, 'confirmed' => $now['status_code'] === 'ENTREGADO'];
            });

            return $this->ok(
                "Recibido: entrada {$saved['inflow']} en {$warehouse['name']}." . ($saved['confirmed'] ? " La requisición {$saved['folio']} queda Confirmada." : ''),
                $saved
            );
        }, 'No se pudo registrar lo recibido. Intenta de nuevo.');
    }

    // -- Ayudantes --

    // Lo del payload revisado, o la respuesta de error. El mismo producto dos veces se junta.
    private function requisitionInput($p, $isNew) {
        if (!is_array($p)) return $this->fail(400, 'No llegaron los datos de la requisición.');

        $branches = array_column($this->branchList(), 'valor', 'id');
        $source   = (int) ($p['destination_branch_id'] ?? 0);
        if (!isset($branches[$source])) return $this->fail(400, 'Elige a qué sucursal le pides.');

        $department = (int) ($p['department_id'] ?? 0) ?: null;
        if ($department !== null && !in_array($department, array_column($this->departmentList(), 'id'), true)) return $this->fail(400, 'Esa área no es de la empresa.');

        $needed = $this->dateOrNull($p['date_order'] ?? '');
        if (!$needed) return $this->fail(400, 'Elige la fecha en que necesitas los insumos.');
        if ($isNew && $needed < date('Y-m-d', strtotime($this->qNow()['today'] . ' -1 month'))) return $this->fail(400, 'La fecha no puede ser de hace más de un mes.');

        $raw = $p['productos'] ?? [];
        if (!is_array($raw) || !$raw)      return $this->fail(400, 'Agrega al menos un producto.');
        if (count($raw) > self::MAX_LINES) return $this->fail(400, 'Son demasiados renglones: máximo ' . self::MAX_LINES . ' por requisición.');

        $products = array_column($this->products(), null, 'id');
        $units    = array_column($this->unitList(), 'id');
        $lines    = [];

        foreach ($raw as $item) {
            $pid = (int) ($item['product_id'] ?? 0);
            $pr  = $products[$pid] ?? null;
            if (!$pr) return $this->fail(400, 'Uno de los productos ya no lleva inventario. Vuelve a abrir la captura.');

            $qty = round((float) ($item['quantity'] ?? 0), 4);
            $bad = $this->badQuantity($qty, $pr);
            if ($bad) return $this->fail(400, $bad);

            $unit = (int) ($item['unit_id'] ?? 0);
            $note = mb_substr(trim((string) ($item['note'] ?? '')), 0, 255, 'UTF-8');

            if (isset($lines[$pid])) {
                $lines[$pid]['quantity'] = round($lines[$pid]['quantity'] + $qty, 4);
                if ($note !== '') $lines[$pid]['note'] = mb_substr(trim($lines[$pid]['note'] . ' · ' . $note, ' ·'), 0, 255, 'UTF-8');
                continue;
            }

            $lines[$pid] = [
                'product_id' => $pid,
                'quantity'   => $qty,
                'unit_id'    => in_array($unit, $units, true) ? $unit : ($pr['unit_id'] ? (int) $pr['unit_id'] : null),
                'note'       => $note,
                'cost'       => (float) $pr['cost']
            ];
        }

        $lines = array_values($lines);

        return [
            'source'     => $source,
            'department' => $department,
            'needed'     => $needed,
            'note'       => mb_substr(trim((string) ($p['note'] ?? '')), 0, 255, 'UTF-8') ?: null,
            'lines'      => $lines,
            'units'      => round(array_sum(array_column($lines, 'quantity')), 4),
            'cost'       => round(array_sum(array_map(function ($l) { return $l['quantity'] * $l['cost']; }, $lines)), 2)
        ];
    }

    private function createLines($requisitionId, array $lines) {
        foreach ($lines as $l) {
            $this->must($this->qCreateRequisitionLine(
                ['quantity', 'quantity_supplied', 'note', 'requisition_id', 'product_id', 'unit_id', 'active'],
                [$l['quantity'], 0, $l['note'] !== '' ? $l['note'] : null, $requisitionId, $l['product_id'], $l['unit_id'], 1]
            ), 'createLines');
        }
    }
}

Permission::dispatch(new ctrl(), 'inv-requisiciones');
