<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>Visor de Cierre</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/buttons.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/colors.css" />

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/moment.js"></script>

    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/moment.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.js"></script>

    <script src="<?=PATH_ACCESS?>src/js/session.js"></script>
    <!--
        El visor ya trae su propio selector de sucursal en el filterBar, asi que se oculta
        el de la navbar para no tener dos controles compitiendo. La navbar lo respeta via
        `showSubsidiary: !window.HIDE_SUBSIDIARY_SWITCH` (menus/src/js/navbar.js).
        Debe declararse ANTES de cargar navbar.js.
    -->
    <script>window.HIDE_SUBSIDIARY_SWITCH = true;</script>
    <script src="<?=PATH_MENU?>src/js/navbar.js"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js"></script>

    <style>
        ::-webkit-scrollbar { width: 0px !important; background: transparent !important; }
        * { scrollbar-width: none !important; }
    </style>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>
    <div id="mainContainer" class="w-full flex flex-col text-white mt-12 p-3 overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full" id="root"></div>
    </div>

    <!--
        El visor NO reimplementa el formato de los reportes: reutiliza las dos fuentes
        unicas que ya viven en alpha/pedidos.
          - shift-ticket.js   -> renderShiftTicket()  (Cierre x Turno / Corte X)
          - pedidos-cierre.js -> Cierre.renderExecutiveSummary() (Corte Z) + printDaily()
        Por eso se cargan desde PATH_PEDIDOS y no se duplican aqui.
    -->
    <script src="<?=PATH_PEDIDOS?>src/js/lucide-icons.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/shift-ticket.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pedidos-cierre.js?t=<?php echo time(); ?>"></script>

    <script src="src/js/order-visor.js?t=<?php echo time(); ?>"></script>
</body>
</html>
