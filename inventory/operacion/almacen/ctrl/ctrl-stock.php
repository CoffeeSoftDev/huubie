<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-stock.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['company_id']    ?? $_POST['companies_id']    ?? 0);
        $this->subsidiariesId = (int) ($_SESSION['branch_id']     ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['user_id']       ?? $_POST['user_id']         ?? 0);
    }

    function init() {
        return [
            'status'          => 200,
            'subsidiaries_id' => $this->subsidiariesId,
            'sucursales'      => $this->lsSucursales([$this->companiesId]),
            'categorias'      => $this->lsCategories([$this->companiesId])
        ];
    }

    function lsStock() {
        $rows = $this->qStock([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'category_id'     => $_POST['category_id']     ?? '',
            'nivel'           => $_POST['nivel']           ?? '',
            'movimiento'      => $_POST['movimiento']      ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $qty = (float) $r['quantity_total'];
            $min = (float) $r['stock_min'];
            $max = (float) $r['stock_max'];
            $row[] = [
                'id'        => $r['product_id'],
                'Producto'  => [
                    'class' => 'justify-start px-2 py-2',
                    'html'  => $this->_productCell($r['image'] ?? '', $r['product_name'], $r['product_id'], $r['sku'] ?: '')
                ],
                'Categoria' => $r['category_name'] ?: '-',
                'Stock'     => $qty > 0 ? $this->_qty($qty) : '-',
                'Min'       => $min > 0 ? $this->_qty($min) : '-',
                'Max'       => $max > 0 ? $this->_qty($max) : '-',
                'Unidad'    => $r['unit_code'] ?: '-',
                'Estado'    => $this->_levelBadge($qty, $min),
                'a'         => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "app.selectProduct({$r['product_id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showStock() {
        $kpis = $this->getStockKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getProducto() {
        $product_id = (int) $_POST['id'];
        $product    = $this->getProduct([$product_id]);
        if (empty($product)) {
            return ['status' => 404, 'message' => 'Producto no encontrado'];
        }

        $stockRows = $this->getStockByProduct([$product_id]);
        $movsRows  = $this->getMovimientosByProduct([$product_id, $this->companiesId]);

        $total = 0;
        foreach ($stockRows as $s) {
            $total += (float) $s['quantity'];
        }
        $stockSuc = ['' => $total];
        foreach ($stockRows as $s) {
            $sid = (string) $s['subsidiaries_id'];
            $stockSuc[$sid] = ($stockSuc[$sid] ?? 0) + (float) $s['quantity'];
        }

        $min = (float) ($product['stock_min'] ?? 0);
        if ($total <= 0) {
            $estado = 'agotado';
        } elseif ($total <= $min) {
            $estado = 'bajo';
        } else {
            $estado = 'ok';
        }

        $almacenes = [];
        foreach ($stockRows as $s) {
            $almacenes[] = [
                'name' => $s['warehouse_name'],
                'type' => 'info'
            ];
        }

        $typeMap = [
            'ENTRADA'       => 'in',
            'MERMA'         => 'out',
            'TRANSFERENCIA' => 'tr',
            'AJUSTE'        => 'adjust'
        ];
        $labelMap = [
            'ENTRADA'       => 'Entrada',
            'MERMA'         => 'Merma',
            'TRANSFERENCIA' => 'Transferencia',
            'AJUSTE'        => 'Ajuste'
        ];
        $movs = [];
        foreach ($movsRows as $m) {
            $type  = $typeMap[$m['movement_type']] ?? 'adjust';
            $label = ($labelMap[$m['movement_type']] ?? $m['movement_type']) . ' · ' . ($m['folio'] ?? '-');
            $qty   = (float) $m['quantity'];
            $movs[] = [
                'type'  => $type,
                'label' => $label,
                'qty'   => $qty >= 0 ? '+' . $qty : (string) $qty,
                'when'  => ($m['occurred_at'] ?? '') . ' · ' . ($m['warehouse_name'] ?? '-')
            ];
        }

        $dias = isset($product['shelf_life_days']) && $product['shelf_life_days'] !== null
            ? (int) $product['shelf_life_days']
            : null;
        if ($dias === null) {
            $vidaLabel = 'na';
        } elseif ($dias <= 2) {
            $vidaLabel = 'critico';
        } elseif ($dias <= 5) {
            $vidaLabel = 'proximo';
        } else {
            $vidaLabel = 'ok';
        }

        $producto = [
            'name'      => $product['name'],
            'sku'       => $product['sku'] ?: '-',
            'categoria' => $product['category_name'] ?: 'Sin categoria',
            'estado'    => $estado,
            'min'       => (float) ($product['stock_min'] ?? 0),
            'max'       => (float) ($product['stock_max'] ?? 0),
            'stockSuc'  => $stockSuc,
            'almacenes' => $almacenes,
            'movs'      => $movs,
            'vida'      => ['dias' => $dias, 'label' => $vidaLabel],
            'iconBg'    => 'bg-[#1F2A37]',
            'iconText'  => 'text-gray-500'
        ];

        return ['status' => 200, 'producto' => $producto];
    }

    private function _qty($n) {
        $n = (float) $n;
        return (fmod($n, 1) == 0) ? (string) (int) $n : (string) round($n, 2);
    }

    private function _productCell($image, $name, $id = 0, $sku = '') {
        $path  = ltrim((string) $image, '/');
        $local = !empty($path) ? '/' . $path : '';
        $prod  = !empty($path) ? 'https://huubie.com.mx/' . $path : '';
        $label = htmlspecialchars(trim((string) $name), ENT_QUOTES);
        $sku   = trim((string) $sku);
        $id    = (int) $id;

        $imgTag = !empty($local)
            ? '<img src="' . $local . '" data-prod="' . $prod . '"'
                . ' onerror="if(this.dataset.prod){this.src=this.dataset.prod;this.dataset.prod=\'\';}else{this.remove();}"'
                . ' alt="Producto" class="absolute inset-0 w-full h-full object-cover" />'
            : '';

        $click = $id ? ' onclick="app.selectProduct(' . $id . ')" title="Clic para ver detalle"' : '';
        $hover = $id ? ' cursor-pointer transition duration-150 hover:ring-2 hover:ring-blue-400/60 hover:scale-105' : '';

        $skuTag = $sku !== ''
            ? '<span class="font-mono text-[10px] text-gray-400">' . htmlspecialchars($sku, ENT_QUOTES) . '</span>'
            : '';

        return '
            <div class="flex items-center gap-3">
                <div class="relative flex-shrink-0 w-10 h-10 rounded-md bg-[#1F2A37] flex items-center justify-center overflow-hidden' . $hover . '"' . $click . '>
                    <i class="icon-cube text-gray-500 text-lg"></i>
                    ' . $imgTag . '
                </div>
                <div class="flex flex-col leading-tight">
                    <span class="text-sm text-white">' . $label . '</span>
                    ' . $skuTag . '
                </div>
            </div>';
    }

    private function _levelBadge($qty, $min) {
        if ($qty <= 0) {
            $c = ['bg' => 'rgba(224,36,36,0.18)', 'fg' => '#E02424', 'lbl' => 'AGOTADO'];
        } elseif ($qty <= $min) {
            $c = ['bg' => 'rgba(251,191,36,0.18)', 'fg' => '#FBBF24', 'lbl' => 'BAJO'];
        } else {
            $c = ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189', 'lbl' => 'OK'];
        }
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$c['lbl']}</span>";
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
