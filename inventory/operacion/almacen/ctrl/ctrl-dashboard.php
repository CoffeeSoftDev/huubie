<?php
session_start();

if (empty($_COOKIE["IDU"])) {
    echo json_encode(['success' => false, 'message' => 'Sesión no válida']);
    exit();
}

require_once '../mdl/mdl-dashboard.php';

$opc = $_POST['opc'] ?? '';
$dashboard = new Dashboard();

switch ($opc) {
    case 'getDashboardData':
        $data = [
            'totalProductos' => $dashboard->getTotalProductos(),
            'stockTotal' => $dashboard->getStockTotal(),
            'productosBajos' => $dashboard->getProductosBajos(),
            'valorInventario' => $dashboard->getValorInventario(),
            'movimientos' => $dashboard->getMovimientosRecientes(),
            'productosBajos' => $dashboard->getListaProductosBajos()
        ];
        
        echo json_encode(['success' => true, 'data' => $data]);
        break;
        
    default:
        echo json_encode(['success' => false, 'message' => 'Operación no válida']);
        break;
}
