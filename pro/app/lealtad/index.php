<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

/*  Lealtad: el modulo `lealtad` del catalogo de modulos (planes de Rosy).
    Dos secciones sueltas: Tarjetas (pos-puntos) y Programa (lealtad-programa).
    La carpeta entra a la primera que el rol pueda abrir; sin ninguna (rol o
    plan), de vuelta a su inicio. */
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

if (Permission::section('pos-puntos'))           $route = 'app/lealtad/tarjetas.php';
elseif (Permission::section('lealtad-programa')) $route = 'app/lealtad/programa.php';
else                                             $route = $_SESSION['home'];

header('Location: ../../' . $route);
exit;
