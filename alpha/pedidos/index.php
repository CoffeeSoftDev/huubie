<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>Alpha</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <!-- icons -->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="<?=PATH_EVENTOS?>src/css/style.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/buttons.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/colors.css" />

    <link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">


    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <!--BOOTBOX-->
    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/moment.js"></script>

    <!-- autocomplete -->
    <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/bootbox.min.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- datables -->
    <link rel="stylesheet" href="https://15-92.com/ERP3/src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">

    <!-- datatables -->
    <script src="<?=PATH_BASE?>src/plugins/datatables/datatables.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <!-- -->

 
    <!-- datarange picker -->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>


    <!--ANIMATE-->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.0.0/animate.compat.css"/>
    <!-- rrule lib -->
    <script src='https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js'></script>
    <!-- FULL CALENDAR -->
    <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js'></script>
    <!-- FULL CALENDAR LOCALE -->
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/moment@6.1.14/index.global.min.js'></script>
    <!-- the rrule-to-fullcalendar connector. must go AFTER the rrule lib -->
    <script src='https://cdn.jsdelivr.net/npm/@fullcalendar/rrule@6.1.14/index.global.min.js'></script>


    <!-- Data range picker -->
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/moment.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.js"></script>

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

        <!--SELECT2-->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css">
    <!--SELECT2-->
    <script src="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2.min.js"></script>
    <!-- PRINCIPAL -->
    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>
    <script src="<?=PATH_MENU?>src/js/navbar.js"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js"></script>

    <!-- Estilos para impresión -->
    <style>
        @media print {
            .no-print {
                display: none !important;
            }
            
            /* Ocultar elementos del modal al imprimir */
            .bootbox-close-button,
            .modal-header .close {
                display: none !important;
            }
            
            /* Ajustar el contenedor del ticket */
            #ticketPasteleria {
                box-shadow: none !important;
                border: none !important;
            }
        }


        /* Ocultar scrollbar en toda la aplicación */
        ::-webkit-scrollbar {
            width: 0px !important;
            background: transparent !important;
        }

        /* Para Firefox */
        * {
            scrollbar-width: none !important;
        }

        /* Específico para las tablas */
      /*  #tbPedidos_wrapper,
        #tbPedidos_wrapper .dataTables_scrollBody,
        .table-container {
            overflow: hidden !important;
        }*/
    </style>
    

</head>

<body class="bg-[#111928] text-white " data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>
    <div id="mainContainer"
        class="w-full min-h-screen flex flex-col text-white mt-12 p-3  overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto " id="root"></div>
    </div>


    <!-- Init -->
    <script src="<?=PATH_PEDIDOS?>src/js/app.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-catalogo.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-personalizado.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/order-reports.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/dashboard-pedidos.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-cierre.js?t=<?php echo time(); ?>"></script>

    
    
</body>
</html>