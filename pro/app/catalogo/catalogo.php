<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'catalogo', a su inicio.
Permission::page('catalogo', '../../');

$title  = 'Catálogo';
$script = 'catalogo';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
