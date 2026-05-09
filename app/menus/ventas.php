<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Alpha</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer"
        class="w-full h-[calc(100vh-3rem)] bg-[#111928] pt-5 transition-all duration-500 text-white p-6 flex flex-col md:flex-row gap-x-4">
        <div id="grid-card"
            class="w-full grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2"></div>
    </div>

    <!-- Modulo Scripts -->
    <script src="/app/menus/src/js/cards.js?t=<?php echo time(); ?>"></script>
    <script src="/app/menus/src/js/ventas.js?t=<?php echo time(); ?>"></script>
</body>

</html>
