<?php
require_once __DIR__ . '/../../core/security/_Permission.php';
Permission::page('accesos', '../../');

$title  = 'Accesos';
$script = 'accesos';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
