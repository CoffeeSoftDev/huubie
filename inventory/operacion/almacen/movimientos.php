<?php
session_start();

// Validar sesión de usuario
if (empty($_COOKIE["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js"></script>
<script src="https://rawcdn.githack.com/SomxS/Grupo-Varoch/refs/heads/main/src/js/plugins.js"></script>
<script src="https://www.plugins.erp-varoch.com/ERP/JS/complementos.js"></script>

<body>
    <?php require_once('../../layout/navbar.php'); ?>

    <main>
        <section id="sidebar"></section>

        <div id="main__content">
            <!-- Breadcrumb Navigation -->
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb">
                    <li class="breadcrumb-item text-uppercase text-muted">Operación</li>
                    <li class="breadcrumb-item fw-bold active">Movimientos de Inventario</li>
                </ol>
            </nav>

            <!-- Main Container -->
            <div class="main-container" id="root"></div>

            <!-- Módulo de Movimientos -->
            <script src="js/movimientos.js?t=<?php echo time(); ?>"></script>
        </div>
    </main>
</body>
</html>
