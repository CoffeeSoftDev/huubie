<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion, a su inicio.
Permission::page('pos-pedidos', '../../');

// La lista de pedidos (calendario y tablero incluidos). La captura vive en pedido.php.
$title  = 'Pedidos';
$script = 'lista-pedidos';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
