<?php
session_start();

// if (empty($_COOKIE["IDU"])) {
//     require_once('../acceso/ctrl/ctrl-logout.php');
//     exit();
// }
?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="/app/src/img/logos/logo_icon.png" type="image/x-icon">
    <title>Admin</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div class="h-full">
        <div class="h-full" id="root"></div>
    </div>

    <!-- Modulo Scripts -->
    <script src="/app/config/js/config.js?t=<?php echo time(); ?>"></script>
</body>
</html>
