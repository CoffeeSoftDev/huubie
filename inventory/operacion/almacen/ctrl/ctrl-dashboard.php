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
                'opc'        => 0
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    private function validDate($date) {
        return preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $date) ? $date : date('Y-m-d');
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
echo json_encode(Permissions::guard('dashboard', $opc, []) ?: $obj->{$opc}());
