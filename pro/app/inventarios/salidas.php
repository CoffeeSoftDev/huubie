<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-salidas', a su inicio.
Permission::page('inv-salidas', '../../');

$title  = 'Salidas';
$script = 'salidas';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
