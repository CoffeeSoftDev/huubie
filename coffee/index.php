<?php
session_start();

// if (empty($_COOKIE["IDU"])) {
//     require_once('../acceso/ctrl/ctrl-logout.php');
//     exit();
// }
?>
<!DOCTYPE html>
<html  class="bg-[#111928]" lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="src/img/logos/logo_icon.png" type="image/x-icon">
    <title></title>

    <?php require_once(__DIR__ . '/layout/head.php'); ?>
    <?php require_once(__DIR__ . '/layout/core-libraries.php'); ?>

    <!-- CoffeeSoft Framework -->
    <script src="src/js/coffeeSoft.js"></script>
    <script src="src/js/plugins.js"></script>
    <script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div class="h-full">
        <div class="h-full" id="root"></div>
    </div>

    <!-- Navbar & Sidebar -->
    <script src="src/js/navbar.js"></script>
    <script src="src/js/sidebar.js"></script>

    <!-- Modulo Scripts -->
    <script src="js/coffee.js?t=<?php echo time(); ?>"></script>
</body>
</html>