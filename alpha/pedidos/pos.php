<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>POS - Punto de Venta</title>

    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#111827">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/buttons.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/colors.css" />

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/moment.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/bootbox.min.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <script src="<?=PATH_BASE?>src/plugins/datatables/datatables.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/moment.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.js"></script>

    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>

    <style>
        ::-webkit-scrollbar { width: 0px !important; background: transparent !important; }
        * { scrollbar-width: none !important; }
        @media print {
            .no-print { display: none !important; }
            .bootbox-close-button, .modal-header .close { display: none !important; }
            #ticketVenta, #ticketComanda { box-shadow: none !important; border: none !important; }
        }
    </style>
</head>

<body class="bg-[#111928] text-white overflow-hidden" data-bs-theme="dark">
    <div id="root"></div>

    <script src="<?=PATH_PEDIDOS?>src/js/tickets.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_PEDIDOS?>src/js/pos.js?t=<?php echo time(); ?>"></script>
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    </script>
</body>
</html>
