<?php
session_start();

// Validar sesión de usuario
// if (empty($_SESSION["IDU"])) {
//     require_once('../../acceso/ctrl/ctrl-logout.php');
//     exit();
// }

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>
<style>
    /* Select2 detrás de modales */
    .select2-container,
    .select2-dropdown {
        z-index: 1 !important;
    }
    
    /* Modales siempre encima */
    .modal-backdrop,
    .bootbox-backdrop,
    .swal2-container {
        z-index: 9998 !important;
    }
    
    .modal,
    .bootbox-modal,
    .swal2-popup {
        z-index: 9999 !important;
    }
</style>
<link rel="stylesheet" href="../../src/css/dark-mode.css">

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <div id="menu-sidebar" class="bg-[#2C1B18] flex flex-col items-center py-4 gap-2">
    </div>
    <main>
        <div id="menu-navbar"></div>
        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase parent">Operación</li>
                    <li class="breadcrumb-item fw-bold child">Almacén</li>
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
    <script src="js/almacen-main.js?t=<?php echo time(); ?>"></script>
    <script src="js/existencias.js?t=<?php echo time(); ?>"></script>

</body>
</html>
