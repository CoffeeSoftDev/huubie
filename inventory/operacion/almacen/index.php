<?php
session_start();

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

<link rel="stylesheet" href="../../src/css/dark-mode.css">
<link rel="stylesheet" href="css/almacen-sidebar.css?t=<?php echo time(); ?>">

<body>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Operación</li>
                    <li class="breadcrumb-item fw-bold active">Almacén</li>
                </ol>
            </nav>
            <!-- Contenedor principal -->
            <div class="" id="root"></div>
        </div>
    </main>

    <!-- Importación navbar y sidebar -->
    <script src="../../acceso/src/js/navbar.js"></script>
    <script src="../../acceso/src/js/sidebar.js"></script>

    <!-- Componente tabLayout -->
    <script src="../../src/js/components/tabLayout.js?t=<?php echo time(); ?>"></script>
    
    <!-- Módulo de Catálogo -->
    <script src="js/almacen.js?t=<?php echo time(); ?>"></script>
    <script src="js/catalogo.js?t=<?php echo time(); ?>"></script>
</body>
</html>
