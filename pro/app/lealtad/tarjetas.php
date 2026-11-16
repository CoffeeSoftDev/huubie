<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Lealtad › Tarjetas. La seccion conserva el code con que nacio en Punto de venta: pos-puntos.
Permission::page('pos-puntos', '../../');

$title  = 'Tarjetas';
$script = 'tarjetas';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
