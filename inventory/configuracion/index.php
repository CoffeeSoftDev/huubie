<?php
session_start();

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once('../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');

// Modo embebido: cuando se carga dentro del iframe de /configuracion se ocultan
// navbar/sidebar/breadcrumb para mostrar solo el contenido del módulo.
$embed = isset($_GET['embed']);
?>

<!-- CoffeeSoft Framework -->
<script src="../src/js/coffeeSoft.js"></script>
<script src="../src/js/complementos.js"></script>
<script src="../src/js/plugin-form.js"></script>

<link rel="stylesheet" href="../src/css/dark-mode.css">

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

<?php if ($embed): ?>
<style>
    /* Embebido en /configuracion: sin navbar ni sidebar, a todo lo ancho. */
    body.embed-mode { padding-left: 0 !important; padding-top: 0 !important; }
    body.embed-mode main > #main__content { padding: 12px !important; }
</style>
<?php endif; ?>

<body class="<?php echo $embed ? 'embed-mode' : ''; ?>">
    <?php if (!$embed): ?>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <?php endif; ?>
    <main>
        <?php if (!$embed): ?>
        <div id="menu-navbar"></div>
        <?php endif; ?>

        <div id="main__content">
            <?php if (!$embed): ?>
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Administración</li>
                    <li class="breadcrumb-item fw-bold active">Accesos</li>
                </ol>
            </nav>
            <?php endif; ?>

            <!-- Contenedor principal -->
            <div class="" id="root"></div>
        </div>
    </main>

    <?php if (!$embed): ?>
    <!-- Importación navbar y sidebar -->
    <script src="../acceso/src/js/navbar.js"></script>
    <!-- <script src="../acceso/src/js/sidebar.js"></script> -->
    <?php endif; ?>

    <!-- Módulo de Accesos -->
    <script src="js/accesos.js?t=<?php echo time(); ?>"></script>
</body>
</html>
