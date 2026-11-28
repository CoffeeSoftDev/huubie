<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Traspasos (folio TRA-KAF-0001): mandar mercancía a otro almacén de la
    empresa. La interfaz es la de inventory/operacion/almacen/traspasos (visor
    con KPIs por estado, ruta en el detalle; captura traspaso-form.js) aplicada
    al Catálogo de pro: los opc y las respuestas llevan los nombres de inventory.

    Dos pasos y sin «En tránsito» (decisión del ERP, 11/06/2026):
      1. El origen lo envía: queda Solicitado y NO mueve nada.
      2. El destino lo acepta (dice quién lo recibe): en ese momento resta del
         origen y suma al destino. O lo rechaza.
    El origen lo cancela mientras nadie lo recibe. Rechazar y cancelar no
    mueven existencia. Los lotes viajan con su caducidad.

    Casillas: show, create (enviar), update (aceptar o rechazar), cancel,
    print, ver-costos. */
class ctrl extends core {

    const SECTION   = 'inv-traspasos';
    const MAX_LINES = 200;

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->baseInit([
            'branch_id'  => $this->branchId(),
            'sucursales' => $this->companyBranches(),
            'costs'      => $this->costs()
        ]);
    }

    // Todas las sucursales activas de la empresa (destinos y filtro).
    private function companyBranches() {
        return array_map(function ($b) {
            return ['id' => (int) $b['id'], 'valor' => $b['name']];
        }, $this->qBranches($this->companyId()));
    }

    // -- Lo que pide la captura --

    /*  Almacenes de todas las sucursales (a la que no tenga se le crea el suyo:
        el traspaso necesita a dónde llegar), los productos de la sucursal con lo
        que hay en cada sucursal (stockPorSuc) y las categorías. */
    public function getCatalogosTraspaso() {
        $fail = $this->needBranch() ?: $this->need('create', 'enviar traspasos');
        if ($fail) return $fail;

        $almacenes = [];
        $byBranch  = [];

        foreach ($this->qBranches($this->companyId()) as $b) {
            foreach ($this->branchWarehouses((int) $b['id'], $b['name']) as $w) {
                $almacenes[] = ['id' => (int) $w['id'], 'valor' => $w['name'], 'branch_id' => (int) $w['branch_id']];
                $byBranch[(int) $w['id']] = (int) $w['branch_id'];
            }
        }

        $stock = [];

        foreach ($this->qStockRows(array_keys($byBranch)) as $row) {
            $pid = (int) $row['product_id'];
            $bid = (string) $byBranch[(int) $row['warehouse_id']];

            $stock[$pid][$bid] = round(($stock[$pid][$bid] ?? 0) + (float) $row['quantity'], 4);
        }

        $productos = array_map(function ($p) use ($stock) {
            $p['stockPorSuc'] = (object) ($stock[(int) $p['id']] ?? []);

            return $p;
        }, $this->catalogProducts());

        return [
            'status'     => 200,
            'sucursales' => $this->companyBranches(),
            'almacenes'  => $almacenes,
            'categorias' => $this->categoryList(),
            'productos'  => $productos
        ];
    }

    // -- Lista y KPIs --

    private function filtered() {
        [$from, $to] = $this->period();

        $relative = in_array($this->post('relative'), ['enviados', 'por_recibir', 'entregados', 'recibidos', 'rechazados'], true) ? $this->post('relative') : '';

        return $this->qTransfersOf($this->companyId(), $this->branchId(), $from, $to, $relative, $this->selectOrNull('destination_branch_id'));
    }

    // Columnas: Folio, Origen, Destino, Productos, Unidades [, Costo], Solicitó, Recibió, Estado, Solicitud
    public function lsTraspasos() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver los traspasos');
        if ($fail) return $fail;

        $list  = $this->filtered();
        $users = $this->names($list, ['requested_user_id', 'received_user_id']);
        $costs = $this->costs();
        $rows  = [];

        foreach ($list as $t) {
            $id   = (int) $t['id'];
            $open = "app.selectTraspaso('" . h($t['folio']) . "', {$id})";
            $row  = [
                'id'        => $id,
                'Folio'     => ['html' => $this->folioLink($t['folio'], $open)],
                'Origen'    => $this->branchChip($t['origin_branch_id'], $t['origin_branch'], $t['origin_warehouse'], true),
                'Destino'   => $this->branchChip($t['destination_branch_id'], $t['destination_branch'], $t['destination_warehouse'], false),
                'Productos' => (int) $t['total_products'],
                'Unidades'  => $this->num($t['total_units'])
            ];

            if ($costs) $row['Costo'] = $this->money($t['total_cost']);

            $row['Solicitó']  = h($users[(int) $t['requested_user_id']] ?? '-');
            $row['Recibió']   = $t['received_user_id'] ? h($users[(int) $t['received_user_id']] ?? '-') : '-';
            $row['Estado']    = $this->badge($this->relativeName($t), $t['status_color']);
            $row['Solicitud'] = $this->dateTime(substr($t['created_at'], 0, 10), $t['created_at']);
            $row['a']         = [$this->rowIcon('eye', $open, 'Ver detalle')];

            $rows[] = $row;
        }

        return ['status' => 200, 'row' => $rows];
    }

    // El estado como lo ve la sucursal: quien envía «Enviado / Entregado», quien recibe «Por recibir / Recibido».
    private function relativeName($t) {
        if ((int) $t['origin_branch_id'] === $this->branchId()) return $t['name_out'] ?: $t['status_name'];
        if ((int) $t['destination_branch_id'] === $this->branchId()) return $t['name_in'] ?: $t['status_name'];

        return $t['status_name'];
    }

    // La sucursal con su ícono de tienda (un color por sucursal) y el almacén debajo.
    private function branchChip($branchId, $branch, $warehouse, $arrow) {
        $palette = [
            ['text-blue-500',   'rgb(var(--brand-600, 192 90 64) / 0.15)', 'rgb(var(--brand-600, 192 90 64) / 0.35)'],
            ['text-green-500',  'rgba(63,193,137,0.15)',  'rgba(63,193,137,0.35)'],
            ['text-purple-500', 'rgba(168,85,247,0.15)',  'rgba(168,85,247,0.35)'],
            ['text-pink-500',   'rgba(244,114,182,0.15)', 'rgba(244,114,182,0.35)'],
            ['text-orange-500', 'rgba(251,146,60,0.15)',  'rgba(251,146,60,0.35)'],
            ['text-cyan-500',   'rgba(34,211,238,0.15)',  'rgba(34,211,238,0.35)']
        ];
        $p = $palette[(int) $branchId % count($palette)];

        return "<div class='flex items-center gap-2 w-full text-left'>"
             . "<div class='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0' style='background:{$p[1]};border:1px solid {$p[2]};'>"
             . "<i data-lucide='store' class='w-4 h-4 {$p[0]}'></i></div>"
             . "<div class='min-w-0'><div class='font-semibold text-gray-800 truncate leading-tight'>" . h($this->shortBranch($branch) ?: '-') . '</div>'
             . ($warehouse ? "<div class='text-[10px] text-gray-500 truncate'>" . h($warehouse) . '</div>' : '') . '</div>'
             . ($arrow ? "<i data-lucide='arrow-right' class='w-4 h-4 text-gray-500 flex-shrink-0 ml-auto'></i>" : '')
             . '</div>';
    }

    /*  Las tarjetas: Total del periodo, Enviados, Por recibir (estos dos, todo
        lo que sigue abierto), Entregados, Recibidos y Rechazados del periodo. */
    public function showTraspasos() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver los traspasos');
        if ($fail) return $fail;

        [$from, $to] = $this->period();

        $count = function ($relative) use ($from, $to) {
            return count($this->qTransfersOf($this->companyId(), $this->branchId(), $from, $to, $relative, null));
        };

        return [
            'status' => 200,
            'counts' => [
                'total'       => $count(''),
                'enviados'    => $count('enviados'),
                'por_recibir' => $count('por_recibir'),
                'entregados'  => $count('entregados'),
                'recibidos'   => $count('recibidos'),
                'rechazados'  => $count('rechazados')
            ]
        ];
    }

    // El traspaso, solo si la sucursal es su origen o su destino.
    private function ownTransfer($id) {
        $t = $this->qGetTransfer($id, $this->companyId());

        if (!$t) return null;

        $mine = $this->branchId();

        return ((int) $t['origin_branch_id'] === $mine || (int) $t['destination_branch_id'] === $mine) ? $t : null;
    }

    // -- Detalle --

    public function getTraspaso() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver los traspasos');
        if ($fail) return $fail;

        $t = $this->ownTransfer($this->postId());
        if (!$t) return $this->fail(404, 'Ese traspaso no es de la sucursal.');

        $id      = (int) $t['id'];
        $history = $this->qTransferHistory($id);
        $users   = $this->names(array_merge([$t], $history), ['requested_user_id', 'received_user_id', 'user_id']);
        $costs   = $this->costs();
        $out     = (int) $t['origin_branch_id'] === $this->branchId();

        return [
            'status'  => 200,
            'costs'   => $costs,
            'header'  => [
                'id'                         => $id,
                'folio'                      => $t['folio'],
                'status_code'                => $t['status_code'],
                'relative_status_name'       => $this->relativeName($t),
                'status_color'               => $t['status_color'],
                'date_request'               => $t['created_at'],
                'date_received'              => $t['received_at'],
                'requested_user_name'        => $users[(int) $t['requested_user_id']] ?? '-',
                'received_user_name'         => $t['received_user_id'] ? ($users[(int) $t['received_user_id']] ?? '-') : '',
                'received_by_name'           => $t['receive_note'] ?: '',
                'reject_reason'              => $t['reject_reason'] ?: '',
                'note'                       => $t['note'],
                'origin_branch_id'           => (int) $t['origin_branch_id'],
                'origin_branch_name'         => $this->shortBranch($t['origin_branch']),
                'origin_warehouse_name'      => $t['origin_warehouse'],
                'destination_branch_id'      => (int) $t['destination_branch_id'],
                'destination_branch_name'    => $this->shortBranch($t['destination_branch']),
                'destination_warehouse_name' => $t['destination_warehouse'],
                'can_accept'                 => $t['status_code'] === 'REQUESTED' && !$out && $this->can('update'),
                'can_cancel'                 => $t['status_code'] === 'REQUESTED' && $out && $this->can('cancel')
            ],
            'detail'  => array_map(function ($d) use ($costs) {
                return [
                    'item_name' => $d['name'],
                    'sku'       => $d['sku'],
                    'unit'      => $d['unit'] ?: 'PZA',
                    'quantity'  => (float) $d['quantity'],
                    'cost'      => $costs ? (float) $d['cost'] : 0
                ];
            }, $this->qTransferLines($id)),
            'history' => array_map(function ($h) use ($users, $out) {
                return [
                    'status_name'     => ($out ? $h['name_out'] : $h['name_in']) ?: $h['name'],
                    'user_name'       => $users[(int) $h['user_id']] ?? '-',
                    'transitioned_at' => $h['created_at'],
                    'note'            => $h['note']
                ];
            }, $history)
        ];
    }

    // -- Enviar --

    /*  payload (JSON): origin_branch_id, origin_warehouse_id,
        destination_branch_id, destination_warehouse_id, note y productos
        [{item_id, quantity}]. Sale de la sucursal de arriba. */
    public function saveTraspaso() {
        $fail = $this->needBranch() ?: $this->need('create', 'enviar traspasos');
        if ($fail) return $fail;

        $p = json_decode($this->post('payload'), true);
        if (!is_array($p)) return $this->fail(400, 'No llegaron los datos del traspaso.');

        if ((int) ($p['origin_branch_id'] ?? 0) !== $this->branchId()) return $this->fail(400, 'El traspaso sale de la sucursal de arriba: cámbiala ahí.');

        $origin = $this->ownWarehouse((int) ($p['origin_warehouse_id'] ?? 0));
        if (!$origin) return $this->fail(400, 'Elige el almacén de donde sale.');

        $dest = null;

        foreach ($this->qWarehouses($this->companyId()) as $w) {
            if ((int) $w['id'] === (int) ($p['destination_warehouse_id'] ?? 0)) $dest = $w;
        }

        if (!$dest || (int) $dest['branch_id'] !== (int) ($p['destination_branch_id'] ?? 0)) return $this->fail(400, 'Elige el almacén de la sucursal destino.');
        if ((int) $dest['id'] === (int) $origin['id']) return $this->fail(400, 'El origen y el destino son el mismo almacén.');

        $lines = $this->linesInput($p['productos'] ?? [], $dest);
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

        $note = mb_substr(trim((string) ($p['note'] ?? '')), 0, 255, 'UTF-8') ?: null;

        return $this->attempt(function () use ($origin, $dest, $lines, $statusId, $note) {
            $saved = $this->transaction(function () use ($origin, $dest, $lines, $statusId, $note) {
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
                    [$folio, $note, count($lines), round($units, 4), round($total, 2), $this->qNow()['now'], $statusId, $this->userId(),
                     $this->companyId(), $this->branchId(), (int) $dest['branch_id'], (int) $origin['id'], (int) $dest['id'], 1]
                ), 'saveTraspaso');

                $transferId = $this->newId('saveTraspaso');

                foreach ($lines as $l) {
                    $this->must($this->qCreateTransferLine(
                        ['quantity', 'cost', 'subtotal', 'inventory_transfer_id', 'product_id', 'active'],
                        [$l['quantity'], $l['cost'], $l['subtotal'], $transferId, $l['product_id'], 1]
                    ), 'saveTraspaso/line');
                }

                $this->history($transferId, $statusId, 'Traspaso solicitado');

                return ['folio' => $folio, 'id' => $transferId];
            });

            return $this->ok("Traspaso {$saved['folio']} enviado a {$dest['name']}. Se mueve cuando allá lo reciban.", $saved);
        }, 'No se pudo enviar el traspaso. Intenta de nuevo.');
    }

    /*  El mismo producto dos veces se junta. El costo es el último del Catálogo.
        El destino tiene que ver el producto en su Catálogo: si no, lo que llegue
        quedaría escondido. */
    private function linesInput($raw, $dest) {
        if (!is_array($raw) || !$raw)      return $this->fail(400, 'Agrega al menos un producto.');
        if (count($raw) > self::MAX_LINES) return $this->fail(400, 'Son demasiados renglones: máximo ' . self::MAX_LINES . ' por traspaso.');

        $products   = array_column($this->products(), null, 'id');
        $destBranch = (int) $dest['branch_id'];
        $lines      = [];

        foreach ($raw as $item) {
            $id = (int) ($item['item_id'] ?? $item['product_id'] ?? 0);
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

    // -- Aceptar (destino) --

    /*  received_by: quién recibe la mercancía. Resta del origen y suma al
        destino a la vez; el origen tiene que tener todavía lo enviado. */
    public function confirmTraspaso() {
        $fail = $this->needBranch() ?: $this->need('update', 'recibir traspasos');
        if ($fail) return $fail;

        $id = $this->postId();
        $by = mb_substr(trim(preg_replace('/\s+/u', ' ', $this->post('received_by'))), 0, 255, 'UTF-8');

        if ($by === '') return $this->fail(400, 'Indica quién recibe el traspaso.');

        $statusId = $this->qTransferStatusId('RECEIVED', $this->companyId());
        if (!$statusId) return $this->fail(500, 'Faltan los estados del traspaso en la base.');

        return $this->attempt(function () use ($id, $by, $statusId) {
            $done = $this->transaction(function () use ($id, $by, $statusId) {
                $this->qLockTransfer($id);

                $t = $this->ownTransfer($id);

                if (!$t)                                                     throw new InvStop('Ese traspaso no es de la sucursal.');
                if ((int) $t['destination_branch_id'] !== $this->branchId()) throw new InvStop('Lo recibe la sucursal a donde va.');
                if ($t['status_code'] !== 'REQUESTED')                       throw new InvStop("El traspaso {$t['folio']} ya está " . mb_strtolower($t['name_in'] ?: $t['status_name'], 'UTF-8') . '.');

                $originWh = (int) $t['origin_warehouse_id'];
                $destWh   = (int) $t['destination_warehouse_id'];

                foreach ($this->qTransferLines($id) as $d) {
                    $productId = (int) $d['product_id'];
                    $qty       = (float) $d['quantity'];
                    $have      = $this->qStockRow($originWh, $productId, true);
                    $have      = $have ? round((float) $have['quantity'], 4) : 0.0;

                    if ($have + 0.00001 < $qty) {
                        throw new InvStop("En {$t['origin_warehouse']} ya no alcanza «{$d['name']}»: hay " . $this->num(max(0, $have))
                            . ' y se enviaron ' . $this->num($qty) . '. Pide que lo revisen allá antes de recibir.');
                    }

                    $pieces = $this->takeLotPieces($originWh, $productId, $qty);

                    [$originPrev, $originPost] = $this->stockMove($originWh, $productId, -$qty);
                    [$destPrev, $destPost]     = $this->stockMove($destWh, $productId, $qty);

                    $this->copyLots($pieces, $qty, $destWh, $productId);

                    $this->must($this->qSetTransferLineStock((int) $d['id'], $qty, $originPrev, $originPost, $destPrev, $destPost), 'confirmTraspaso/line');
                }

                $this->must($this->qUpdateTransfer(
                    ['transfer_status_id', 'received_at = NOW()', 'received_user_id', 'receive_note'],
                    [$statusId, $this->userId(), $by, $id]
                ), 'confirmTraspaso');

                $this->history($id, $statusId, "Traspaso recibido · Recibe: {$by}");

                return $t;
            });

            return $this->ok("Traspaso {$done['folio']} recibido: restó de {$done['origin_warehouse']} y sumó a {$done['destination_warehouse']}.");
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
            ), 'confirmTraspaso/lot');
        }
    }

    // -- Rechazar (destino) y cancelar la solicitud (origen): no mueven nada --

    public function rejectTraspaso() {
        $fail = $this->needBranch() ?: $this->need('update', 'rechazar traspasos');
        if ($fail) return $fail;

        return $this->close('REJECTED', 'destination', $this->textOrNull('note') ?: 'Traspaso rechazado');
    }

    public function cancelTraspaso() {
        $fail = $this->needBranch() ?: $this->need('cancel', 'cancelar traspasos');
        if ($fail) return $fail;

        return $this->close('CANCELLED', 'origin', $this->textOrNull('note') ?: 'Traspaso cancelado por el solicitante');
    }

    private function close($code, $side, $reason) {
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

                $this->must($this->qUpdateTransfer(['transfer_status_id', 'reject_reason'], [$statusId, $reason, $id]), 'closeTraspaso');

                $this->history($id, $statusId, $reason);

                return $t['folio'];
            });

            return $this->ok("Traspaso {$folio} " . ($code === 'REJECTED' ? 'rechazado' : 'cancelado') . '. No se movió nada del inventario.');
        }, 'No se pudo cerrar el traspaso. Intenta de nuevo.');
    }
}

Permission::dispatch(new ctrl(), 'inv-traspasos');
