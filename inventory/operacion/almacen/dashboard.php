<?php
session_start();

if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<link rel="stylesheet" href="../../src/css/dark-mode.css">

<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <div id="menu-sidebar" class="bg-[#2C1B18] flex flex-col items-center py-4 gap-2">
    </div>
    <main>
        <div id="menu-navbar"></div>
        <div id="main__content">
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase parent">Operación</li>
                    <li class="breadcrumb-item fw-bold child">Dashboard</li>
                </ol>
            </nav>
            <div id="root"></div>
        </div>
    </main>

    <script src="../../acceso/src/js/navbar.js"></script>
    <script src="../../acceso/src/js/sidebar.js"></script>
    <script src="js/dashboard.js?t=<?php echo time(); ?>"></script>

</body>
</html>
