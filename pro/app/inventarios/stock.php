<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-stock', a su inicio.
Permission::page('inv-stock', '../../');

$title      = 'Stock';
$script     = 'stock';
$visor      = true;
// «Abrir ficha»: la misma ficha de inventario del Catálogo de insumos › Productos.
$components = ['ficha-inventario'];

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
