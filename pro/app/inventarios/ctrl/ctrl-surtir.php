<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-requisiciones.php';

/*  Surtir (R4): las requisiciones que le piden a la sucursal (casi siempre la
    Matriz). «Surtiendo la requisición»: se elige el almacén y cuánto sale de
    cada producto (lo pendiente, topado a lo que hay); sale en una salida del
    sistema («Surtido a sucursal») y queda en el historial de surtimientos. Lo
    que no se surte queda pendiente (Surtido parcialmente) o se da por
    terminado. Rechazar mientras nadie la surta; revertir lo surtido que aún
    no reciben (contraseña): la salida se cancela y regresa al almacén.

    Casillas: show, update (surtir), cancel (rechazar y revertir), print,
    ver-costos (importe de lo que se surte). */
class ctrl extends coreReq {

    const SECTION = 'inv-surtir';
    const LADO    = 'entregas';

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->baseInit([
            'branch_id'     => $this->branchId(),
            'departamentos' => $this->departmentList(),
            'estados'       => $this->statusOptions(),
            'almacenes'     => $this->warehouseList(),
            'costs'         => $this->costs()
        ]);
    }

    public function lsRequisiciones() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver lo que te piden');
        if ($fail) return $fail;

        return ['status' => 200, 'row' => $this->listRows()];
    }

    public function lsCalendario() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver lo que te piden');
        if ($fail) return $fail;

        return $this->calendarResponse();
    }

    public function getRequisicion() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver lo que te piden');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        return $r ? $this->detailResponse($r) : $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');
    }

    public function printRequisicion() {
        $fail = $this->needBranch() ?: $this->need('print', 'imprimir requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        return $r ? $this->printResponse($r) : $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');
    }

    public function shareRequisicion() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver lo que te piden');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());

        return $r ? $this->shareResponse($r) : $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');
    }

    // -- Surtir --

    // La ventana: cada renglón con lo pendiente y lo que hay en cada almacén de la sucursal.
    public function getSurtido() {
        $fail = $this->needBranch() ?: $this->need('update', 'surtir requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());
        if (!$r) return $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');

        $stock = [];
        foreach ($this->warehouses() as $w) $stock[(int) $w['id']] = (object) $this->stockMap((int) $w['id']);

        return ['status' => 200, 'stock' => (object) $stock] + $this->detailResponse($r);
    }

    /*  items (JSON): {detail_id: cantidad}. finish = 1: lo que falta ya no se
        surte (queda Entregada aunque falte). Sale todo o nada: si de algo no
        alcanza, no sale nada. */
    public function supplyRequisicion() {
        $fail = $this->needBranch() ?: $this->need('update', 'surtir requisiciones');
        if ($fail) return $fail;

        $r = $this->sideRequisition($this->postId());
        if (!$r) return $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');
        if (!in_array($r['status_code'], ['EN_ESPERA', 'SURTIDO_PARCIAL'], true)) return $this->fail(400, 'Esta requisición ya no está por surtir.');

        $warehouse = $this->ownWarehouse($this->postId('warehouse_id'));
        if (!$warehouse) return $this->fail(400, 'Elige el almacén de donde sale.');

        $reason = $this->qCatalogByCode('outflow_reason', 'SURTIDO_SUC', $this->companyId());
        if (!$reason) return $this->fail(409, 'Falta el motivo de salida «Surtido a sucursal» en el Catálogo de insumos.');

        $items  = $this->postedJson('items') ?: [];
        $finish = $this->flag('finish') === 1;
        $note   = $this->textOrNull('note');
        $want   = [];

        foreach ($this->qRequisitionLines((int) $r['id']) as $l) {
            $qty = round((float) ($items[(string) $l['id']] ?? 0), 4);
            if ($qty <= 0) continue;

            $pending = round((float) $l['quantity'] - (float) $l['quantity_supplied'], 4);

            if ($qty > $pending + 0.00001) return $this->fail(400, 'De «' . $l['name'] . '» solo faltan ' . $this->num(max(0, $pending)) . '.');
            if ((int) $l['decimals'] !== 1 && floor($qty) != $qty) return $this->fail(400, '«' . $l['name'] . '» va sin decimales.');

            $want[(int) $l['id']] = $qty;
        }

        if (!$want && !$finish) return $this->fail(400, 'Escribe cuánto surtes de al menos un producto.');
        if (!$want && $r['status_code'] === 'EN_ESPERA') return $this->fail(400, 'No se ha surtido nada: si no la vas a surtir, recházala.');

        return $this->attempt(function () use ($r, $warehouse, $reason, $want, $finish, $note) {
            $saved = $this->transaction(function () use ($r, $warehouse, $reason, $want, $finish, $note) {
                $id = (int) $r['id'];
                $this->qLockRequisition($id);

                $now = $this->qGetRequisition($id, $this->companyId());
                if (!in_array($now['status_code'], ['EN_ESPERA', 'SURTIDO_PARCIAL'], true)) throw new InvStop('La requisición cambió mientras la surtías: vuelve a abrirla.');

                $whId     = (int) $warehouse['id'];
                $lines    = array_column($this->qRequisitionLines($id), null, 'id');
                $outflow  = null;
                $outFolio = null;
                $units    = 0.0;
                $total    = 0.0;

                if ($want) {
                    $outFolio = $this->nextFolio('S');

                    $this->must($this->qCreateOutflow(
                        ['folio', 'note', 'total_products', 'total_units', 'total_cost', 'operation_date', 'status', 'user_id',
                         'company_id', 'branch_id', 'warehouse_id', 'outflow_reason_id', 'active'],
                        [$outFolio, 'Surtido de la requisición ' . $now['folio'] . ' para ' . $now['branch'], 0, 0, 0, $this->qNow()['today'], 'applied', $this->userId(),
                         $this->companyId(), $this->branchId(), $whId, (int) $reason['id'], 1]
                    ), 'supplyRequisicion/outflow');

                    $outflow = $this->newId('supplyRequisicion/outflow');

                    foreach ($want as $detailId => $qty) {
                        $l = $lines[$detailId] ?? null;
                        if (!$l) throw new InvStop('Uno de los renglones ya no está en la requisición: vuelve a abrirla.');

                        $pid  = (int) $l['product_id'];
                        $have = $this->qStockRow($whId, $pid, true);
                        $have = $have ? round((float) $have['quantity'], 4) : 0.0;

                        if ($have + 0.00001 < $qty) {
                            throw new InvStop('Solo hay ' . $this->num(max(0, $have)) . ' ' . ($l['unit'] ?: 'PZA') . ' de «' . $l['name'] . '» en ' . $warehouse['name'] . '.');
                        }

                        $cost = round((float) $l['cost'], 4);
                        $lot  = $this->takeLots($whId, $pid, $qty);

                        [$prev, $post] = $this->stockMove($whId, $pid, -$qty);

                        $this->must($this->qCreateOutflowLine(
                            ['quantity', 'cost', 'subtotal', 'previous_stock', 'resulting_stock', 'inventory_outflow_id', 'product_id', 'stock_lot_id', 'active'],
                            [$qty, $cost, round($qty * $cost, 2), $prev, $post, $outflow, $pid, $lot, 1]
                        ), 'supplyRequisicion/line');

                        $this->must($this->qSetRequisitionLineSupplied($detailId, round((float) $l['quantity_supplied'] + $qty, 4)), 'supplyRequisicion/supplied');

                        $units += $qty;
                        $total += round($qty * $cost, 2);
                    }

                    $this->must($this->qUpdateOutflow(['total_products', 'total_units', 'total_cost'], [count($want), round($units, 4), round($total, 2), $outflow]), 'supplyRequisicion/totals');

                    $this->must($this->qCreateRequisitionSupply(
                        ['total_products', 'total_units', 'total_cost', 'note', 'moves_stock', 'user_id', 'requisition_id', 'warehouse_id', 'inventory_outflow_id', 'active'],
                        [count($want), round($units, 4), round($total, 2), $note, 1, $this->userId(), $id, $whId, $outflow, 1]
                    ), 'supplyRequisicion/supply');
                }

                $status = $this->nextStatus($id, $finish);
                $set    = ['requisition_status_id'];
                $data   = [$this->statusId($status)];

                if (!$now['approved_at'])    { $set[] = 'approved_at = NOW()'; $set[] = 'approved_user_id'; $data[] = $this->userId(); }
                if ($note !== null)          { $set[] = 'approval_note'; $data[] = $note; }
                if ($status === 'CONFIRMADO') $set[] = 'confirmed_at = NOW()';

                $data[] = $id;
                $this->must($this->qUpdateRequisition($set, $data), 'supplyRequisicion/status');

                // req_status y no status: ok() se quedaría con este en lugar del 200.
                return ['folio' => $now['folio'], 'outflow' => $outFolio, 'req_status' => $status];
            });

            $msg = $saved['outflow'] ? "Surtido: salida {$saved['outflow']} de {$warehouse['name']}." : 'La requisición queda entregada con lo que ya se surtió.';

            return $this->ok($msg . ($saved['req_status'] === 'SURTIDO_PARCIAL' ? ' Lo que falta queda pendiente.' : ''), $saved);
        }, 'No se pudo surtir. Intenta de nuevo.');
    }

    // Mientras nadie la surta. El motivo lo ve quien pidió.
    public function rejectRequisicion() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'rechazar requisiciones');
        if ($fail) return $fail;

        $r      = $this->sideRequisition($this->postId());
        $reason = $this->textOrNull('reason');

        if (!$r)              return $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');
        if ($reason === null) return $this->fail(400, 'Escribe por qué se rechaza.');

        return $this->attempt(function () use ($r, $reason) {
            $folio = $this->transaction(function () use ($r, $reason) {
                $this->qLockRequisition((int) $r['id']);
                $now = $this->qGetRequisition((int) $r['id'], $this->companyId());

                if ($now['status_code'] !== 'EN_ESPERA') throw new InvStop('Ya no está en espera: no se rechaza.');

                $this->must($this->qUpdateRequisition(
                    ['requisition_status_id', 'reject_reason', 'approved_at = NOW()', 'approved_user_id'],
                    [$this->statusId('RECHAZADA'), $reason, $this->userId(), (int) $r['id']]
                ), 'rejectRequisicion');

                return $now['folio'];
            });

            return $this->ok("Requisición {$folio} rechazada.");
        }, 'No se pudo rechazar la requisición.');
    }

    // doc 'req-revert': revertir lo surtido.
    public function verifyKey() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'revertir surtidos');
        if ($fail) return $fail;

        if (!$this->sideRequisition($this->postId())) return $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');

        return $this->keyCheck('req-revert', $this->postId());
    }

    /*  Lo surtido que todavía no reciben regresa al almacén: cada salida se
        cancela (queda en el kárdex como Cancelación) y lo surtido se descuenta
        de cada renglón. Lo ya recibido no se toca. */
    public function revertSurtido() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'revertir surtidos');
        if ($fail) return $fail;

        $id = $this->postId();
        $r  = $this->sideRequisition($id);

        if (!$r) return $this->fail(404, 'Esa requisición no se le pidió a la sucursal.');
        if (!$this->keyAuthorized('req-revert', $id)) return $this->fail(403, 'Confirma tu contraseña para revertir el surtido.');

        $reason = $this->textOrNull('reason') ?: 'Se revirtió el surtido';

        return $this->attempt(function () use ($id, $reason) {
            $saved = $this->transaction(function () use ($id, $reason) {
                $this->qLockRequisition($id);
                $now     = $this->qGetRequisition($id, $this->companyId());
                $pending = array_values(array_filter($this->qRequisitionSupplies($id), function ($s) { return !$s['inventory_inflow_id']; }));

                if (!in_array($now['status_code'], ['SURTIDO_PARCIAL', 'ENTREGADO'], true) || !$pending) throw new InvStop('No hay surtido por revertir: ya se recibió.');

                $back = [];

                foreach ($pending as $s) {
                    $o = $s['inventory_outflow_id'] ? $this->qOutflowById((int) $s['inventory_outflow_id']) : null;

                    if ($o && $o['status'] === 'applied') {
                        if ((int) $o['branch_id'] !== $this->branchId()) throw new InvStop('Ese surtido salió de otra sucursal: lo revierte ella.');

                        foreach ($this->qOutflowLines((int) $o['id']) as $d) {
                            [$prev, $post] = $this->stockMove((int) $o['warehouse_id'], (int) $d['product_id'], (float) $d['quantity']);

                            $this->must($this->qSetOutflowLineCancelStock((int) $d['id'], $prev, $post), 'revertSurtido/line');

                            if ($d['stock_lot_id']) $this->must($this->qAddToLot((int) $d['stock_lot_id'], (float) $d['quantity']), 'revertSurtido/lot');

                            $back[(int) $d['product_id']] = ($back[(int) $d['product_id']] ?? 0) + (float) $d['quantity'];
                        }

                        $this->must($this->qUpdateOutflow(
                            ['status', 'cancelled_at = NOW()', 'cancelled_user_id', 'cancel_reason'],
                            ['cancelled', $this->userId(), $reason, (int) $o['id']]
                        ), 'revertSurtido/outflow');
                    }

                    $this->must($this->qUpdateRequisitionSupply(['active'], [0, (int) $s['id']]), 'revertSurtido/supply');
                }

                foreach ($this->qRequisitionLines($id) as $l) {
                    $qty = $back[(int) $l['product_id']] ?? 0;
                    if ($qty <= 0) continue;

                    $this->must($this->qSetRequisitionLineSupplied((int) $l['id'], max(0, round((float) $l['quantity_supplied'] - $qty, 4))), 'revertSurtido/supplied');
                }

                // Sin nada surtido vuelve a En espera como nueva: sin quién la surtió ni su nota.
                $status = $this->nextStatus($id);
                $set    = $status === 'EN_ESPERA'
                    ? ['requisition_status_id', 'approved_at = NULL', 'approved_user_id = NULL', 'approval_note = NULL']
                    : ['requisition_status_id'];

                $this->must($this->qUpdateRequisition($set, [$this->statusId($status), $id]), 'revertSurtido/status');

                return ['folio' => $now['folio'], 'req_status' => $status];
            });

            $this->keyConsume('req-revert', $id);

            return $this->ok("Surtido de {$saved['folio']} revertido: lo que salió regresó al almacén.", $saved);
        }, 'No se pudo revertir. Intenta de nuevo.');
    }
}

Permission::dispatch(new ctrl(), 'inv-surtir');
