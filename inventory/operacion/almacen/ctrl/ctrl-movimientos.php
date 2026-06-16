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

        $row  = [];
        $data = [];
        foreach ($rows as $r) {
            $qty     = (float) $r['quantity'];
            $isOut   = $qty < 0;
            $qtyHtml = $isOut
                ? '<span class="font-bold text-red-600">'   . number_format($qty, 2) . '</span>'
                : '<span class="font-bold text-green-600">+' . number_format($qty, 2) . '</span>';

            $producto = ($r['item_name'] ?: 'Item #' . $r['item_id'])
                . ($r['sku'] ? '<br><span class="text-[10px] text-gray-400">' . $r['sku'] . '</span>' : '');

            $acciones = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-[#C05A40] transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'onclick' => "app.selectMovimiento('{$r['movement_uid']}')"
                ]
            ];

            $stockHtml = number_format((float) $r['stock_prev'], 2)
                . ' <span class="text-gray-400">&rarr;</span> '
                . '<span class="font-semibold">' . number_format((float) $r['stock_post'], 2) . '</span>';

            $ubicacion = ($r['warehouse_name'] ?: '-')
                . ($r['branch_name'] ? '<br><span class="text-[10px] text-gray-400">' . $r['branch_name'] . '</span>' : '');

            $row[] = [
                'id'       => $r['movement_uid'],
                'Fecha'    => movementDate($r['occurred_at']),
                'Folio'    => $r['folio'] ?: '-',
                'Tipo'     => movementBadge($r['movement_type']),
                'Producto' => $producto,
                'Cantidad' => $qtyHtml,
                'Stock'    => $stockHtml,
                'Costo'    => '$' . number_format((float) $r['cost_total'], 2),
                'Almacen'  => $ubicacion,
                'Usuario'  => $r['user_name'] ?: '-',
                'a'        => $acciones
            ];

            // Crudo para el panel de detalle (indexado por uid en el front).
            $data[] = [
                'uid'       => $r['movement_uid'],
                'tipo'      => $r['movement_type'],
                'folio'     => $r['folio'],
                'nota'      => $r['note'],
                'itemId'    => (int) $r['item_id'],
                'producto'  => $r['item_name'] ?: ('Item #' . $r['item_id']),
                'sku'       => $r['sku'] ?: '',
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
