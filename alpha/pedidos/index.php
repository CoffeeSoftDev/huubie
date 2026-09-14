<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>Alpha</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Fuente del ticket: monoespaciada con peso 600 real (semibold) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
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
    <script src="<?=PATH_BASE?>src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

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
    <script src="<?=PATH_PEDIDOS?>src/js/navbar.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js?t=<?php echo time(); ?>"></script>

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

        /* Filter bar: alinear inputs (con label) y botones (sin label) por su base
           y colapsar el <label> vacio que el plugin inyecta en los botones, que
           dejaba un hueco superior sobre ellos. */
        #filterBarPedidos .row {
            align-items: flex-end;
        }

        #filterBarPedidos label:empty {
            display: none;
        }

        /* Mismo <label> vacio del plugin: en Gestión de Pagos sobre la tarjeta del monto
           restante y el boton de guardar (abria un hueco bajo las pestañas), y en el
           formulario de datos de entrega sobre sus botones. */
        #modalAdvance label:empty,
        #formEditDelivery label:empty {
            display: none;
        }

        /* Dialogos abiertos DESDE el modal propio del framework (createCoffeeModalForm),
           que monta su overlay en z-index 100000: SweetAlert vive en 1060 y alertBox en
           10001, asi que la confirmacion de pago quedaba por debajo y no se veia. */
        .swal2-container {
            z-index: 100010 !important;
        }

        .z-\[10001\] {
            z-index: 100005 !important;
        }

        /* Gestion de Pagos se dibuja al 75%. Los dialogos que abre por encima salen a
           tamano completo y quedan mas grandes que el propio modal, asi que se escalan
           igual mientras ese modal (#modalAdvance) este abierto. Se ata a su id y no a
           .cf-overlay porque el detalle del pedido tambien usa el modal propio y va a
           tamano normal. Si el navegador no soporta :has(), la regla se ignora y el
           dialogo sigue funcionando. */
        body:has(#modalAdvance) .swal2-popup,
        body:has(#modalAdvance) [id^="alertBox_"] .tf-alert-card {
            zoom: 0.75;
        }

        /* La tabla de pedidos se busca desde el filterBar (folio o cliente, en todas las
           fechas). El "Buscar:" de DataTables solo filtra lo que ya cargo la tabla y
           competia con el, asi que se oculta. La paginacion y "Mostrar N" siguen igual. */
        #tbPedidos_filter {
            display: none;
        }

        /* Aire entre la fila de "Mostrar N registros" (con el buscador encima) y la tabla. */
        #tbPedidos_length {
            margin-bottom: 10px;
        }

        /* Buscador de pedidos: vive fuera de la tabla (createTable la reescribe en cada
           busqueda) y se superpone a la derecha de la fila de "Mostrar N registros", en el
           lugar del "Buscar:" oculto. Mismo fondo y borde que los inputs de CoffeeSoft
           (bg-[#1F2A37], border-slate-700). En celular se apila arriba de la tabla. */
        #searchBarPedidos {
            position: relative;
        }

        #searchBarFormPedidos {
            position: absolute;
            top: 0;
            right: 0;
            z-index: 2;
            width: min(260px, 50%);
            margin: 0;
        }

        #searchBarFormPedidos > div {
            width: 100%;
            margin: 0 !important;
            padding: 0;
        }

        #searchBarFormPedidos label:empty {
            display: none;
        }

        #searchBarFormPedidos .input-group {
            flex-wrap: nowrap;
            align-items: center;
            background: #1F2A37;
            border: 1px solid #334155;
            border-radius: 6px;
            transition: border-color .15s ease, box-shadow .15s ease;
        }

        #searchBarFormPedidos .input-group:focus-within,
        #searchBarFormPedidos .input-group.is-searching {
            border-color: #3F83F8;
            box-shadow: 0 0 0 2px rgba(63, 131, 248, .18);
        }

        #searchBarFormPedidos .input-group-text {
            order: -1;
            background: transparent;
            border: 0;
            border-radius: 0;
            color: #9CA3AF;
            font-size: 12px;
            padding: 0 0 0 10px;
        }

        #searchBarFormPedidos .form-control {
            height: 28px;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            color: #F3F4F6;
            font-size: 12px;
            padding: 0 6px;
        }

        #searchBarFormPedidos .form-control::placeholder {
            color: #6B7280;
        }

        .search-scope {
            flex-shrink: 0;
            margin-right: 4px;
            padding: 1px 6px;
            border-radius: 999px;
            background: rgba(28, 100, 242, .16);
            color: #93C5FD;
            font-size: 10px;
            white-space: nowrap;
        }

        .search-clear {
            flex-shrink: 0;
            width: 20px;
            height: 20px;
            margin-right: 4px;
            border: 0;
            border-radius: 4px;
            background: transparent;
            color: #9CA3AF;
            font-size: 11px;
            line-height: 1;
        }

        .search-clear:hover {
            background: #111928;
            color: #F3F4F6;
        }

        @media (max-width: 767.98px) {
            #searchBarFormPedidos {
                position: static;
                width: 100%;
                margin-bottom: 10px;
            }
        }

        @media (max-width: 480px) {
            .search-scope {
                display: none;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            #searchBarFormPedidos .input-group {
                transition: none;
            }
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
        class="w-full min-h-screen flex flex-col text-white mt-16 p-3  overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto " id="root"></div>
    </div>


    <!-- Init -->
    <script src="<?=PATH_PEDIDOS?>src/js/lucide-icons.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/shift-ticket.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/app.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-catalogo.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-personalizado.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/order-reports.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/dashboard-pedidos.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-cierre.js?t=<?php echo time(); ?>"></script>

    <!-- TEMPORAL: timer que fuerza reinicio de sesión una vez (retirar cuando ya no se necesite) -->
    <script src="<?=PATH_PEDIDOS?>src/js/session-reset-timer.js?t=<?php echo time(); ?>"></script>

</body>
</html>