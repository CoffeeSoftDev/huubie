<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion, a su inicio.
Permission::page('pos-tickets', '../../');

$title  = 'Tickets/Cierre';
$script = 'cortes';

// Como alpha/order-visor: la sucursal se elige en la barra de filtros del visor, no en la de arriba.
$noBranch = true;

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
