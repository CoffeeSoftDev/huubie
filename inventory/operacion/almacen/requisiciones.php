<?php
// Requisiciones: la sucursal pide material al almacén de otra (o de la suya) y sigue su
// estado. Conserva la sección 'ordenes' (y sus permisos) de cuando se llamaba Pedidos.
$seccion = 'ordenes';
$modulo  = 'requisiciones';

require __DIR__ . '/layout/ordenes-page.php';
