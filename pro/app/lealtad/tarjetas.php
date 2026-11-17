<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Lealtad › Tarjetas. La seccion conserva el code con que nacio en Punto de venta: pos-puntos.
Permission::page('pos-puntos', '../../');

$title  = 'Tarjetas';
$script = 'tarjetas';

// Tarjeta digital: el QR (qrcode-generator) y copiar / mandar por WhatsApp (ticketCopy y ticketPhone de Pedidos).
// Sellos: el selector de iconos de CoffeeSoft (csIconField) para el icono del sello.
$extra = [
    'assets/plugins/qrcode/qrcode.js',
    'app/order/src/js/components/ticket-share.js',
    'assets/components/cs-icons.js',
    'assets/components/cs-icon-picker.js'
];

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
