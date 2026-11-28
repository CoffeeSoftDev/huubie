<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-traspasos', a su inicio.
Permission::page('inv-traspasos', '../../');

$title      = 'Traspasos';
$script     = 'traspasos';
$components = ['traspaso-form'];
$visor      = true;

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
