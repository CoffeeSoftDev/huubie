<?php
/*  Esqueleto de las paginas de Pedidos: el mismo de Catalogo (rail, navbar y
    hojas de pro) con la hoja propia del modulo al final. La pagina lo incluye
    despues de Permission::page(), con $title y $script definidos, y cierra con
    scripts.php. $rootHtml (opcional) se pinta dentro de #root tal cual: lo usa
    index.php para el aviso de "sin secciones". */
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
    <link rel="icon" href="../../assets/img/favicon.svg" type="image/svg+xml">

    <link rel="stylesheet" href="../../assets/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="../../assets/plugins/fontello/css/animation.css">
    <link rel="stylesheet" href="../../assets/plugins/bootstrap-5/css/bootstrap.min.css">
    <link rel="stylesheet" href="../../assets/plugins/datatables/dataTables.responsive.min.css">
    <link rel="stylesheet" href="../../assets/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="../../assets/plugins/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="../../assets/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css">
    <link rel="stylesheet" href="../../assets/plugins/daterangepicker/daterangepicker.css">

    <link rel="stylesheet" href="<?= $asset('assets/css/general.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/colors.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/table.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/buttons.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/background.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/text.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/style.css') ?>">

    <!-- tailwind-theme.js va JUSTO despues del CDN: le da la config y pinta la paleta guardada. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="<?= $asset('assets/js/tailwind-theme.js') ?>"></script>

    <link rel="stylesheet" href="<?= $asset('assets/css/compact.css') ?>">
    <!-- Tokens del tema activo: al final, redefine lo que las hojas de arriba dejaron fijo. -->
    <link rel="stylesheet" href="<?= $asset('assets/css/themes.css') ?>">
    <!-- Estetica suave de los modulos: tablas, filtros, pestañas y botones. -->
    <link rel="stylesheet" href="<?= $asset('assets/css/soft.css') ?>">
    <link rel="stylesheet" href="<?= $asset('assets/css/dark-mode.css') ?>">
    <!-- La del modulo despues de dark-mode: le quita a #main__content la tarjeta aliceblue. -->
    <link rel="stylesheet" href="src/css/order.css?v=<?= filemtime(__DIR__ . '/../src/css/order.css') ?>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet">

    <style>
        /* Select2 detras de los modales; modales y alertas siempre encima. */
        .select2-container, .select2-dropdown { z-index: 1 !important; }
        .modal-backdrop, .bootbox-backdrop, .swal2-container { z-index: 9998 !important; }
        .modal, .bootbox-modal, .swal2-popup { z-index: 9999 !important; }
    </style>
</head>

<body>
    <div id="menu-sidebar"></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content" class="cp-pagina-pro">
            <div id="root"><?= $rootHtml ?? '' ?></div>
        </div>
    </main>
