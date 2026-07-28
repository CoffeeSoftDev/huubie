<?php require_once("../conf/_Rutes.php"); ?>
<?php
require_once(__DIR__ . '/layout/head.php');
require_once(__DIR__ . '/layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="/app/facture/src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
<script src="/app/facture/src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="/app/facture/src/js/complementos.js?t=<?php echo time(); ?>"></script>

<link rel="stylesheet" href="/app/facture/src/css/dark-mode.css">
<link rel="stylesheet" href="/app/facture/src/css/facture.css?t=<?php echo time(); ?>">
</head>

<body>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Operación</li>
                    <li class="breadcrumb-item text-muted"><a href="/app/facture/index.php" class="text-decoration-none text-muted">Facturador</a></li>
                    <li class="breadcrumb-item fw-bold active">Resumen</li>
                </ol>
            </nav>

            <!-- Contenedor principal -->
            <div class="" id="root"></div>
        </div>
    </main>

    <!-- Navbar y sidebar propios del modulo (sin fetch) -->
    <script src="/app/facture/src/js/navbar.js?t=<?php echo time(); ?>"></script>
    <script src="/app/facture/src/js/sidebar.js?t=<?php echo time(); ?>"></script>

    <!-- Modulo Resumen -->
    <script src="/app/facture/src/js/sample_resumen.js?t=<?php echo time(); ?>"></script>
    <script src="/app/facture/src/js/resumen.js?t=<?php echo time(); ?>"></script>
</body>
</html>
