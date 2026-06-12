<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos-traspasos.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['COM'] ?? $_SESSION['COMPANY_ID'] ?? $_POST['companies_id']    ?? 4);
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_SESSION['ID']         ?? $_POST['user_id']         ?? 1);
    }

    function init() {
        return [
            'status'           => 200,
            'companies_id'     => $this->companiesId,
            'subsidiaries_id'  => $this->subsidiariesId,
            'user_id'          => $this->userId,
            'sucursales'       => $this->lsSucursales([$this->companiesId]),
            'almacenes'        => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'estados_traspaso' => $this->lsTransferStatuses()
        ];
    }

    function getCatalogosTraspaso() {
        $cid = $this->companiesId;

        $productos = $this->listProductsForTransfer([$cid]);
        $stockRows = $this->listStockBySubsidiary([$cid]);

        $stockMap = [];
        foreach ($stockRows as $s) {
            $pid = (int) $s['product_id'];
            $sid = (string) $s['subsidiaries_id'];
            if (!isset($stockMap[$pid])) $stockMap[$pid] = [];
            $stockMap[$pid][$sid] = (float) $s['qty'];
        }

        foreach ($productos as &$p) {
            $pid = (int) $p['id'];
            $p['id']           = (string) $p['id'];
            $p['categoria']    = $p['categoria'] ?: '-';
            $p['sku']          = $p['sku'] ?: '';
            $p['icon']         = 'package';
            $p['bg']           = 'bg-gray-700/40';
            $p['color']        = 'text-gray-300';
            $p['stockPorSuc']  = isset($stockMap[$pid]) ? (object) $stockMap[$pid] : (object) [];
        }
        unset($p);

        return [
            'status'       => 200,
            'sucursales'   => $this->lsSucursales([$cid]),
            'almacenes'    => $this->lsWarehouses(['companies_id' => $cid]),
            'categorias'   => $this->lsCategories(),
            'productos'    => $productos,
            'transformMap' => (object) []
        ];
    }

    function lsTraspasos() {
        $rows = $this->listTraspasos([
            'companies_id'                => $this->companiesId,
            'status_id'                   => $_POST['status_id'],
            'origin_subsidiaries_id'      => $_POST['origin_subsidiaries_id'],
            'destination_subsidiaries_id' => $_POST['destination_subsidiaries_id'],
            'fi'                          => $_POST['fi'],
            'ff'                          => $_POST['ff'],
            'q'                           => $_POST['q']
        ]);

        $row = [];

        foreach ($rows as $r) {
            // La columna de operaciones solo ofrece Previsualizar: abre el panel de
            // detalle a la derecha, donde viven las acciones contextuales del traspaso
            // (Enviar / Confirmar Recepcion / Rechazar segun el estado).
            $acciones = [
                [
                    'class'   => 'btn btn-sm btn-secondary me-1',
                    'html'    => '<i class="icon-eye"></i>',
                    'onclick' => "app.selectTraspaso('{$r['folio']}', {$r['id']})"
                ]
            ];

            $origen = sucChipCell(
                $r['origin_subsidiaries_id'],
                $r['origin_subsidiary_name'],
                $r['origin_warehouse_name'],
                true
            );

            $destino = sucChipCell(
                $r['destination_subsidiaries_id'],
                $r['destination_subsidiary_name'],
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
        $kpis = $this->getTraspasoKpis(['companies_id' => $this->companiesId]);
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

        $folio = $this->getNextFolio('TRA-', $this->companiesId);

        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($productos as $p) {
            $totalUnits += (float) $p['quantity'];
            $totalCost  += (float) $p['quantity'] * (float) $p['cost'];
        }

        $ok = $this->createTraspaso([
            $folio,
            $payload['note'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalCost,
            (int) $statusReq['id'],
            (int) $payload['origin_warehouse_id'],
            (int) $payload['destination_warehouse_id'],
            (int) $payload['origin_subsidiaries_id'],
            (int) $payload['destination_subsidiaries_id'],
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar el traspaso'];

        $traspasoId = $this->getTraspasoIdByFolio([$folio, $this->companiesId]);

        foreach ($productos as $p) {
            $productId  = (int) $p['product_id'];
            $originWh   = (int) $payload['origin_warehouse_id'];
            $qty        = (float) $p['quantity'];
            $cost       = (float) $p['cost'];

            $originStock = $this->getStockRow([$productId, $originWh]);
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
                $productId,
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
    }

    function authorizeTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['AUTHORIZED']);
        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->updateTraspasoAuthorized([$this->userId, $id]);
        $this->createTraspasoHistory(['Traspaso autorizado', (int) $st['id'], $this->userId, $id]);
        return ['status' => 200, 'message' => 'Traspaso autorizado'];
    }

    function sendTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['IN_TRANSIT']);
        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->updateTraspasoSent([$id]);

        $detail = $this->listTraspasoDetail([$id]);
        $header = $this->getTraspasoById([$id]);
        foreach ($detail as $d) {
            $stockRow = $this->getStockRow([(int) $d['product_id'], (int) $header['origin_warehouse_id']]);
            if ($stockRow) {
                $post = max(0, (float) $stockRow['quantity'] - (float) $d['quantity']);
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            }
        }

        $this->createTraspasoHistory(['Traspaso enviado', (int) $st['id'], $this->userId, $id]);
        return ['status' => 200, 'message' => 'Traspaso enviado'];
    }

    function confirmTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['RECEIVED']);

        $header = $this->getTraspasoById([$id]);
        $detail = $this->listTraspasoDetail([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];

        $originWh = (int) $header['origin_warehouse_id'];
        $destWh   = (int) $header['destination_warehouse_id'];

        // Flujo simplificado: al confirmar la recepcion se mueve TODO el stock de una vez
        // (salida del origen + entrada al destino), omitiendo el paso intermedio "En
        // Transito". Si el traspaso ya venia de ese estado (flujo anterior), el origen ya
        // se desconto en sendTraspaso; en ese caso aqui NO se vuelve a descontar.
        $alreadySent = ($header['status_code'] ?? '') === 'IN_TRANSIT';

        foreach ($detail as $d) {
            $productId = (int) $d['product_id'];
            $qty       = (float) $d['quantity'];

            // -- Salida del almacen origen (se descuenta aqui salvo que ya saliera antes).
            $originStock = $this->getStockRow([$productId, $originWh]);
            $originPrev  = $originStock ? (float) $originStock['quantity'] : 0;
            $originPost  = $alreadySent ? $originPrev : max(0, $originPrev - $qty);

            // -- Entrada al almacen destino.
            $destStock = $this->getStockRow([$productId, $destWh]);
            $destPrev  = $destStock ? (float) $destStock['quantity'] : 0;
            $destPost  = $destPrev + $qty;

            // Traza el movimiento real (recalculado al confirmar). Si el origen ya se
            // desconto antes, conserva su prev/post original sin pisarlo.
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
                $this->createStockRow([$destPost, $destWh, $productId, $this->companiesId]);
            }
        }

        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->updateTraspasoReceived([$this->userId, $id]);
        $this->createTraspasoHistory(['Traspaso recibido', (int) $st['id'], $this->userId, $id]);

        return ['status' => 200, 'message' => 'Traspaso recibido'];
    }

    function rejectTraspaso() {
        $id   = (int) $_POST['id'];
        $note = empty($_POST['note']) ? 'Traspaso rechazado' : $_POST['note'];
        $st   = $this->getTransferStatusByCode(['REJECTED']);

        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->createTraspasoHistory([$note, (int) $st['id'], $this->userId, $id]);

        return ['status' => 200, 'message' => 'Traspaso rechazado'];
    }
}

