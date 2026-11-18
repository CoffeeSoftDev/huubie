<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Lealtad › Programa: cómo entran los clientes y los mensajes que salen solos. Sección propia: lealtad-programa.
Permission::page('lealtad-programa', '../../');

$title  = 'Programa';
$script = 'programa';

// Su lógica vive en la clase Loyalty de tarjetas.js (se carga como librería, sin arrancar Tarjetas).
// El QR del registro (qrcode-generator), copiar el enlace (ticketCopy) y los iconos del sello en la ficha.
$extra = [
    'assets/plugins/qrcode/qrcode.js',
    'app/order/src/js/components/ticket-share.js',
    'assets/components/cs-icons.js',
    'app/lealtad/src/js/tarjetas.js'
];

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
