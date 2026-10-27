<?php
/*  Esqueleto de las paginas del modulo: el de inventory/tenant (layout/head.php y
    core-libraries.php) con los assets de pro. Cada seccion lo incluye despues de
    Permission::page(), con $title y $script definidos, y cierra con scripts.php. */
$asset = function ($file) {
    return '../../' . $file . '?v=' . filemtime(__DIR__ . '/../../../' . $file);
};
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Huubie · <?= htmlspecialchars($title) ?></title>
    <link rel="icon" href="../../assets/img/huubie192.png" type="image/png">

    <link rel="stylesheet" href="../../assets/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="../../assets/plugins/fontello/css/animation.css">
    <link rel="stylesheet" href="../../assets/plugins/bootstrap-5/css/bootstrap.min.css">
    <link rel="stylesheet" href="../../assets/plugins/datatables/dataTables.responsive.min.css">
    <link rel="stylesheet" href="../../assets/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="../../assets/plugins/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="../../assets/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css">

    <link rel="stylesheet" href="<?= $asset('assets/css/general.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/colors.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/table.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/buttons.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/background.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/text.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/style.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/sidebar.css') ?>">

    <!-- tailwind-theme.js va JUSTO despues del CDN: le da la config y pinta la paleta guardada. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="<?= $asset('assets/js/tailwind-theme.js') ?>"></script>

    <link rel="stylesheet" href="<?= $asset('assets/css/compact.css') ?>">
    <!-- Tokens del tema activo: al final, redefine lo que las hojas de arriba dejaron fijo. -->
    <link rel="stylesheet" href="<?= $asset('assets/css/themes.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/dark-mode.css') ?>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        /* Select2 detras de los modales; modales y alertas siempre encima. */
        .select2-container, .select2-dropdown { z-index: 1 !important; }
        .modal-backdrop, .bootbox-backdrop, .swal2-container { z-index: 9998 !important; }
        .modal, .bootbox-modal, .swal2-popup { z-index: 9999 !important; }

        /* Los modales (bootbox) van claros aunque la pagina este en oscuro. */
        body.dark-mode .modal-content,
        body.dark-mode .modal-header,
        body.dark-mode .modal-footer {
            background-color: #ffffff !important;
            color: #111827 !important;
            border-color: #e5e7eb !important;
        }
        body.dark-mode .modal-title,
        body.dark-mode .modal label { color: #111827 !important; }
        body.dark-mode .modal input,
        body.dark-mode .modal select,
        body.dark-mode .modal textarea,
        body.dark-mode .modal .form-control {
            background-color: #ffffff !important;
            color: #111827 !important;
            border-color: #d1d5db !important;
        }
    </style>
</head>

<body>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content">
            <div id="root"></div>
        </div>
    </main>
