<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="/coffee/">
    <link rel="icon" type="image/svg+xml" href="src/img/logo/logo.ico" />
    <title>Alpha</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

    <!-- CoffeeSoft Framework -->
    <script src="src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/complementos.js"></script>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer"
        class="w-full h-[calc(100vh-3rem)] bg-[#111928] pt-5 transition-all duration-500 text-white p-6 flex flex-col md:flex-row gap-x-4">
        <div id="grid-card"
            class="w-full grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2"></div>
    </div>

    <!-- Navbar & Sidebar -->
    <script src="access/src/js/session.js"></script>
    <script src="src/js/navbar.js"></script>
    <script src="src/js/sidebar.js"></script>

    <!-- Modulo Scripts -->
    <script src="menus/src/js/cards.js?t=<?php echo time(); ?>"></script>
    <script src="menus/src/js/ventas.js?t=<?php echo time(); ?>"></script>
</body>

</html>
