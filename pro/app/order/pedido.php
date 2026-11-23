<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion, a su inicio. Es parte de la seccion Pedidos.
Permission::page('pos-pedidos', '../../');

/*  La captura de pedidos (TPV): pedido.php = pedido nuevo; pedido.php?id=<id>
    edita ese pedido. Al terminar regresa a lista-pedidos.php (src/js/pedido.js).
    $railRoute: no es una seccion del menu; el rail la trata como la lista. */
$title     = 'Pedido';
$script    = 'pedido';
$railRoute = 'app/order/lista-pedidos.php';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
