<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Alpha</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

    <!-- JQUERY UI (autocomplete) -->
    <link rel="stylesheet" href="/app/src/plugins/jquery/jquery-ui.css" />
    <script src="/app/src/plugins/jquery/jquery-ui.js"></script>

    <!-- MOMENT -->
    <script src="/app/src/plugins/moment.js"></script>

    <!-- ANIMATE -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.0.0/animate.compat.css" />

    <!-- FULLCALENDAR + RRULE -->
    <script src="https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/moment@6.1.14/index.global.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.14/index.global.min.js"></script>

    <!-- CHART.JS -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- SELECT2 -->
    <link rel="stylesheet" href="/app/src/plugins/select2/bootstrap/select2.min.css" />
    <link rel="stylesheet" href="/app/src/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css" />
    <script src="/app/src/plugins/select2/bootstrap/select2.min.js"></script>

    <style>
        @media print {
            .no-print { display: none !important; }
            .bootbox-close-button,
            .modal-header .close { display: none !important; }
            #ticketPasteleria {
                box-shadow: none !important;
                border: none !important;
            }
        }

        ::-webkit-scrollbar {
            width: 0px !important;
            background: transparent !important;
        }

        * { scrollbar-width: none !important; }
    </style>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white mt-12 p-3 overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto" id="root"></div>
    </div>

    <script src="/app/pedidos/src/js/app.js?t=<?php echo time(); ?>"></script>
    <script src="/app/pedidos/src/js/pedidos-catalogo.js?t=<?php echo time(); ?>"></script>
    <script src="/app/pedidos/src/js/pedidos-personalizado.js?t=<?php echo time(); ?>"></script>
    <script src="/app/pedidos/src/js/order-reports.js?t=<?php echo time(); ?>"></script>
    <script src="/app/pedidos/src/js/dashboard-pedidos.js?t=<?php echo time(); ?>"></script>
    <script src="/app/pedidos/src/js/pedidos-cierre.js?t=<?php echo time(); ?>"></script>
</body>

</html>
