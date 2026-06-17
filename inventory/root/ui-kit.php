<?php
session_start();

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once('../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');
?>

<!-- CoffeeSoft Framework (el navbar usa useFetch) -->
<script src="../src/js/coffeeSoft.js"></script>
<link rel="stylesheet" href="../src/css/dark-mode.css">

<style>
    /* La sección se embebe a todo el alto del área de contenido (sin su propio
       navbar/sidebar, que se ocultan vía ?embed=1). */
    main > #main__content { padding: 0; }
    #rootSectionFrame { width: 100%; flex: 1; min-height: 0; border: 0; display: block; }
</style>

<body>
    <!-- El sidebar resuelve el módulo por la URL (/inventory/root/...) y muestra
         las secciones de "root" (Tenant, UI Kit). -->
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <main>
        <div id="menu-navbar"></div>
        <div id="main__content">
            <iframe id="rootSectionFrame" src="../operacion/almacen/ui-kit.php?embed=1" title="UI Kit"></iframe>
        </div>
    </main>

    <!-- Navbar y sidebar del módulo root -->
    <script src="../acceso/src/js/navbar.js"></script>
    <script src="../acceso/src/js/sidebar.js"></script>
</body>
</html>
