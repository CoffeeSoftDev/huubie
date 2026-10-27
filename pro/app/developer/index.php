<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// El modulo no tiene portada: entra a la primera seccion que el usuario puede
// ver (su orden en sections). Sin ninguna, de vuelta a su inicio.
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

$moduleId = Permission::moduleId('developer');
$route    = $_SESSION['home'];

foreach ($moduleId > 0 ? Permission::sections($moduleId) : [] as $section) {
    if (trim((string) $section['route']) !== '') {
        $route = $section['route'];
        break;
    }
}

header('Location: ../../' . $route);
exit;
