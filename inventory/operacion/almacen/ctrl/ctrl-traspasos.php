<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-traspasos.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id']  ?? $_POST['companies_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']   ?? $_POST['branch_id']    ?? 0);
        $this->userId      = (int) ($_SESSION['user_id']     ?? $_POST['user_id']      ?? 0);
    }

    function init() {
        return [
            'status'           => 200,
            'companies_id'     => $this->companiesId,
            'branch_id'        => $this->branchId,
            'user_id'          => $this->userId,
            'sucursales'       => $this->lsSucursales([$this->companiesId]),
            'almacenes'        => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'estados_traspaso' => $this->lsTransferStatuses()
        ];
    }

    function getCatalogosTraspaso() {
        $cid = $this->companiesId;

        $items    = $this->listItemsForTransfer([$cid]);
        $stockRows = $this->listStockByBranch([$cid]);

        $stockMap = [];
        foreach ($stockRows as $s) {
            $iid = (int) $s['item_id'];
            $bid = (string) $s['branch_id'];
            if (!isset($stockMap[$iid])) $stockMap[$iid] = [];
            $stockMap[$iid][$bid] = (float) $s['qty'];
        }

        foreach ($items as &$p) {
            $iid = (int) $p['id'];
            $p['id']          = (string) $p['id'];
            $p['categoria']   = $p['categoria'] ?: '-';
            $p['sku']         = $p['sku'] ?: '';
            $p['icon']        = 'package';
            $p['bg']          = 'bg-gray-700/40';
            $p['color']       = 'text-gray-300';
            $p['stockPorSuc'] = isset($stockMap[$iid]) ? (object) $stockMap[$iid] : (object) [];
        }
        unset($p);

        return [
            'status'    => 200,
            'sucursales' => $this->lsSucursales([$cid]),
            'almacenes'  => $this->lsWarehouses(['companies_id' => $cid]),
            'categorias' => [],
            'productos'  => $items
        ];
    }

    function lsTraspasos() {
        $rows = $this->listTraspasos([
            'companies_id'         => $this->companiesId,
            'status_id'            => $_POST['status_id'] ?? '',
            'scope_branch_id'      => $_POST['scope_branch_id'] ?? '',
            'destination_branch_id' => $_POST['destination_branch_id'] ?? '',
            'fi'                   => $_POST['fi'] ?? '',
            'ff'                   => $_POST['ff'] ?? '',
            'q'                    => $_POST['q'] ?? ''
        ]);

        $row = [];

        foreach ($rows as $r) {
            $acciones = [
                [
                    'class'   => 'btn btn-sm btn-secondary me-1',
                    'html'    => '<i class="icon-eye"></i>',
                    'onclick' => "app.selectTraspaso('{$r['folio']}', {$r['id']})"
                ]
            ];

            $origen  = sucChipCell(
                $r['origin_branch_id'],
                $r['origin_branch_name'],
                $r['origin_warehouse_name'],
                true
            );

            $destino = sucChipCell(
                $r['destination_branch_id'],
                $r['destination_branch_name'],
                $r['destination_warehouse_name'],
                false
            );

            $row[] = [
                'id'        => $r['id'],
                'Folio'     => $r['folio'],
                'Origen'    => $origen,
                'Destino'   => $destino,
                'Productos' => (int) $r['total_products'],
                'Unidades'  => (float) $r['total_units'],
                'Costo'     => evaluar((float) $r['total_cost']),
                'Solicito'  => $r['requested_user_name'] ?: '-',
                'Recibio'   => $r['received_user_name']  ?: '-',
                'Estado'    => pillBadge($r['status_name'], $r['status_color']),
                'Solicitud' => formatRequestDate($r['date_request']),
                'a'         => $acciones
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    function showTraspasos() {
        $kpis = $this->getTraspasoKpis([
            'companies_id'    => $this->companiesId,
            'scope_branch_id' => $_POST['scope_branch_id'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getTraspaso() {
        $id     = (int) $_POST['id'];
        $header = $this->getTraspasoById([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];
        $detail  = $this->listTraspasoDetail([$id]);
        $history = $this->listTraspasoHistory([$id]);
        return [
            'status'  => 200,
            'header'  => $header,
            'detail'  => $detail,
            'history' => $history
        ];
    }

    function saveTraspaso() {
        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $statusReq = $this->getTransferStatusByCode(['REQUESTED']);
        if (!$statusReq) return ['status' => 500, 'message' => 'Catalogo transfer_status sin REQUESTED'];

        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($productos as $p) {
            $totalUnits += (float) $p['quantity'];
            $totalCost  += (float) $p['quantity'] * (float) $p['cost'];
        }

        try {
            return $this->transaction(function () use ($productos, $payload, $statusReq, $totalProducts, $totalUnits, $totalCost) {
                $folio = $this->getNextFolio('TRA-', $this->companiesId);

                $this->createTraspaso([
                    $folio,
                    $payload['note'] ?? null,
                    $totalProducts,
                    $totalUnits,
                    $totalCost,
                    (int) $statusReq['id'],
                    (int) $payload['origin_warehouse_id'],
                    (int) $payload['destination_warehouse_id'],
                    (int) $payload['origin_branch_id'],
                    (int) $payload['destination_branch_id'],
                    $this->userId,
                    $this->companiesId
                ]);

                $traspasoId = $this->getTraspasoIdByFolio([$folio, $this->companiesId]);

                foreach ($productos as $p) {
                    $itemId  = (int) $p['item_id'];
                    $originWh = (int) $payload['origin_warehouse_id'];
                    $qty     = (float) $p['quantity'];
                    $cost    = (float) $p['cost'];

                    $originStock = $this->getStockRow([$itemId, $originWh]);
                    $originPrev  = $originStock ? (float) $originStock['quantity'] : 0;
                    $originPost  = max(0, $originPrev - $qty);

                    $this->createTraspasoDetail([
                        $qty,
                        $cost,
                        $qty * $cost,
                        $originPrev,
                        $originPost,
                        null,
                        null,
                        $itemId,
                        $traspasoId
                    ]);
                }

                $this->createTraspasoHistory([
                    'Traspaso solicitado',
                    (int) $statusReq['id'],
                    $this->userId,
                    $traspasoId
                ]);

                return ['status' => 200, 'message' => 'Traspaso solicitado', 'folio' => $folio, 'id' => $traspasoId];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo registrar el traspaso'];
        }
    }

    function confirmTraspaso() {
        $id         = (int) $_POST['id'];
        $receivedBy = trim($_POST['received_by'] ?? '');
        $st = $this->getTransferStatusByCode(['RECEIVED']);

        $header = $this->getTraspasoById([$id]);
        $detail = $this->listTraspasoDetail([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];

        $originWh = (int) $header['origin_warehouse_id'];
        $destWh   = (int) $header['destination_warehouse_id'];

        $alreadySent = ($header['status_code'] ?? '') === 'IN_TRANSIT';

        try {
            return $this->transaction(function () use ($id, $st, $header, $detail, $originWh, $destWh, $alreadySent, $receivedBy) {
                foreach ($detail as $d) {
                    $itemId = (int) $d['item_id'];
                    $qty    = (float) $d['quantity'];

                    $originStock = $this->getStockRow([$itemId, $originWh]);
                    $originPrev  = $originStock ? (float) $originStock['quantity'] : 0;
                    $originPost  = $alreadySent ? $originPrev : max(0, $originPrev - $qty);

                    $destStock = $this->getStockRow([$itemId, $destWh]);
                    $destPrev  = $destStock ? (float) $destStock['quantity'] : 0;
                    $destPost  = $destPrev + $qty;

                    if ($alreadySent) {
                        $this->updateTraspasoDetailDestinationStock([$destPrev, $destPost, (int) $d['id']]);
                    } else {
                        $this->updateTraspasoDetailStockSnapshots([$originPrev, $originPost, $destPrev, $destPost, (int) $d['id']]);
                        if ($originStock) {
                            $this->updateStockQuantity([$originPost, (int) $originStock['id']]);
                        }
                    }

                    if ($destStock) {
                        $this->updateStockQuantity([$destPost, (int) $destStock['id']]);
                    } else {
                        $this->createStockRow([$destPost, $destWh, $itemId, $this->companiesId]);
                    }
                }

                $this->updateTraspasoStatus([(int) $st['id'], $id]);
                $this->updateTraspasoReceived([$this->userId, $receivedBy !== '' ? $receivedBy : null, $id]);
                $nota = $receivedBy !== '' ? "Traspaso recibido · Recibe: {$receivedBy}" : 'Traspaso recibido';
                $this->createTraspasoHistory([$nota, (int) $st['id'], $this->userId, $id]);

                return ['status' => 200, 'message' => 'Traspaso recibido'];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo confirmar el traspaso'];
        }
    }

    function rejectTraspaso() {
        $id   = (int) $_POST['id'];
        $note = empty($_POST['note']) ? 'Traspaso rechazado' : $_POST['note'];
        $st   = $this->getTransferStatusByCode(['REJECTED']);

        try {
            return $this->transaction(function () use ($id, $note, $st) {
                $this->updateTraspasoStatus([(int) $st['id'], $id]);
                $this->createTraspasoHistory([$note, (int) $st['id'], $this->userId, $id]);
                return ['status' => 200, 'message' => 'Traspaso rechazado'];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo rechazar el traspaso'];
        }
    }
}

// Complements

function formatRequestDate($date) {
    $mesesAbr = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    $ts = strtotime($date);
    if (!$ts) return '-';
    return date('d', $ts) . '/' . $mesesAbr[(int) date('n', $ts)] . '/' . date('Y', $ts) . ' ' . date('h:i', $ts) . ' ' . date('a', $ts);
}

function sucChipCell($branchId, $branchName, $whName, $withArrow) {
    $palette = [
        ['icon' => 'text-blue-400',   'bg' => 'rgba(59,130,246,0.15)',  'border' => 'rgba(59,130,246,0.35)'],
        ['icon' => 'text-green-400',  'bg' => 'rgba(63,193,137,0.15)',  'border' => 'rgba(63,193,137,0.35)'],
        ['icon' => 'text-purple-400', 'bg' => 'rgba(168,85,247,0.15)',  'border' => 'rgba(168,85,247,0.35)'],
        ['icon' => 'text-pink-400',   'bg' => 'rgba(244,114,182,0.15)', 'border' => 'rgba(244,114,182,0.35)'],
        ['icon' => 'text-orange-400', 'bg' => 'rgba(251,146,60,0.15)',  'border' => 'rgba(251,146,60,0.35)'],
        ['icon' => 'text-cyan-400',   'bg' => 'rgba(34,211,238,0.15)',  'border' => 'rgba(34,211,238,0.35)']
    ];
    $name  = $branchName ?: '-';
    $idx   = $branchId ? ((int) $branchId % count($palette)) : 0;
    $p     = $palette[$idx];
    $wh    = $whName
        ? "<div class='text-[10px] text-gray-400 truncate'>{$whName}</div>"
        : "";
    $arrow = $withArrow
        ? "<i data-lucide='arrow-right' class='w-4 h-4 text-gray-500 flex-shrink-0 ml-auto'></i>"
        : "";
    return "<div class='flex items-center gap-2 w-full text-left'>"
         . "<div class='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0' style='background:{$p['bg']};border:1px solid {$p['border']};'>"
         . "<i data-lucide='store' class='w-4 h-4 {$p['icon']}'></i></div>"
         . "<div class='min-w-0'><div class='font-semibold text-white truncate leading-tight'>{$name}</div>{$wh}</div>"
         . "{$arrow}</div>";
}

function pillBadge($label, $colorHex) {
    $label = $label ?: '-';
    $color = $colorHex ?: '#9CA3AF';
    $hex   = ltrim($color, '#');
    $r = hexdec(substr($hex, 0, 2));
    $g = hexdec(substr($hex, 2, 2));
    $b = hexdec(substr($hex, 4, 2));
    $bg = "rgba($r,$g,$b,0.18)";
    return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$bg};color:{$color};'>{$label}</span>";
}

$obj = new ctrl();
$fn  = $_POST['opc'];
if (!method_exists($obj, $fn)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$fn}' no implementado"]);
    exit(0);
}
echo json_encode($obj->$fn());
