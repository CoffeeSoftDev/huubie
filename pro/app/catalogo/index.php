<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Catalogo es una seccion de POS (H-02): la carpeta entra directo a ella.
// Sin acceso, de vuelta a su inicio.
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

$route = Permission::section('catalogo') ? 'app/catalogo/catalogo.php' : $_SESSION['home'];

header('Location: ../../' . $route);
exit;
