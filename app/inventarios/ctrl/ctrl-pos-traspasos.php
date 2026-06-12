<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos-traspasos.php';

class ctrl extends mdl {

    // Niveles de rol que pueden cambiar de sucursal desde el navbar (mismo criterio que
    // BRANCH_ALLOW_LEVEL en app/src/js/navbar.js). Para estos el filtro Origen sigue la
    // sucursal activa de la sidebar; el resto queda fijo a su sucursal de sesion.
    const ADMIN_LEVELS = [1, 5];

    public $companiesId;
    public $subsidiariesId;
    public $userId;
    public $level;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['COM'] ?? $_SESSION['COMPANY_ID'] ?? $_POST['companies_id']    ?? 4);
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_SESSION['ID']         ?? $_POST['user_id']         ?? 1);
        $this->level          = (int) ($_SESSION['ROLID'] ?? 0);
    }

    function init() {
        return [
            'status'           => 200,
            'companies_id'     => $this->companiesId,
            'subsidiaries_id'  => $this->subsidiariesId,
            'user_id'          => $this->userId,
            'level'            => $this->level,
            'is_admin'         => in_array($this->level, self::ADMIN_LEVELS, true),
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
            'status_id'                   => $_POST['status_id'] ?? '',
            // Alcance por sucursal activa: la lista incluye traspasos donde es origen O destino.
            'scope_subsidiaries_id'       => $_POST['scope_subsidiaries_id'] ?? '',
            'destination_subsidiaries_id' => $_POST['destination_subsidiaries_id'] ?? '',
            'fi'                          => $_POST['fi'] ?? '',
            'ff'                          => $_POST['ff'] ?? '',
            'q'                           => $_POST['q'] ?? ''
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
        $kpis = $this->getTraspasoKpis([
            'companies_id'          => $this->companiesId,
            // KPIs alineados con la lista: cuentan los traspasos de la sucursal activa
            // (como origen O destino), no los de toda la compania.
            'scope_subsidiaries_id' => $_POST['scope_subsidiaries_id'] ?? ''
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

        // Atomico: encabezado + todos los renglones + historial van juntos. Si algo falla a
        // media insercion, el rollback los deshace y no queda un traspaso "mentiroso" (totales
        // del encabezado sin sus renglones). El folio tampoco se desperdicia (el INSERT se revierte).
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
                    (int) $payload['origin_subsidiaries_id'],
                    (int) $payload['destination_subsidiaries_id'],
                    $this->userId,
                    $this->companiesId
                ]);

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
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo registrar el traspaso'];
        }
    }

    function authorizeTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['AUTHORIZED']);

        // 1.3 Guarda de transicion: solo se autoriza una solicitud pendiente.
        $header = $this->getTraspasoById([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];
        if (($header['status_code'] ?? '') !== 'REQUESTED') {
            return ['status' => 409, 'message' => 'Solo se puede autorizar un traspaso solicitado (estado actual: ' . ($header['status_name'] ?? '') . ').'];
        }
        try {
            return $this->transaction(function () use ($id, $st) {
                $this->updateTraspasoStatus([(int) $st['id'], $id]);
                $this->updateTraspasoAuthorized([$this->userId, $id]);
                $this->createTraspasoHistory(['Traspaso autorizado', (int) $st['id'], $this->userId, $id]);
                return ['status' => 200, 'message' => 'Traspaso autorizado'];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo autorizar el traspaso'];
        }
    }

    // Reservado (sin UI): flujo legado "En Transito" que solo descuenta el origen. El
    // flujo vigente acepta y recibe en un paso via confirmTraspaso.
    function sendTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['IN_TRANSIT']);

        $detail = $this->listTraspasoDetail([$id]);
        $header = $this->getTraspasoById([$id]);

        // 1.3 Guarda de transicion: solo se envia desde Solicitado/Autorizado (no terminal).
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];
        if (!in_array($header['status_code'] ?? '', ['REQUESTED', 'AUTHORIZED'], true)) {
            return ['status' => 409, 'message' => 'El traspaso no puede enviarse (estado actual: ' . ($header['status_name'] ?? '') . ').'];
        }

        // Atomico: cambio de estado + fecha de envio + descuento de stock del origen de todos
        // los renglones + historial, todo junto o nada.
        try {
            return $this->transaction(function () use ($id, $st, $detail, $header) {
                $this->updateTraspasoStatus([(int) $st['id'], $id]);
                $this->updateTraspasoSent([$id]);

                foreach ($detail as $d) {
                    $stockRow = $this->getStockRow([(int) $d['product_id'], (int) $header['origin_warehouse_id']]);
                    if ($stockRow) {
                        $post = max(0, (float) $stockRow['quantity'] - (float) $d['quantity']);
                        $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                    }
                }

                $this->createTraspasoHistory(['Traspaso enviado', (int) $st['id'], $this->userId, $id]);
                return ['status' => 200, 'message' => 'Traspaso enviado'];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo enviar el traspaso'];
        }
    }

    function confirmTraspaso() {
        $id         = (int) $_POST['id'];
        $receivedBy = trim($_POST['received_by'] ?? '');
        $st = $this->getTransferStatusByCode(['RECEIVED']);

        $header = $this->getTraspasoById([$id]);
        $detail = $this->listTraspasoDetail([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];

        // 1.3 Guarda de transicion: solo se confirma desde un estado NO terminal (REQUESTED
        // vigente, o AUTHORIZED/IN_TRANSIT legado). Si ya esta Recibido/Rechazado se rechaza,
        // para no volver a mover stock (doble descuento/alta).
        $estadoActual = $header['status_code'] ?? '';
        if (!in_array($estadoActual, ['REQUESTED', 'AUTHORIZED', 'IN_TRANSIT'], true)) {
            return ['status' => 409, 'message' => 'El traspaso ya fue procesado (' . ($header['status_name'] ?? $estadoActual) . ') y no puede confirmarse de nuevo.'];
        }

        $originWh = (int) $header['origin_warehouse_id'];
        $destWh   = (int) $header['destination_warehouse_id'];

        // Flujo simplificado: al confirmar la recepcion se mueve TODO el stock de una vez
        // (salida del origen + entrada al destino), omitiendo el paso intermedio "En
        // Transito". Si el traspaso ya venia de ese estado (flujo anterior), el origen ya
        // se desconto en sendTraspaso; en ese caso aqui NO se vuelve a descontar.
        $alreadySent = $estadoActual === 'IN_TRANSIT';

        // 1.2 Las existencias deben existir: antes de mover nada, valida que el almacen origen
        // tenga stock suficiente de cada producto. Si el traspaso ya venia "En Transito", el
        // origen ya salio en sendTraspaso y no se re-valida. Politica: BLOQUEAR (no se crea
        // stock de la nada). Si falta algo, no se mueve nada y se devuelve el detalle.
        if (!$alreadySent) {
            $faltantes = [];
            foreach ($detail as $d) {
                $stockRow   = $this->getStockRow([(int) $d['product_id'], $originWh]);
                $disponible = $stockRow ? (float) $stockRow['quantity'] : 0;
                $requerido  = (float) $d['quantity'];
                if ($disponible < $requerido) {
                    $faltantes[] = [
                        'producto'   => $d['product_name'] ?? ('#' . (int) $d['product_id']),
                        'requerido'  => $requerido,
                        'disponible' => $disponible
                    ];
                }
            }
            if (!empty($faltantes)) {
                $partes = array_map(function ($f) {
                    return "{$f['producto']} (pide {$f['requerido']}, hay {$f['disponible']})";
                }, $faltantes);
                return [
                    'status'    => 409,
                    'message'   => 'Stock insuficiente en el almacen origen para: ' . implode('; ', $partes),
                    'faltantes' => $faltantes
                ];
            }
        }

        // Atomico: el movimiento de stock (salida origen + entrada destino) de TODOS los
        // renglones, el cambio de estado y el historial van en una sola transaccion. Si algo
        // falla a medias, el rollback deja el inventario intacto y el traspaso como estaba
        // (Solicitado), de modo que sea seguro reintentar y no se descuadre el stock.
        try {
            return $this->transaction(function () use ($id, $st, $header, $detail, $originWh, $destWh, $alreadySent, $receivedBy) {
                foreach ($detail as $d) {
                    $productId = (int) $d['product_id'];
                    $qty       = (float) $d['quantity'];

                    // -- Salida del almacen origen (se descuenta aqui salvo que ya saliera antes).
                    $originStock = $this->getStockRow([$productId, $originWh]);
                    $originPrev  = $originStock ? (float) $originStock['quantity'] : 0;
                    // Re-chequeo dentro de la transaccion: si el stock cambio entre la validacion
                    // previa y este punto y ya no alcanza, aborta y revierte TODO (no se fabrica
                    // inventario con max(0,...)).
                    if (!$alreadySent && $originPrev < $qty) {
                        throw new \RuntimeException("Stock insuficiente en origen (producto #{$productId})");
                    }
                    $originPost  = $alreadySent ? $originPrev : ($originPrev - $qty);

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
                // El destino que acepta el traspaso tambien lo autoriza: registra al usuario de
                // sesion como autorizador si aun no estaba autorizado (no pisa flujos legados).
                if (empty($header['authorized_user_id'])) {
                    $this->updateTraspasoAuthorized([$this->userId, $id]);
                }
                // received_user_id = usuario de sesion; received_by_name = texto de quien recibe.
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

        // 1.3 Guarda de transicion: no se puede rechazar un traspaso ya terminal. Si ya esta
        // Recibido, rechazarlo cambiaria el estado SIN revertir el stock ya movido = descuadre.
        $header = $this->getTraspasoById([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];
        if (in_array($header['status_code'] ?? '', ['RECEIVED', 'REJECTED'], true)) {
            return ['status' => 409, 'message' => 'El traspaso ya esta en estado terminal (' . ($header['status_name'] ?? '') . ') y no puede rechazarse.'];
        }

        // Atomico: el cambio de estado y su huella de auditoria (quien/por que) van juntos,
        // para no quedar "Rechazado" sin rastro en el historial.
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
