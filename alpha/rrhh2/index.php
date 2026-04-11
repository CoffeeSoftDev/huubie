<?php
session_start();

if (!isset($_SESSION['USR'])) {
    header('Location: /alpha/');
    exit();
}
?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="../src/img/logo/logo.ico" type="image/x-icon">
    <title>RRHH - Huubie</title>

    <?php require_once('layout/head.php'); ?>
    <?php require_once('layout/core-libraries.php'); ?>

    <!-- CoffeeSoft Framework -->
    <script src="../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
    <script src="../src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white mt-12 p-3 overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto" id="root"></div>
    </div>

    <!-- RRHH Components -->
    <script src="src/js/components/incidencia-grid.js?t=<?php echo time(); ?>"></script>

    <!-- RRHH Module -->
    <script src="src/js/rrhh.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/rrhh-resumen.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/rrhh-personal.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/rrhh-permisos.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/rrhh-incidencias.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/rrhh-nomina.js?t=<?php echo time(); ?>"></script>
</body>
</html>
