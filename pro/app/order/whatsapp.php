<?php
require_once __DIR__ . '/../../core/security/_Permission.php';
Permission::page('pos-whatsapp', '../../');

$title  = 'WhatsApp';
$script = 'whatsapp';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
