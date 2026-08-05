<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="<?=PATH_BASE?>src/img/logo/logo.ico" />
    <title>Alpha</title>
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/animation.css">
    
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />

    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js"></script>
    <script src="<?=PATH_BASE?>src/js/coffeeSoft.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
</head>

<body class="bg-[#111928]">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>
    <!-- ModuleCard renderiza aqui su propio wrapper (saludo + buscador + grid),
         por eso ya no existe el #grid-card ni el layout flex de antes. -->
    <div id="mainContainer"
        class="w-full h-[calc(100vh-4rem)] bg-[#111928] mt-16 transition-all duration-500 text-white p-6"></div>
    <script src="<?= PATH_BASE ?>access/src/js/session.js?t=<?= time(); ?>"></script>
    <!--
        Misma navbar que el visor de cierre (/alpha/order-visor/): mide 64px, de ahi
        el mt-16 del mainContainer. Ella misma corrige el offset del sidebar
        compartido, que viene calculado para la navbar vieja de 48px.
        Hub de menus: la navbar no debe mostrar el selector de sucursal; lo respeta
        via `showSubsidiary: !window.HIDE_SUBSIDIARY_SWITCH`, por eso el flag va antes.
    -->
    <script>window.HIDE_SUBSIDIARY_SWITCH = true;</script>
    <script src="<?=PATH_PEDIDOS?>src/js/navbar.js?t=<?= time() ?>"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js"></script>

    <!-- Coffee Component (mismo patron que app/menus) -->
    <script src="<?=PATH_BASE?>src/js/components/moduleCard.js?t=<?= time() ?>"></script>

    <script src="<?=PATH_MENU?>src/js/ventas.js?t=<?= time() ?>"></script>
</body>
<script>

</script>

</html>