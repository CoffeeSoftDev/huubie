<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="<?=PATH_BASE?>src/img/logo/logo.ico" />
    <title>RRHH - Huubie</title>

    <script src="https://cdn.tailwindcss.com"></script>

    <!-- CSS -->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/buttons.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/colors.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2.min.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css" />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

    <!-- JS -->
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/moment.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/bootbox.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/moment.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/datatables.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

    <!-- CoffeeSoft Framework -->
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- Session / Nav -->
    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>
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
    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white mt-12 p-3 overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto" id="root"></div>
    </div>

    <!-- RRHH Module -->
    <script src="<?=PATH_RRHH?>src/js/rrhh.js?t=<?php echo time(); ?>"></script>
</body>

</html>
