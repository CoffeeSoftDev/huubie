<?php
require_once __DIR__ . '/../../conf/_Session.php';

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

// El rol necesita al menos una acción en Configuración > Accesos; si no, de regreso a Inicio.
require_once __DIR__ . '/../../conf/_Permissions.php';
$permissions = Permissions::page('configuracion-accesos');

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/coffeeSoft.js'); ?>"></script>
<!-- Las copias locales, las mismas de almacén: dataPicker, simple_data_table y alert(). -->
<script src="../../src/js/plugins.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/plugins.js'); ?>"></script>
<script src="../../src/js/complementos.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/complementos.js'); ?>"></script>
<link rel="stylesheet" href="../../src/css/dark-mode.css?v=<?php echo filemtime(__DIR__ . '/../../src/css/dark-mode.css'); ?>">

<!-- Forzar modales (bootbox) en light theme aunque el body este en dark-mode -->
<style>
    body.dark-mode .modal-content,
    body.dark-mode .bootbox .modal-content,
    body.dark-mode .modal-header,
    body.dark-mode .modal-footer,
    body.dark-mode .bootbox .modal-header,
    body.dark-mode .bootbox .modal-footer {
        background-color: #ffffff !important;
        color: #111827 !important;
        border-color: #e5e7eb !important;
    }
    body.dark-mode .modal-title,
    body.dark-mode .bootbox .modal-title,
    body.dark-mode .modal label {
        color: #111827 !important;
    }
    body.dark-mode .modal input,
    body.dark-mode .modal select,
    body.dark-mode .modal textarea,
    body.dark-mode .modal .form-control {
        background-color: #ffffff !important;
        color: #111827 !important;
        border-color: #d1d5db !important;
    }
    body.dark-mode .modal .form-control::placeholder {
        color: #9ca3af !important;
    }
    body.dark-mode .modal .btn-primary {
        background-color: #C05A40 !important;
        border-color: #C05A40 !important;
        color: #ffffff !important;
    }
    body.dark-mode .modal .btn-danger {
        background-color: #dc3545 !important;
        border-color: #dc3545 !important;
        color: #ffffff !important;
    }
</style>

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

    <!-- Navegación de Configuración y lista de roles (csNavList) y la matriz de permisos del rol -->
    <script src="../../src/js/components/cs-grouped-list.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/components/cs-grouped-list.js'); ?>"></script>
    <script src="../../src/js/components/cs-permission-matrix.js?v=<?php echo filemtime(__DIR__ . '/../../src/js/components/cs-permission-matrix.js'); ?>"></script>

    <!-- Módulo de Configuración: resumen, usuarios, roles, sucursales y bitácora -->
    <!-- Acciones del rol en Accesos: el módulo solo pinta los botones que puede usar -->
    <?php echo Permissions::script($permissions); ?>
    <script src="js/accesos.js?t=<?php echo time(); ?>"></script>
</body>
</html>
