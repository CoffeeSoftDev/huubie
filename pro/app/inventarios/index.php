<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

/*  Inventarios: el modulo `inventarios` (id 3). La carpeta entra a la primera
    seccion con pagina que el usuario puede ver (Stock, Entradas, Salidas...),
    en el orden del menu. Permission::sections ya cuenta el plan y el rol; el
    Dueño y root las ven todas. Sin ninguna, a su inicio.

    Las secciones que aun no tienen pagina (route NULL) salen en el rail como
    «Próximamente». */
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

$moduleId = Permission::moduleId('inventarios');
$route    = '';

foreach ($moduleId === 0 ? [] : Permission::sections($moduleId) as $section) {
    $route = trim((string) $section['route']);
    if ($route !== '') break;
}

header('Location: ../../' . ($route !== '' ? $route : $_SESSION['home']));
exit;
