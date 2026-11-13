<?php
require_once __DIR__ . '/../../core/security/_Session.php';

if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

// Los datos de la empresa son cosa de su dueño (o de root viendola como tal).
if (empty($_SESSION['company_id']) || empty($_SESSION['is_owner'])) {
    header('Location: ../../' . $_SESSION['home']);
    exit;
}

$root    = '../../';
$here    = __DIR__;
$title   = 'Configura tu empresa';
$scripts = ['src/js/configurar.js'];

require __DIR__ . '/../../layout/head.php';
require __DIR__ . '/../../layout/scripts.php';
