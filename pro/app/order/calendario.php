<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion, a su inicio.
Permission::page('pos-calendario', '../../');

// Pedidos y Calendario son una sola pantalla: quien también ve Pedidos entra a la vista Calendario de ahí.
if (Permission::can('pos-pedidos', 'show')) {
    header('Location: pedidos.php?vista=calendario');
    exit;
}

$title  = 'Calendario';
$script = 'calendario';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
