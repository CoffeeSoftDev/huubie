<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-kardex', a su inicio.
Permission::page('inv-kardex', '../../');

$title  = 'Kárdex';
$script = 'kardex';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
