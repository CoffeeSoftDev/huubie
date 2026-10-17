<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-dashboard.php';
require_once '../../../conf/coffeSoft.php';
require_once '../../../conf/_Permissions.php';

class ctrl extends mdl {

    // Tipos de la bitácora (inventory_movement.movement_type): etiqueta, color,
    // fondo e ícono del badge.
    const MOVEMENTS = [
        'ENTRADA'       => ['Entrada',  '#16A34A', '#DCFCE7', 'arrow-down-to-line'],
        'SALIDA'        => ['Salida',   '#DC2626', '#FEE2E2', 'arrow-up-from-line'],
        'AJUSTE'        => ['Ajuste',   '#B45309', '#FEF3C7', 'clipboard-check'],
        'TRANSFERENCIA' => ['Traspaso', '#2563EB', '#DBEAFE', 'arrow-right-left']
    ];

    public $companiesId;
    public $branchId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id'] ?? 0);
    }

    function init() {
        $tipos = [['id' => '', 'valor' => 'Todos']];
        foreach (self::MOVEMENTS as $code => $movement) {
            $tipos[] = ['id' => $code, 'valor' => $movement[0] . 's'];
        }

        return [
            'status'   => 200,
            'sucursal' => $_SESSION['branch'] ?? '',
            'tipos'    => $tipos,
            'usuarios' => array_merge(
                [['id' => '', 'valor' => 'Todos']],
                $this->lsMovementUsers([$this->companiesId, $this->branchId])
            )
        ];
    }

    function showDashboard() {
        $counts = $this->getDashboardCounts([$this->branchId, $this->companiesId]);

        $lowStock = array_map(function ($p) {
            return [
                'nombre' => $p['name'],
                'stock'  => kpiQuantity($p['stock']),
                'minimo' => kpiQuantity($p['stock_min']),
                'unidad' => $p['unidad'] ?: ''
            ];
        }, $this->listLowStock([$this->branchId, $this->companiesId]));

        return [
            'status'   => 200,
            'counts'   => [
                'valor'     => evaluar((float) ($counts['valor_inventario'] ?? 0)),
                'productos' => (int) ($counts['total_productos'] ?? 0),
                'bajo'      => (int) ($counts['total_bajo'] ?? 0),
                'agotado'   => (int) ($counts['total_agotado'] ?? 0)
            ],
            'lowStock' => $lowStock
        ];
    }

    // Desglose de una card del dashboard: los productos que forman su número, con
    // el mismo criterio de getDashboardCounts (bajo = algo, pero no más del
    // mínimo; agotado = nada; valor = existencia por último costo).
    function lsKpiDetail() {
        $ls = $this->listStockDetail([$this->branchId, $this->companiesId]);

        switch ($_POST['kpi'] ?? '') {
            case 'kpiValor':
                $ls = array_values(array_filter($ls, function ($p) { return (float) $p['stock'] != 0; }));
                usort($ls, function ($a, $b) {
                    return ((float) $b['stock'] * (float) $b['cost_unit']) <=> ((float) $a['stock'] * (float) $a['cost_unit']);
                });

                $row = array_map(function ($p) {
                    return [
                        'Producto'     => kpiProduct($p['name'], $p['sku']),
                        'Categoría'    => $this->categoryCell($p),
                        'Existencia'   => $this->quantityCell($p['stock'], $p['unidad']),
                        'Último costo' => evaluar((float) $p['cost_unit']),
                        'Valor'        => '<span class="font-semibold">' . evaluar((float) $p['stock'] * (float) $p['cost_unit']) . '</span>',
                        'opc'          => 0
                    ];
                }, $ls);
                break;

            case 'kpiProductos':
                $row = array_map(function ($p) {
                    return [
                        'Producto'   => kpiProduct($p['name'], $p['sku']),
                        'Categoría'  => $this->categoryCell($p),
                        'Existencia' => $this->quantityCell($p['stock'], $p['unidad']),
                        'Mínimo'     => $this->quantityCell($p['stock_min'], $p['unidad']),
                        'Estado'     => $this->stockStatus($p),
                        'opc'        => 0
                    ];
                }, $ls);
                break;

            case 'kpiBajo':
                $ls = array_values(array_filter($ls, function ($p) {
                    return (float) $p['stock'] > 0 && (float) $p['stock'] <= (float) $p['stock_min'];
                }));
                usort($ls, function ($a, $b) {
                    return ((float) $a['stock'] / (float) $a['stock_min']) <=> ((float) $b['stock'] / (float) $b['stock_min']);
                });

                $row = array_map(function ($p) {
                    return [
                        'Producto'   => kpiProduct($p['name'], $p['sku']),
                        'Categoría'  => $this->categoryCell($p),
                        'Existencia' => $this->quantityCell($p['stock'], $p['unidad']),
                        'Mínimo'     => $this->quantityCell($p['stock_min'], $p['unidad']),
                        'Faltante'   => '<span class="font-semibold text-amber-700">' . $this->quantityCell((float) $p['stock_min'] - (float) $p['stock'], $p['unidad']) . '</span>',
                        'opc'        => 0
                    ];
                }, $ls);
                break;

            case 'kpiAgotado':
                $ls = array_values(array_filter($ls, function ($p) { return (float) $p['stock'] <= 0; }));

                $row = array_map(function ($p) {
                    return [
                        'Producto'   => kpiProduct($p['name'], $p['sku']),
                        'Categoría'  => $this->categoryCell($p),
                        'Existencia' => '<span class="font-semibold text-red-600">' . $this->quantityCell($p['stock'], $p['unidad']) . '</span>',
                        'Mínimo'     => $this->quantityCell($p['stock_min'], $p['unidad']),
                        'opc'        => 0
                    ];
                }, $ls);
                break;

            default:
                return ['status' => 400, 'message' => 'Indicador no reconocido'];
        }

        return [
            'status'   => 200,
            'sucursal' => $_SESSION['branch'] ?? '',
            'row'      => $row
        ];
    }

    // La bitácora es de todos los usuarios de la sucursal activa; el filtro de
    // usuario es opcional.
    function lsMovimientos() {
        $type = $_POST['tipo'] ?? '';
        if (!isset(self::MOVEMENTS[$type])) $type = '';

        $userId = (int) ($_POST['user_id'] ?? 0);
        $fi     = $this->validDate($_POST['fi'] ?? '');
        $ff     = $this->validDate($_POST['ff'] ?? '');

        $ls = $this->listMovementLog([
            $this->companiesId,
            $this->branchId,
            $fi,
            $ff,
            $type,
            $type,
            $userId,
            $userId
        ]);

        $row = [];
        foreach ($ls as $m) {
            $movement = self::MOVEMENTS[$m['movement_type']] ?? [$m['movement_type'], '#6B7280', '#F3F4F6', 'circle'];

            // Los argumentos van como JSON: el folio es texto libre y así no rompe el
            // onclick aunque traiga comillas. Sin escape HTML: la tabla pone el
            // atributo con jQuery (setAttribute), que no decodifica &quot;.
            $args = json_encode($m['movement_type']) . ', ' . json_encode((string) $m['folio']);

            $row[] = [
                'id'         => $m['folio'],
                'Fecha'      => date('d/m/Y H:i', strtotime($m['created_at'])),
                'Movimiento' => badge($movement[0], $movement[1], 100, $movement[2], $movement[3]),
                'Folio'      => $m['folio'] ?: '-',
                'Usuario'    => $m['usuario'] ?: '-',
                'Almacén'    => $m['almacen'] ?: '-',
                'Productos'  => (int) $m['productos'],
                'Unidades'   => kpiQuantity($m['unidades']),
                'Costo'      => evaluar(abs((float) $m['costo'])),
                'a'          => [[
                    'class'   => 'inline-flex items-center justify-center w-8 h-8 p-1.5 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'title'   => 'Ver detalle',
                    'onclick' => "app.getMovimiento({$args})"
                ]],
                'opc'        => 0
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    // Detalle de una operación de la bitácora (el ojo): los productos que movió,
    // con la existencia antes y después y su costo.
    function getMovimiento() {
        $type  = $_POST['tipo'] ?? '';
        $folio = trim((string) ($_POST['folio'] ?? ''));

        if (!isset(self::MOVEMENTS[$type]) || $folio === '') {
            return ['status' => 400, 'message' => 'Movimiento no válido'];
        }

        $ls = $this->listMovementDetail([$this->companiesId, $this->branchId, $type, $folio]);
        if (empty($ls)) {
            return ['status' => 404, 'message' => 'No se encontró el movimiento en esta sucursal'];
        }

        $movement = self::MOVEMENTS[$type];
        $total    = 0;
        $row      = [];

        foreach ($ls as $p) {
            $qty    = (float) $p['quantity'];
            $total += abs((float) $p['cost_total']);
            $tone   = $qty < 0 ? 'text-red-600' : 'text-green-600';

            $row[] = [
                'Producto'       => kpiProduct($p['name'], $p['sku']),
                'Cantidad'       => '<span class="font-semibold ' . $tone . '">' . ($qty > 0 ? '+' : '') . $this->quantityCell($qty, $p['unidad']) . '</span>',
                'Existencia'     => $this->stockChange($p['stock_prev'], $p['stock_post']),
                'Costo unitario' => evaluar((float) $p['cost_unit']),
                'Importe'        => evaluar(abs((float) $p['cost_total'])),
                'opc'            => 0
            ];
        }

        $first = $ls[0];

        return [
            'status' => 200,
            'header' => [
                'tipo'      => $movement[0],
                'badge'     => badge($movement[0], $movement[1], 100, $movement[2], $movement[3]),
                'folio'     => $folio,
                'fecha'     => date('d/m/Y H:i', strtotime($first['created_at'])),
                'usuario'   => $first['usuario'] ?: '-',
                'almacen'   => $first['almacen'] ?: '-',
                'nota'      => trim((string) $first['note']),
                'productos' => count($ls),
                'costo'     => $total > 0 ? evaluar($total) : ''
            ],
            'row' => $row
        ];
    }

    // Existencia antes → después. Hay renglones viejos sin el dato guardado.
    private function stockChange($before, $after) {
        if ($before === null && $after === null) return '<span class="text-gray-400">-</span>';

        return '<span class="text-gray-500">' . ($before === null ? '-' : kpiQuantity($before)) . '</span>'
             . ' <span class="text-gray-400">→</span> '
             . '<span class="font-semibold">' . ($after === null ? '-' : kpiQuantity($after)) . '</span>';
    }

    private function validDate($date) {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $date) ? $date : date('Y-m-d');
    }

    private function quantityCell($value, $unit) {
        $unit = trim((string) $unit);

        return kpiQuantity($value) . ($unit !== '' ? ' <span class="text-[10px] uppercase text-gray-400">' . htmlspecialchars($unit, ENT_QUOTES, 'UTF-8') . '</span>' : '');
    }

    private function categoryCell($product) {
        $name = trim((string) ($product['categoria'] ?? ''));

        return $name !== '' ? htmlspecialchars($name, ENT_QUOTES, 'UTF-8') : '<span class="italic text-gray-400">Sin categoría</span>';
    }

    // Mismo corte que las cards: agotado sin existencia, bajo hasta su mínimo.
    private function stockStatus($product) {
        $stock = (float) $product['stock'];

        if ($stock <= 0)                                return badge('Agotado', '#DC2626', 100, '#FEE2E2');
        if ($stock <= (float) $product['stock_min'])   return badge('Stock bajo', '#B45309', 100, '#FEF3C7');
        return badge('Disponible', '#16A34A', 100, '#DCFCE7');
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
echo json_encode(Permissions::guard('dashboard', $opc, []) ?: $obj->{$opc}());
