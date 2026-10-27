<?php
require_once __DIR__ . '/../../core/security/_Permission.php';
Permission::page('facturacion', '../../');

$title  = 'Facturación';
$script = 'facturacion';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