// Complements

// Fecha de solicitud compacta: dd/mes/yyyy hh:mm am. Abreviaturas de mes en
// espanol locale-independientes (strftime/%b depende de setlocale es_ES, poco
// fiable en Windows/WAMP).
function formatRequestDate($date) {
    $mesesAbr = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    $ts = strtotime($date);
    if (!$ts) return '-';
    return date('d', $ts) . '/' . $mesesAbr[(int) date('n', $ts)] . '/' . date('Y', $ts) . ' ' . date('h:i', $ts) . ' ' . date('a', $ts);
}

// Celda Origen/Destino estilo chip: icono "store" coloreado por sucursal
// (color estable segun el id), el nombre de la sucursal y, debajo, el almacen.
// En el origen agrega una flecha a la derecha que apunta al destino.
function sucChipCell($subId, $subName, $whName, $withArrow) {
    $palette = [
        ['icon' => 'text-blue-400',   'bg' => 'rgba(59,130,246,0.15)',  'border' => 'rgba(59,130,246,0.35)'],
        ['icon' => 'text-green-400',  'bg' => 'rgba(63,193,137,0.15)',  'border' => 'rgba(63,193,137,0.35)'],
        ['icon' => 'text-purple-400', 'bg' => 'rgba(168,85,247,0.15)',  'border' => 'rgba(168,85,247,0.35)'],
        ['icon' => 'text-pink-400',   'bg' => 'rgba(244,114,182,0.15)', 'border' => 'rgba(244,114,182,0.35)'],
        ['icon' => 'text-orange-400', 'bg' => 'rgba(251,146,60,0.15)',  'border' => 'rgba(251,146,60,0.35)'],
        ['icon' => 'text-cyan-400',   'bg' => 'rgba(34,211,238,0.15)',  'border' => 'rgba(34,211,238,0.35)']
    ];
    $name  = $subName ?: '-';
    $idx   = $subId ? ((int) $subId % count($palette)) : 0;
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
