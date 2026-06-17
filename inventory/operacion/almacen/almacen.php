<?php
session_start();

// Evita que el navegador sirva una copia vieja del HTML (y por tanto del
// general.css cacheado). Sin esto, un alert de Swal podia seguir contrayendo el
// container porque se cargaba el CSS previo al fix. Combinado con el ?v=filemtime
// del <link> en head.php, garantiza CSS siempre fresco en desarrollo.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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
<script src="../../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/complementos.js?t=<?php echo time(); ?>"></script>

<body>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2">
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
