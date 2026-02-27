<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../../src/img/logo/logo.ico" />
    <title>Calendario de Pedidos</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <!-- icons -->
    <link rel="stylesheet" href="../../src/plugins/fontello/css/fontello.css" />
    <!-- <link rel="stylesheet" href="src/css/calendario.css" /> -->

    <link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">

    <link rel="stylesheet" href="../../src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="../../src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <!--BOOTBOX-->
    <script src="../../src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="../../src/plugins/moment.js"></script>


   <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>

    <script src="../../src/plugins/bootbox.min.js"></script>
    <script src="../../src/js/complementos.js"></script>
    <script src="../../src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="../../src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>
    
        <!-- datarange picker -->
    <link rel="stylesheet" href="../../src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="../../src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="../../src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <!-- rrule lib -->
    <script src='https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js'></script>
    <!-- FULL CALENDAR -->
    <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js'></script>
    <!-- FULL CALENDAR LOCALE -->
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/moment@6.1.14/index.global.min.js'></script>
    <!-- the rrule-to-fullcalendar connector. must go AFTER the rrule lib -->
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.14/index.global.min.js'></script>

</head>

<body data-bs-theme="dark">
    <?php
        session_start();
        require_once("../../layout/navbar.php");
        require_once("../../layout/sidebar.php");
    ?>
    <div id="mainContainer2"
        class="w-full h-[calc(100vh)] transition-all duration-500 bg-[#111928] text-white ">
        <div style="background-color:#111827;" id="root">

        </div>
    </div>

    <!-- Init -->
    <script src="src/js/app-calendario.js?t=<?php echo time(); ?>"></script>
    <script src="src/js/calendario-pedidos.js?t=<?php echo time(); ?>"></script>


</body>

</html>
