<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos-movimientos.php';

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
            'status'          => 200,
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $this->subsidiariesId,
            'user_id'         => $this->userId,
            'sucursales'      => $this->lsSucursales([$this->companiesId])
        ];
    }

    function lsMovimientos() {
        $rows = $this->listMovimientos([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'],
            'movement_type'   => $_POST['movement_type'],
            'fi'              => $_POST['fi'],
            'ff'              => $_POST['ff'],
            'q'               => $_POST['q']
        ]);

        $row = [];
        foreach ($rows as $r) {
            $qty       = (float) $r['quantity'];
            $isOut     = $qty < 0;
            $qtyHtml   = $isOut
                ? '<span class="text-red-400">' . number_format($qty, 2) . '</span>'
                : '<span class="text-green-400">+' . number_format($qty, 2) . '</span>';

            $row[] = [
                'id'         => $r['movement_uid'],
                'Tipo'       => movementBadge($r['movement_type']),
                'Folio'      => $r['folio'],
                'Producto'   => ($r['product_name'] ?: 'Producto #' . $r['product_id']) . ($r['sku'] ? '<br><span class="text-[10px] text-gray-400">' . $r['sku'] . '</span>' : ''),
                'Cantidad'   => $qtyHtml,
                'Stock'      => number_format((float) $r['stock_prev'], 2) . ' → ' . number_format((float) $r['stock_post'], 2),
                'Costo'      => evaluar((float) $r['cost_total']),
                'Almacen'    => $r['warehouse_name'] ?: '-',
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Fecha'      => $r['occurred_at'],
                'Usuario'    => $r['user_name'] ?: '-'
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showMovimientos() {
        $kpis = $this->getMovimientoKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'],
            'fi'              => $_POST['fi'],
            'ff'              => $_POST['ff']
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }
}

// Complements

function movementBadge($type) {
    $map = [
        'ENTRADA'       => ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189'],
        'MERMA'         => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424'],
        'TRANSFERENCIA' => ['bg' => 'rgba(96,165,250,0.18)', 'fg' => '#60A5FA'],
        'AJUSTE'        => ['bg' => 'rgba(167,139,250,0.18)','fg' => '#A78BFA']
    ];
    $c = $map[$type] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#9CA3AF'];
    return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$type}</span>";
}

$obj = new ctrl();
$fn  = $_POST['opc'];
if (!method_exists($obj, $fn)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$fn}' no implementado"]);
    exit(0);
}
echo json_encode($obj->$fn());
