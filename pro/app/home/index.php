<?php
require_once __DIR__ . '/../../core/security/_Session.php';

if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

// El inicio es de una empresa. root que aun no elige una no tiene de cual verlo.
if (empty($_SESSION['company_id'])) {
    header('Location: ../empresas/');
    exit;
}

$root    = '../../';
$here    = __DIR__;
$title   = 'Inicio';
$active  = 'inicio';
$scripts = ['src/js/home.js'];

require __DIR__ . '/../../layout/head.php';
require __DIR__ . '/../../layout/scripts.php';
