<?php
require_once __DIR__ . '/../../core/security/_Session.php';
require_once __DIR__ . '/../../core/security/_Permission.php';

/*  Puerta del modulo y el HOME de quien no es root (auth/ctrl/ctrl-auth.php).

    Ojo: como esta carpeta ES el inicio, aqui NUNCA se redirige a
    $_SESSION['home']: seria un bucle. Sin Pedidos se busca la primera seccion
    que si tenga; si no hay ninguna se pinta un aviso con el marco de pro. */
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

if (Permission::section('pos-pedidos')) {
    header('Location: pedidos.php');
    exit;
}

foreach (Permission::sections(0) as $section) {
    $route = trim((string) $section['route']);

    if ($route === '' || strpos($route, 'app/order/') === 0) continue;

    header('Location: ../../' . $route);
    exit;
}

$title    = 'Inicio';
$script   = '';
$rootHtml = ''
    . '<div class="ord-aviso">'
    .   '<i data-lucide="lock-keyhole" class="w-6 h-6"></i>'
    .   '<div>'
    .     '<p class="ord-aviso-titulo">Tu rol no tiene secciones en esta sucursal.</p>'
    .     '<p class="ord-aviso-texto">Cambia de sucursal en la barra o pide acceso a quien administra Huubie.</p>'
    .   '</div>'
    . '</div>'
    . '<script>document.addEventListener("DOMContentLoaded",function(){if(window.lucide)lucide.createIcons();});</script>';

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
