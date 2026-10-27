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
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        :root          { --emp-bg: #F3F4F6; }
        body.dark-mode { --emp-bg: #111928; }

        body { font-family: 'Inter', sans-serif; background: var(--emp-bg); transition: background .2s ease; }

        /* Icono flotante de tema (solo icono, sin recuadro de boton). */
        .emp-theme-toggle {
            position: fixed; top: 18px; right: 18px; z-index: 50;
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            color: #6B7280; border: none; background: transparent;
            transition: color .15s ease; cursor: pointer;
        }
        .emp-theme-toggle:hover { color: #111827; }
        body.dark-mode .emp-theme-toggle       { color: #9CA3AF; }
        body.dark-mode .emp-theme-toggle:hover { color: #F9FAFB; }
    </style>
</head>

<body class="h-screen flex flex-col overflow-hidden">

    <button id="btn-theme" class="emp-theme-toggle" title="Cambiar tema claro/oscuro" type="button"></button>

    <main class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div class="w-full flex-1 flex flex-col" id="root"></div>
    </main>

    <script src="../../assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>
    <script src="../../assets/js/coffeeSoft.js?v=<?= $version('assets/js/coffeeSoft.js') ?>"></script>
    <script src="../../assets/components/cs-selector-cards.js?v=<?= $version('assets/components/cs-selector-cards.js') ?>"></script>
    <script src="src/js/app.js?v=<?= filemtime(__DIR__ . '/src/js/app.js') ?>"></script>
</body>

</html>
