<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-stock', a su inicio.
Permission::page('inv-stock', '../../');

$title  = 'Stock';
$script = 'stock';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
