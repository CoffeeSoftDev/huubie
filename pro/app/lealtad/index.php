<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

/*  Lealtad: el modulo `lealtad` del catalogo de modulos (planes de Rosy).
    Hoy tiene una sola seccion, Tarjetas: la carpeta entra directo a ella.
    Sin acceso (rol o plan), de vuelta a su inicio. */
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

$route = Permission::section('pos-puntos') ? 'app/lealtad/tarjetas.php' : $_SESSION['home'];

header('Location: ../../' . $route);
exit;
