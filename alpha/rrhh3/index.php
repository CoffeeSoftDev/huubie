<?php
session_start();
if (!isset($_SESSION['USR'])) { header('Location: /alpha/'); exit(); }
?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="../src/img/logo/logo.ico" type="image/x-icon">
    <title>RRHH v3 - Huubie</title>

    <!-- Tailwind -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">

    <!-- Plugins -->
    <link rel="stylesheet" href="../src/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="../src/plugins/sweetalert2/sweetalert2.min.css">
    <script src="../src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="../src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="../src/plugins/moment.js"></script>

    <!-- Huubie RRHH Design System -->
    <link rel="stylesheet" href="src/css/huubie-rrhh.css">

    <!-- CoffeeSoft (solo useFetch, alert, utils) -->
    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="../src/js/plugins.js?t=<?php echo time(); ?>"></script>

    <!-- Nav -->
    <script src="../access/src/js/session.js"></script>
    <script src="../menus/src/js/navbar.js"></script>
    <script src="../menus/src/js/sidebar.js"></script>

    <style>
        body { font-family:'Inter',system-ui,sans-serif; }
    </style>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white mt-12 p-4 overflow-x-hidden">
        <div style="background-color:#111928;" class="w-full max-w-full" id="root"></div>
    </div>

    <!-- RRHH3 Module -->
    <script src="src/js/rrhh3.js?t=<?php echo time(); ?>"></script>
</body>
</html>
