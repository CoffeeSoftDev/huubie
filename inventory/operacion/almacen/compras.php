<?php
require_once __DIR__ . '/../../conf/_Session.php';

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/complementos.js?t=<?php echo time(); ?>"></script>

<link rel="stylesheet" href="../../src/css/dark-mode.css?v=<?php echo filemtime(__DIR__ . '/../../src/css/dark-mode.css'); ?>">

<!-- FULL CALENDAR: misma versión que alpha/pedidos/calendario -->
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js"></script>

<body>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content">
            <!-- Contenedor principal -->
            <div class="" id="root"></div>
        </div>
    </main>

    <!-- Importación navbar y sidebar -->
    <script src="../../acceso/src/js/navbar.js?v=<?php echo filemtime(__DIR__ . '/../../acceso/src/js/navbar.js'); ?>"></script>
    <script src="../../acceso/src/js/sidebar.js"></script>

    <!-- Captura con el formato de Órdenes: compra-form extiende orden-form, que extiende entrada-form -->
    <script src="../../src/js/components/entrada-form.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/components/entrada-form.js'); ?>"></script>
    <script src="../../src/js/components/orden-form.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/components/orden-form.js'); ?>"></script>
    <script src="../../src/js/components/compra-form.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/components/compra-form.js'); ?>"></script>
    <script src="../../src/js/components/compra-captura.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/components/compra-captura.js'); ?>"></script>

    <!-- Módulo de Compras -->
    <script src="js/compras.js?t=<?php echo time(); ?>"></script>
</body>
</html>
