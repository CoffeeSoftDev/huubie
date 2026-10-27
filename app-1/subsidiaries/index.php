<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Sucursales</title>

    <script src="https://cdn.tailwindcss.com"></script>

    <link rel="stylesheet" href="/app/src/plugins/fontello/css/fontello.css" />

    <link rel="stylesheet" href="/app/src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="/app/src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <script src="/app/src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="/app/src/plugins/bootbox.min.js"></script>
    <script src="/app/src/js/complementos.js"></script>
    <script src="/app/src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="/app/src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

    <link rel="stylesheet" href="/app/src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css" />
    <script src="/app/src/plugins/datatables/datatables.min.js"></script>
    <script src="/app/src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="/app/src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <link rel="stylesheet" href="/app/src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="/app/src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="/app/src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="/app/access/src/js/session.js"></script>
    <script src="/app/src/js/navbar.js"></script>
    <script src="/app/src/js/sidebar.js"></script>
</head>

<body class="bg-[#111928] h-screen flex flex-col overflow-hidden" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <main class="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <div class="w-full flex-1" id="root"></div>
    </main>

    <script src="/app/src/plugins/daterangepicker/moment.min.js"></script>
    <script src="/app/src/plugins/daterangepicker/daterangepicker.js"></script>

    <script src="/app/subsidiaries/src/js/app.js?t=<?php echo time(); ?>"></script>
</body>

</html>
