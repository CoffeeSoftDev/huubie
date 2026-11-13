<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion, a su inicio.
Permission::page('pos-clientes', '../../');

$title  = 'Clientes';
$script = 'clientes';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
