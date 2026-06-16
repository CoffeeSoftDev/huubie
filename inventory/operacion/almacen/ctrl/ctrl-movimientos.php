<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-movimientos.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['companies_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']    ?? 0);
        $this->userId      = (int) ($_SESSION['user_id']    ?? $_POST['user_id']      ?? 0);
    }

    function init() {
        return [
            'status'       => 200,
            'companies_id' => $this->companiesId,
            'branch_id'    => $this->branchId,
            'user_id'      => $this->userId,
            'sucursales'   => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)])
        ];
    }

    function lsMovimientos() {
        $rows = $this->listMovimientos([
            'companies_id'  => $this->companiesId,
            'branch_id'     => $_POST['branch_id']     ?? '',
            'movement_type' => $_POST['movement_type'] ?? '',
            'item_id'       => $_POST['item_id']       ?? '',
            'fi'            => $_POST['fi']             ?? '',
            'ff'            => $_POST['ff']             ?? '',
            'q'             => $_POST['q']              ?? ''
        ]);

        // Agrupar los movimientos por producto. Las filas vienen ordenadas por
        // occurred_at DESC, asi que el primer movimiento de cada producto es el
        // mas reciente (se usa para la columna "Ultimo movimiento").
        $prod  = [];
        $order = [];
        foreach ($rows as $r) {
            $iid = (int) $r['item_id'];
            $qty = (float) $r['quantity'];

            if (!isset($prod[$iid])) {
                $order[]      = $iid;
                $prod[$iid] = [
                    'itemId'   => $iid,
                    'producto' => $r['item_name'] ?: ('Item #' . $iid),
                    'sku'      => $r['sku'] ?: '',
                    'count'    => 0,
                    'entradas' => 0,
                    'salidas'  => 0,
                    'neto'     => 0.0,
                    'costoTot' => 0.0,
                    'lastType' => $r['movement_type'],
                    'lastDate' => $r['occurred_at'] ?: '',
                    'movs'     => []
                ];
            }

            $prod[$iid]['count']++;
            if ($qty >= 0) $prod[$iid]['entradas']++; else $prod[$iid]['salidas']++;
            $prod[$iid]['neto']     += $qty;
            $prod[$iid]['costoTot'] += (float) $r['cost_total'];

            $prod[$iid]['movs'][] = [
                'uid'       => $r['movement_uid'],
                'tipo'      => $r['movement_type'],
                'folio'     => $r['folio'],
                'nota'      => $r['note'],
                'cant'      => $qty,
                'stockPrev' => (float) $r['stock_prev'],
                'stockPost' => (float) $r['stock_post'],
                'costoUnit' => (float) $r['cost_unit'],
                'costoTot'  => (float) $r['cost_total'],
                'almacen'   => $r['warehouse_name'] ?: '-',
                'sucursal'  => $r['branch_name'] ?: '-',
                'usuario'   => $r['user_name'] ?: '-',
                'estado'    => $r['status'] ?: '',
                'fecha'     => $r['occurred_at'] ?: ''
            ];
        }

        $row  = [];
        $data = [];
        foreach ($order as $iid) {
            $p = $prod[$iid];

            $nombre = $p['producto']
                . ($p['sku'] ? '<br><span class="text-[10px] text-gray-400">' . $p['sku'] . '</span>' : '');

            $neto     = $p['neto'];
            $netoHtml = $neto < 0
                ? '<span class="font-bold text-red-600">'   . number_format($neto, 2) . '</span>'
                : '<span class="font-bold text-green-600">+' . number_format($neto, 2) . '</span>';

            $ultMov = movementBadge($p['lastType'])
                . ' <span class="text-[10px] text-gray-400">' . movementDate($p['lastDate']) . '</span>';

            $acciones = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-[#C05A40] transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'onclick' => "app.selectProducto({$iid})"
                ]
            ];

            $row[] = [
                'id'        => $iid,
                'Producto'  => $nombre,
                'Movs'      => '<span class="font-semibold">' . $p['count'] . '</span>',
                'Entradas'  => '<span class="text-green-600 font-semibold">' . $p['entradas'] . '</span>',
                'Salidas'   => '<span class="text-red-600 font-semibold">' . $p['salidas'] . '</span>',
                'Neto'      => $netoHtml,
                'Ult. Mov'  => $ultMov,
                'a'         => $acciones
            ];

            $data[] = [
                'itemId'   => $iid,
                'producto' => $p['producto'],
                'sku'      => $p['sku'],
                'count'    => $p['count'],
                'entradas' => $p['entradas'],
                'salidas'  => $p['salidas'],
                'neto'     => $neto,
                'costoTot' => $p['costoTot'],
                'movs'     => $p['movs']
            ];
        }

        return ['status' => 200, 'row' => $row, 'data' => $data];
    }

    function showMovimientos() {
        $kpis = $this->getMovimientoKpis([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id'] ?? '',
            'item_id'      => $_POST['item_id']   ?? '',
            'fi'           => $_POST['fi']         ?? '',
            'ff'           => $_POST['ff']         ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }
}

// Complements

function movementBadge($type) {
    $map = [
        'ENTRADA'       => ['bg' => 'rgba(63,193,137,0.15)', 'fg' => '#15803D'],
        'MERMA'         => ['bg' => 'rgba(224,36,36,0.15)',  'fg' => '#B91C1C'],
        'TRANSFERENCIA' => ['bg' => 'rgba(192,90,64,0.15)',  'fg' => '#C05A40'],
        'AJUSTE'        => ['bg' => 'rgba(167,139,250,0.15)','fg' => '#7C3AED']
    ];
    $c = $map[$type] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#6B7280'];
    return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$type}</span>";
}

function movementDate($val) {
    if (empty($val)) return '-';
    $ts = strtotime($val);
    if ($ts === false) return $val;
    $mon  = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    $base = date('d', $ts) . ' ' . $mon[(int) date('n', $ts)] . ' ' . date('Y', $ts);
    if (date('H:i', $ts) === '00:00') return $base;
    return $base . ' ' . date('g:i', $ts) . ' ' . date('a', $ts);
}

$obj = new ctrl();
$fn  = $_POST['opc'];
if (!method_exists($obj, $fn)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$fn}' no implementado"]);
    exit(0);
}
echo json_encode($obj->$fn());
