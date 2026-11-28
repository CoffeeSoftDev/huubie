<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-surtir', a su inicio.
Permission::page('inv-surtir', '../../');

// El mismo requisiciones.js de Requisiciones, del lado de quien surte (sin captura).
$title  = 'Surtir';
$script = 'requisiciones';
$cdnJs  = ['https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js'];

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
