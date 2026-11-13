<?php
require_once __DIR__ . '/../../core/security/_Session.php';

if (Session::user() === null) {
    header('Location: ../../index.php');
    exit;
}

// Solo root elige empresa; los demas entran directo a la suya.
if (empty($_SESSION['is_root'])) {
    header('Location: ../../' . $_SESSION['home']);
    exit;
}

$version = function ($file) {
    return filemtime(__DIR__ . '/../../' . $file);
};
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Huubie · Selecciona tu empresa</title>
    <link rel="icon" href="../../assets/img/huubie192.png" type="image/png">
    <!-- tailwind-theme.js va JUSTO despues del CDN: le da la config y pinta la
         paleta guardada antes de que se vea nada. Con themes.css, esta pagina
         sigue al tema que se elige en la barra, igual que las de los modulos. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="../../assets/js/tailwind-theme.js?v=<?= $version('assets/js/tailwind-theme.js') ?>"></script>
    <link rel="stylesheet" href="../../assets/css/themes.css?v=<?= $version('assets/css/themes.css') ?>">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        /* El fondo lo pone themes.css (--bg): gris en claro, la superficie del
           scheme en oscuro. */
        body { font-family: 'Inter', sans-serif; transition: background .2s ease; }
    </style>
</head>

<body class="h-screen flex flex-col overflow-hidden">

    <!-- La barra de pro: quien entro, el selector de temas y la salida. Aqui
         va sin rail: root todavia no esta dentro de ninguna empresa. -->
    <div id="menu-navbar"></div>

    <main class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div class="w-full flex-1 flex flex-col" id="root"></div>
    </main>

    <script src="../../assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>
    <script src="../../assets/js/coffeeSoft.js?v=<?= $version('assets/js/coffeeSoft.js') ?>"></script>
    <script src="../../assets/components/cs-selector-cards.js?v=<?= $version('assets/components/cs-selector-cards.js') ?>"></script>
    <script src="../../auth/src/js/navbar.js?v=<?= $version('auth/src/js/navbar.js') ?>"></script>
    <script src="src/js/app.js?v=<?= filemtime(__DIR__ . '/src/js/app.js') ?>"></script>
</body>

</html>
