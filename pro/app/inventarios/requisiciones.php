<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-requisiciones', a su inicio.
Permission::page('inv-requisiciones', '../../');

/*  Requisiciones (quien pide) y Surtir (quien surte, surtir.php): el mismo
    requisiciones.js; el lado sale del nombre de la página. La captura es la
    hoja de inventory (orden-form.js, que extiende entrada-form.js). */
$title      = 'Requisiciones';
$script     = 'requisiciones';
$components = ['entrada-form', 'orden-form'];
$cdnJs      = ['https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js'];

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
