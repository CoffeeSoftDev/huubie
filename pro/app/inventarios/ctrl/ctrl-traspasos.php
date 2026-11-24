<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Traspasos (folio TRA-KAF-0001): mandar mercancía a otro almacén de la
    empresa (otra sucursal o, si la sucursal tiene dos, el otro).

    Dos pasos y sin «En tránsito» (decisión del ERP, 11/06/2026):
      1. El origen lo envía: queda Solicitado y NO mueve nada.
      2. El destino lo recibe con lo que de verdad llegó: en ese momento resta
         del origen lo enviado y suma al destino lo recibido. O lo rechaza.
    El origen lo cancela mientras nadie lo recibe. Rechazar y cancelar no
    mueven existencia: todavía no se había movido nada.

    Los lotes viajan: lo que sale del lote que vence primero llega al destino
    con el mismo lote y la misma caducidad.

    Casillas: show, create (enviar), update (recibir o rechazar), cancel,
    print, ver-costos. */
class ctrl extends core {

    const SECTION   = 'inv-traspasos';
    const MAX_LINES = 200;

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->baseInit([
            'counts' => ['pending' => $this->qCountIncoming($this->companyId(), $this->branchId())]
        ]);
    }

    // -- A dónde se puede mandar --
    /*  Todos los almacenes de la empresa. La sucursal que todavía no tiene
        almacén sale con el suyo por crear (id «b<sucursal>»): se crea al enviar. */

    private function destinations() {
        $byBranch = [];

        foreach ($this->qWarehouses($this->companyId()) as $w) $byBranch[(int) $w['branch_id']][] = $w;

        $list = [];

        foreach ($this->qBranches($this->companyId()) as $b) {
            $branchId = (int) $b['id'];
            $short    = $this->shortBranch($b['name']);

            if (empty($byBranch[$branchId])) {
                $list[] = ['id' => 'b' . $branchId, 'valor' => 'Almacén ' . $short];
                continue;
            }

            foreach ($byBranch[$branchId] as $w) {
                $suffix = mb_stripos($w['name'], $short, 0, 'UTF-8') === false ? ' · ' . $short : '';
                $list[] = ['id' => (string) $w['id'], 'valor' => $w['name'] . $suffix];
            }
        }

        return $list;
    }

    // El destino elegido ('12' o 'b3') como almacén de la empresa; null si no es válido.
    private function resolveDestination($value) {
        if (preg_match('/^b(\d+)$/', $value, $m)) {
            $branch = $this->qBranch((int) $m[1]);

            if (!$branch || (int) $branch['company_id'] !== $this->companyId()) return null;

            $list = $this->branchWarehouses((int) $branch['id'], $branch['name']);

            return $list ? $list[0] : null;
        }

        foreach ($this->qWarehouses($this->companyId()) as $w) {
            if ((int) $w['id'] === (int) $value) return $w;
        }

        return null;
    }

    public function formOptions() {
        $fail = $this->needBranch() ?: $this->need('create', 'enviar traspasos');
        if ($fail) return $fail;

        return [
            'status'       => 200,
            'costs'        => $this->costs(),
            'warehouses'   => $this->warehouseOptions(),
            'destinations' => $this->destinations(),
            'products'     => $this->captureProducts()
        ];
    }

    // -- Lista --

    // tab: 'out' enviados · 'pending' por recibir (sin fechas) · 'in' recibidos y cerrados.
    public function lsTransfers() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver los traspasos');
        if ($fail) return $fail;

        $tab    = in_array($this->post('tab'), ['out', 'pending', 'in'], true) ? $this->post('tab') : 'out';
        $status = in_array($this->post('status'), ['REQUESTED', 'RECEIVED', 'REJECTED', 'CANCELLED'], true) ? $this->post('status') : '';

        [$from, $to] = $this->period();

        $list  = $this->qListTransfers($this->companyId(), $this->branchId(), $tab, $from, $to, $status);
        $users = $this->names($list, ['requested_user_id', 'received_user_id']);
        $costs = $this->costs();
        $rows  = [];
        $total = 0.0;

        foreach ($list as $t) {
            if (!in_array($t['status_code'], ['REJECTED', 'CANCELLED'], true)) $total += (float) $t['total_cost'];
            $rows[] = $this->transferRow($t, $tab, $users, $costs);
        }

        return [
            'status'  => 200,
            'row'     => $rows,
            'summary' => array_merge(['docs' => count($list)], $costs ? ['total' => round($total, 2)] : []),
            'pending' => $this->qCountIncoming($this->companyId(), $this->branchId())
        ];
    }

    private function transferRow($t, $tab, $users, $costs) {
        $id   = (int) $t['id'];
        $mine = $this->branchId();
        $open = $t['status_code'] === 'REQUESTED';

        $row = [
            'id'        => $id,
            'Folio'     => cellTitle($t['folio'], $t['note'] ?: ''),
            'Fecha'     => $this->dateCell(substr($t['created_at'], 0, 10), $t['created_at']),
            'Origen'    => cellTitle($t['origin_warehouse'], (int) $t['origin_branch_id'] === $mine ? 'Esta sucursal' : ''),
            'Destino'   => cellTitle($t['destination_warehouse'], (int) $t['destination_branch_id'] === $mine ? 'Esta sucursal' : ''),
            'Productos' => (int) $t['total_products']
        ];

        if ($costs) $row['Importe'] = moneyCell($t['total_cost']);

        $row['Estado']  = $this->transferChip($t, $tab === 'out' ? 'out' : 'in');
        $row['Envió']   = h($users[(int) $t['requested_user_id']] ?? '—');
        $row['Recibió'] = $t['received_user_id'] ? h($users[(int) $t['received_user_id']] ?? '—') : '<span class="cp-celda-sub">—</span>';
        $row['a']       = [$this->rowButton('eye', 'Ver detalle', "traspasos.show({$id})")];

        if ($open && (int) $t['destination_branch_id'] === $mine && $this->can('update')) {
            $row['a'][] = $this->rowButton('package-check', 'Recibir', "traspasos.receive({$id})");
        }

        if ($open && $tab === 'out' && $this->can('cancel')) {
            $row['a'][] = $this->rowButton('ban', 'Cancelar', "traspasos.cancel({$id})", 'warn');
        }

        return $row;
    }

    // El estado como lo ve cada lado: quien envía «Enviado / Entregado», quien recibe «Por recibir / Recibido».
    private function transferChip($t, $side) {
        $label = $side === 'out' ? ($t['name_out'] ?: $t['status_name']) : ($t['name_in'] ?: $t['status_name']);

        return $this->colorChip($label, $t['status_color']);
    }

    // El traspaso, solo si la sucursal es su origen o su destino.
    private function ownTransfer($id) {
        $t = $this->qGetTransfer($id, $this->companyId());

        if (!$t) return null;

        $mine = $this->branchId();

        return ((int) $t['origin_branch_id'] === $mine || (int) $t['destination_branch_id'] === $mine) ? $t : null;
    }

    // -- Detalle --

    public function getTransfer() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver los traspasos');
        if ($fail) return $fail;

        $t = $this->ownTransfer($this->postId());
        if (!$t) return $this->fail(404, 'Ese traspaso no es de la sucursal.');

        $id       = (int) $t['id'];
        $mine     = $this->branchId();
        $isOrigin = (int) $t['origin_branch_id'] === $mine;
        $isDest   = (int) $t['destination_branch_id'] === $mine;
        $open     = $t['status_code'] === 'REQUESTED';
        $done     = $t['status_code'] === 'RECEIVED';
        $costs    = $this->costs();
        $history  = $this->qTransferHistory($id);
        $users    = $this->names(array_merge([$t], $history), ['requested_user_id', 'received_user_id', 'user_id']);
        $lines    = [];
        $items    = [];

        foreach ($this->qTransferLines($id) as $d) {
            $unit = $d['unit'] ?: 'PZA';
            $sent = (float) $d['quantity'];
            $got  = $d['quantity_received'] === null ? $sent : (float) $d['quantity_received'];

            $line = [
                'Clave'    => $d['sku'] ? h($d['sku']) : '<span class="cp-celda-sub">—</span>',
                'Producto' => h($d['name']),
                'Enviado'  => $this->qty($sent, $unit)
            ];

            if ($done) {
                $line['Recibido'] = '<span class="font-semibold">' . $this->qty($got, $unit) . '</span>'
                    . ($got + 0.00001 < $sent ? ' <span class="cp-chip bg-amber-50 text-amber-700">Faltó ' . h($this->num($sent - $got)) . '</span>' : '');
            }

            if ($costs) {
                $line['Costo']   = money($d['cost']);
                $line['Importe'] = money($d['subtotal']);
            }

            if ($done) {
                $line['Origen']  = $this->moveCell($d['origin_previous_stock'], $d['origin_resulting_stock']);
                $line['Destino'] = $d['destination_resulting_stock'] === null
                    ? '<span class="cp-celda-sub">—</span>'
                    : $this->moveCell($d['destination_previous_stock'], $d['destination_resulting_stock']);
            }

            $lines[] = $line;
            $items[] = ['id' => (int) $d['id'], 'sku' => (string) $d['sku'], 'name' => $d['name'], 'unit' => $unit, 'decimals' => (int) $d['decimals'], 'quantity' => $sent];
        }

        return [
            'status'  => 200,
            'data'    => [
                'id'                 => $id,
                'folio'              => $t['folio'],
                'status_code'        => $t['status_code'],
                'status'             => $isOrigin ? ($t['name_out'] ?: $t['status_name']) : ($t['name_in'] ?: $t['status_name']),
                'status_color'       => $t['status_color'],
                'origin'             => $t['origin_warehouse'],
                'origin_branch'      => $this->shortBranch($t['origin_branch']),
                'destination'        => $t['destination_warehouse'],
                'destination_branch' => $this->shortBranch($t['destination_branch']),
                'is_origin'          => $isOrigin,
                'is_destination'     => $isDest,
                'note'               => $t['note'],
                'receive_note'       => $t['receive_note'],
                'reject_reason'      => $t['reject_reason'],
                'created'            => date('d/m/Y H:i', strtotime($t['created_at'])),
                'user'               => $users[(int) $t['requested_user_id']] ?? '—',
                'received'           => $t['received_at'] ? date('d/m/Y H:i', strtotime($t['received_at'])) : '',
                'receiver'           => $t['received_at'] ? ($users[(int) $t['received_user_id']] ?? '—') : '',
                'products'           => (int) $t['total_products'],
                'total'              => $costs ? round((float) $t['total_cost'], 2) : null,
                'can_receive'        => $open && $isDest && $this->can('update'),
                'can_reject'         => $open && $isDest && $this->can('update'),
                'can_cancel'         => $open && $isOrigin && $this->can('cancel')
            ],
            'lines'   => $lines,
            'items'   => $items,
            'history' => array_map(function ($h) use ($users) {
                return [
                    'status' => $h['name'],
                    'code'   => $h['code'],
                    'color'  => $h['color_hex'],
                    'user'   => $users[(int) $h['user_id']] ?? '—',
                    'when'   => date('d/m/Y H:i', strtotime($h['created_at'])),
                    'note'   => $h['note']
                ];
            }, $history)
        ];
    }

    // «10 → 5»: lo que había y lo que quedó en ese almacén.
    private function moveCell($before, $after) {
        return h($this->num($before)) . ' <span class="cp-celda-sub">→</span> <span class="font-semibold">' . h($this->num($after)) . '</span>';
    }

    // -- Enviar --

    public function addTransfer() {
        $fail = $this->needBranch() ?: $this->need('create', 'enviar traspasos');
        if ($fail) return $fail;

        $origin = $this->ownWarehouse($this->postId('warehouse_id'));
        if (!$origin) return $this->fail(400, 'Elige el almacén de donde sale.');

        $dest = $this->resolveDestination($this->post('destination'));
        if (!$dest) return $this->fail(400, 'Elige a dónde va.');
        if ((int) $dest['id'] === (int) $origin['id']) return $this->fail(400, 'El origen y el destino son el mismo almacén.');

        $lines = $this->linesInput($dest);
        if (isset($lines['status'])) return $lines;

        // Lo que hay hoy en el origen. No se bloquea: enviar no mueve nada y al recibir se vuelve a revisar.
        foreach ($lines as $l) {
            $have = $this->qStockRow((int) $origin['id'], $l['product_id']);
            $have = $have ? round((float) $have['quantity'], 4) : 0.0;

            if ($have + 0.00001 < $l['quantity']) {
                return $this->fail(409, 'Solo hay ' . $this->num(max(0, $have)) . " {$l['unit']} de «{$l['name']}» en {$origin['name']}.");
            }
        }

        $statusId = $this->qTransferStatusId('REQUESTED', $this->companyId());
        if (!$statusId) return $this->fail(500, 'Faltan los estados del traspaso en la base.');

        return $this->attempt(function () use ($origin, $dest, $lines, $statusId) {
            $folio = $this->transaction(function () use ($origin, $dest, $lines, $statusId) {
                $folio = $this->nextFolio('TRA');
                $total = 0.0;
                $units = 0.0;

                foreach ($lines as $l) {
                    $total += $l['subtotal'];
                    $units += $l['quantity'];
                }

                $this->must($this->qCreateTransfer(
                    ['folio', 'note', 'total_products', 'total_units', 'total_cost', 'requested_at', 'transfer_status_id', 'requested_user_id',
                     'company_id', 'origin_branch_id', 'destination_branch_id', 'origin_warehouse_id', 'destination_warehouse_id', 'active'],
                    [$folio, $this->textOrNull('note'), count($lines), round($units, 4), round($total, 2), $this->qNow()['now'], $statusId, $this->userId(),
                     $this->companyId(), $this->branchId(), (int) $dest['branch_id'], (int) $origin['id'], (int) $dest['id'], 1]
                ), 'addTransfer');

                $transferId = $this->newId('addTransfer');

                foreach ($lines as $l) {
                    $this->must($this->qCreateTransferLine(
                        ['quantity', 'cost', 'subtotal', 'inventory_transfer_id', 'product_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['subtotal'], $transferId, $l['product_id'], 1]
                    ), 'addTransfer/line');
                }

                $this->history($transferId, $statusId, null);

                return $folio;
            });

            return $this->ok("Traspaso {$folio} enviado a {$dest['name']}. Se mueve cuando allá lo reciban.", ['folio' => $folio]);
        }, 'No se pudo enviar el traspaso. Intenta de nuevo.');
    }

    /*  Renglones (JSON en lines): product_id y quantity. El mismo producto dos
        veces se junta. El costo es el último del Catálogo. El destino tiene que
        ver el producto en su Catálogo: si no, lo que llegue quedaría escondido. */
    private function linesInput($dest) {
        $raw = $this->postedJson('lines');

        if (!$raw)                         return $this->fail(400, 'Agrega al menos un producto.');
        if (count($raw) > self::MAX_LINES) return $this->fail(400, 'Son demasiados renglones: máximo ' . self::MAX_LINES . ' por traspaso.');

        $products   = array_column($this->products(), null, 'id');
        $destBranch = (int) $dest['branch_id'];
        $lines      = [];

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

            if ($destBranch !== $this->branchId() && !$this->qProduct($id, $this->companyId(), $destBranch, $this->mainBranchId())) {
                return $this->fail(400, "«{$p['name']}» no está en el Catálogo de " . $this->shortBranch($dest['branch'] ?? '') . ': dalo de alta en la Matriz para que lo vean todas las sucursales.');
            }

            $lines[$id] = ['product_id' => $id, 'name' => $p['name'], 'unit' => $p['unit'] ?: 'PZA', 'quantity' => $qty, 'cost' => round((float) $p['cost'], 4)];
        }

        foreach ($lines as &$l) $l['subtotal'] = round($l['quantity'] * $l['cost'], 2);
        unset($l);

        return array_values($lines);
    }

    private function history($transferId, $statusId, $note) {
        $this->must($this->qCreateTransferHistory(
            ['note', 'user_id', 'inventory_transfer_id', 'transfer_status_id', 'active'],
            [$note, $this->userId(), $transferId, $statusId, 1]
        ), 'transfer/history');
    }

    // -- Recibir --

    /*  lines (JSON): [{id: renglón, received}]. Sin dato = llegó todo. Si llegó
        menos, la nota es obligatoria. Resta del origen lo enviado y suma al
        destino lo recibido, a la vez; el origen tiene que tener todavía lo enviado. */
    public function receiveTransfer() {
        $fail = $this->needBranch() ?: $this->need('update', 'recibir traspasos');
        if ($fail) return $fail;

        $id       = $this->postId();
        $note     = $this->textOrNull('receive_note');
        $received = [];

        foreach ($this->postedJson('lines') ?: [] as $item) {
            $received[(int) ($item['id'] ?? 0)] = is_numeric($item['received'] ?? null) ? round((float) $item['received'], 4) : -1;
        }

        $statusId = $this->qTransferStatusId('RECEIVED', $this->companyId());
        if (!$statusId) return $this->fail(500, 'Faltan los estados del traspaso en la base.');

        return $this->attempt(function () use ($id, $note, $received, $statusId) {
            $done = $this->transaction(function () use ($id, $note, $received, $statusId) {
                $this->qLockTransfer($id);

                $t = $this->ownTransfer($id);

                if (!$t)                                                     throw new InvStop('Ese traspaso no es de la sucursal.');
                if ((int) $t['destination_branch_id'] !== $this->branchId()) throw new InvStop('Lo recibe la sucursal a donde va.');
                if ($t['status_code'] !== 'REQUESTED')                       throw new InvStop("El traspaso {$t['folio']} ya está " . mb_strtolower($t['name_in'] ?: $t['status_name'], 'UTF-8') . '.');

                $lines = $this->qTransferLines($id);
                $short = false;
                $any   = false;

                // Primero se revisa todo; después se mueve.
                foreach ($lines as &$d) {
                    $sent = (float) $d['quantity'];
                    $got  = array_key_exists((int) $d['id'], $received) ? $received[(int) $d['id']] : $sent;
                    $unit = $d['unit'] ?: 'PZA';

                    if ($got < 0 || $got > $sent + 0.00001) throw new InvStop("Lo recibido de «{$d['name']}» va de 0 a " . $this->num($sent) . " {$unit}.");
                    if ((int) $d['decimals'] !== 1 && floor($got) != $got) throw new InvStop("«{$d['name']}» se cuenta en {$unit}: sin decimales.");

                    $d['got'] = $got;

                    if ($got + 0.00001 < $sent) $short = true;
                    if ($got > 0)               $any   = true;
                }
                unset($d);

                if (!$any)                    throw new InvStop('No llegó nada: recházalo y escribe por qué.');
                if ($short && $note === null) throw new InvStop('Llegó menos de lo enviado: escribe en la nota qué pasó.');

                $originWh = (int) $t['origin_warehouse_id'];
                $destWh   = (int) $t['destination_warehouse_id'];

                foreach ($lines as $d) {
                    $productId = (int) $d['product_id'];
                    $sent      = (float) $d['quantity'];
                    $have      = $this->qStockRow($originWh, $productId, true);
                    $have      = $have ? round((float) $have['quantity'], 4) : 0.0;

                    if ($have + 0.00001 < $sent) {
                        throw new InvStop("En {$t['origin_warehouse']} ya no alcanza «{$d['name']}»: hay " . $this->num(max(0, $have))
                            . ' y se enviaron ' . $this->num($sent) . '. Pide que lo revisen allá antes de recibir.');
                    }

                    $pieces = $this->takeLotPieces($originWh, $productId, $sent);

                    [$originPrev, $originPost] = $this->stockMove($originWh, $productId, -$sent);
                    [$destPrev, $destPost]     = $d['got'] > 0 ? $this->stockMove($destWh, $productId, $d['got']) : [null, null];

                    if ($d['got'] > 0) $this->copyLots($pieces, $d['got'], $destWh, $productId);

                    $this->must($this->qSetTransferLineStock((int) $d['id'], $d['got'], $originPrev, $originPost, $destPrev, $destPost), 'receiveTransfer/line');
                }

                $this->must($this->qUpdateTransfer(
                    ['transfer_status_id', 'received_at = NOW()', 'received_user_id', 'receive_note'],
                    [$statusId, $this->userId(), $note, $id]
                ), 'receiveTransfer');

                $this->history($id, $statusId, $note);

                return ['folio' => $t['folio'], 'from' => $t['origin_warehouse'], 'to' => $t['destination_warehouse'], 'short' => $short];
            });

            return $this->ok("Traspaso {$done['folio']} recibido: restó de {$done['from']} y sumó a {$done['to']}.");
        }, 'No se pudo recibir el traspaso. Intenta de nuevo.');
    }

    // Lo recibido llega con los lotes que salieron del origen (mismo lote, caducidad y costo).
    private function copyLots(array $pieces, $received, $warehouseId, $productId) {
        $rest = $received;

        foreach ($pieces as $piece) {
            if ($rest <= 0) break;

            $qty  = round(min($piece['take'], $rest), 4);
            $rest = round($rest - $qty, 4);

            $this->must($this->qCreateLot(
                ['batch_code', 'initial_quantity', 'quantity', 'cost', 'produced_at', 'expires_at', 'company_id', 'warehouse_id', 'product_id', 'active'],
                [$piece['batch_code'], $qty, $qty, $piece['cost'], $piece['produced_at'], $piece['expires_at'], $this->companyId(), $warehouseId, $productId, 1]
            ), 'receiveTransfer/lot');
        }
    }

    // -- Rechazar (destino) y cancelar (origen) --

    public function rejectTransfer() {
        $fail = $this->needBranch() ?: $this->need('update', 'rechazar traspasos');
        if ($fail) return $fail;

        return $this->close('REJECTED', 'destination');
    }

    public function cancelTransfer() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar traspasos');
        if ($fail) return $fail;

        return $this->close('CANCELLED', 'origin');
    }

    // Cierra un traspaso Solicitado sin mover nada. side: quién puede hacerlo.
    private function close($code, $side) {
        $reason = $this->textOrNull('reason');
        if ($reason === null) return $this->fail(400, $code === 'REJECTED' ? 'Escribe por qué se rechaza.' : 'Escribe por qué se cancela.');

        $statusId = $this->qTransferStatusId($code, $this->companyId());
        if (!$statusId) return $this->fail(500, 'Faltan los estados del traspaso en la base.');

        $id = $this->postId();

        return $this->attempt(function () use ($id, $code, $side, $reason, $statusId) {
            $folio = $this->transaction(function () use ($id, $code, $side, $reason, $statusId) {
                $this->qLockTransfer($id);

                $t = $this->ownTransfer($id);

                if (!$t) throw new InvStop('Ese traspaso no es de la sucursal.');

                if ($side === 'destination' && (int) $t['destination_branch_id'] !== $this->branchId()) throw new InvStop('Lo rechaza la sucursal a donde va.');
                if ($side === 'origin' && (int) $t['origin_branch_id'] !== $this->branchId())           throw new InvStop('Lo cancela la sucursal que lo envió.');

                if ($t['status_code'] !== 'REQUESTED') {
                    throw new InvStop("El traspaso {$t['folio']} ya está " . mb_strtolower($side === 'origin' ? ($t['name_out'] ?: $t['status_name']) : ($t['name_in'] ?: $t['status_name']), 'UTF-8') . '.');
                }

                $this->must($this->qUpdateTransfer(['transfer_status_id', 'reject_reason'], [$statusId, $reason, $id]), 'closeTransfer');

                $this->history($id, $statusId, $reason);

                return $t['folio'];
            });

            return $this->ok("Traspaso {$folio} " . ($code === 'REJECTED' ? 'rechazado' : 'cancelado') . '. No se movió nada del inventario.');
        }, 'No se pudo cerrar el traspaso. Intenta de nuevo.');
    }
}

Permission::dispatch(new ctrl(), 'inv-traspasos');
