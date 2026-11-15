<?php
require_once __DIR__ . '/../../core/security/_Permission.php';
Permission::page('pos-ecommerce', '../../');

$title  = 'Tienda en línea';
$script = 'tienda';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
