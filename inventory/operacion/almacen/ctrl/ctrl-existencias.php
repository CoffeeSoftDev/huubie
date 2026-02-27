<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-existencias.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    function init() {
        return [
            'zonas'      => $this->lsZonas(),
            'categorias' => $this->lsCategorias(),
            'areas'      => $this->lsAreas()
        ];
    }

    function lsExistencias() {
        $filters = [
            'zona'      => $_POST['zona'] ?? 'Todos',
            'area'      => $_POST['area'] ?? 'Todos',
            'categoria' => $_POST['categoria'] ?? 'Todos',
            'estatus'   => $_POST['estatus'] ?? 'Todos'
        ];

        $data = $this->listExistencias($filters);
        $rows = [];

        foreach ($data as $item) {
            $estatus = $this->getEstatusStock($item['cantidad'], $item['inventario_min']);
            $contenido = $this->calcularContenido($item['cantidad'], $item['presentacion']);
            $total = floatval($item['Costo']) * floatval($item['cantidad']);

            $rows[] = [
                'id'             => $item['id'],
                'Producto'       => $item['producto'],
                'Presentación'   => $item['presentacion'] ?? '-',
              
                'Min Cantidad'   => $item['inventario_min'] ?? 0,
                'Precio' => [
                    'html'  => '$' . number_format($item['PrecioVenta'] ?? 0, 2),
                    'class' => 'text-end'
                ],


                'Fecha'          => $item['fecha_mayoreo'] ? date('Y-m-d', strtotime($item['fecha_mayoreo'])) : '-',
                'Inicial'        => $item['stock_inicial'] ?? 0,
                'Mínimo'         => $item['inventario_min'] ?? 0,
                'Existente'      => $item['cantidad'] ?? 0,
                'Estatus'        => renderEstatusStock($estatus),
                'Contenido'      => $contenido,
                'Total'          => [
                    'html'  => '$' . number_format($total, 2),
                    'class' => 'text-end font-bold'
                ]
            ];
        }

        return [
            'row' => $rows
        ];
    }

    function getResumenExistencias() {
        $filters = [
            'zona'      => $_POST['zona'] ?? 'Todos',
            'area'      => $_POST['area'] ?? 'Todos',
            'categoria' => $_POST['categoria'] ?? 'Todos',
            'estatus'   => $_POST['estatus'] ?? 'Todos'
        ];

        $data = $this->getResumen($filters);
        $resumen = $data[0] ?? [];

        return [
            'totalProductos' => $resumen['total'] ?? 0,
            'disponibles'    => $resumen['disponibles'] ?? 0,
            'stockBajo'      => $resumen['stock_bajo'] ?? 0,
            'agotados'       => $resumen['agotados'] ?? 0,
            'valorTotal'     => '$' . number_format($resumen['valor_total'] ?? 0, 2)
        ];
    }

    function getProducto() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Producto no encontrado';
        $data    = null;

        $producto = $this->getProductoById($id);

        if ($producto) {
            $status  = 200;
            $message = 'Producto encontrado';
            $data    = $producto;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    private function getEstatusStock($cantidad, $minimo) {
        if ($cantidad == 0) return 'agotado';
        if ($cantidad <= $minimo) return 'bajo';
        return 'disponible';
    }

    private function calcularContenido($cantidad, $presentacion) {
        if (empty($presentacion)) return $cantidad . ' unidades';
        return $cantidad . ' ' . $presentacion;
    }
}

// Complements

function renderEstatusStock($estatus) {
    switch ($estatus) {
        case 'disponible':
            return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700"><i class="icon-ok-circled"></i> OK</span>';
        case 'bajo':
            return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-700"><i class="icon-attention"></i> PEDIR</span>';
        case 'agotado':
            return '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700"><i class="icon-cancel-circled"></i> PEDIR</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">-</span>';
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
