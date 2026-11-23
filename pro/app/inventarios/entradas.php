<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-entradas', a su inicio.
Permission::page('inv-entradas', '../../');

$title  = 'Entradas';
$script = 'entradas';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
