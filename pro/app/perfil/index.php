<?php
require_once __DIR__ . '/../../core/security/_Session.php';

// El perfil es de la persona, no de un modulo: basta con tener sesion. Lo ve
// tambien quien pertenece a una empresa que no esta al corriente.
if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

$root    = '../../';
$here    = __DIR__;
$title   = 'Mi perfil';
$active  = 'perfil';
$scripts = ['src/js/perfil.js'];

require __DIR__ . '/../../layout/head.php';
require __DIR__ . '/../../layout/scripts.php';
