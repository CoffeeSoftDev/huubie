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
            'sucursales'   => $this->lsSucursales([$this->companiesId])
        ];
    }

    function lsMovimientos() {
        $rows = $this->listMovimientos([
            'companies_id'  => $this->companiesId,
            'branch_id'     => $_POST['branch_id']     ?? '',
            'movement_type' => $_POST['movement_type'] ?? '',
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

            $nombre   = ($r['item_name'] ?: 'Item #' . $r['item_id'])
                . ($r['sku'] ? '<br><span class="text-[10px] text-gray-400">' . $r['sku'] . '</span>' : '');
            $producto = '<span class="cursor-pointer hover:text-[#C05A40]" onclick="app.selectMovimiento(\''
                . $r['movement_uid'] . '\')">' . $nombre . '</span>';

            $stockHtml = number_format((float) $r['stock_prev'], 2)
                . ' <span class="text-gray-400">&rarr;</span> '
                . '<span class="font-semibold">' . number_format((float) $r['stock_post'], 2) . '</span>';

            $row[] = [
                'id'       => $r['movement_uid'],
                'Tipo'     => movementBadge($r['movement_type']),
                'Folio'    => $r['folio'] ?: '-',
                'Producto' => $producto,
                'Cantidad' => $qtyHtml,
                'Stock'    => $stockHtml,
                'Costo'    => '$' . number_format((float) $r['cost_total'], 2),
                'Almacen'  => $r['warehouse_name'] ?: '-',
                'Sucursal' => $r['branch_name'] ?: '-',
                'Fecha'    => $r['occurred_at'] ?: '-',
                'Usuario'  => $r['user_name'] ?: '-'
            ];

            // Crudo para el panel de detalle (indexado por uid en el front).
            $data[] = [
                'uid'       => $r['movement_uid'],
                'tipo'      => $r['movement_type'],
                'folio'     => $r['folio'],
                'nota'      => $r['note'],
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

$obj = new ctrl();
$fn  = $_POST['opc'];
if (!method_exists($obj, $fn)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$fn}' no implementado"]);
    exit(0);
}
echo json_encode($obj->$fn());
