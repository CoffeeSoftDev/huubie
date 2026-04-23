<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/coffee/src/img/logo/logo.ico" />
    <title>Admin</title>

    <script src="https://cdn.tailwindcss.com"></script>

    <link rel="stylesheet" href="/coffee/src/plugins/fontello/css/fontello.css" />

    <link rel="stylesheet" href="/coffee/src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="/coffee/src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <script src="/coffee/src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="/coffee/src/plugins/bootbox.min.js"></script>
    <script src="/coffee/src/js/complementos.js"></script>
    <script src="/coffee/src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="/coffee/src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

    <link rel="stylesheet" href="/coffee/src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css" />
    <script src="/coffee/src/plugins/datatables/datatables.min.js"></script>
    <script src="/coffee/src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="/coffee/src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <link rel="stylesheet" href="/coffee/src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="/coffee/src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="/coffee/src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="/coffee/access/src/js/session.js"></script>
    <script src="/coffee/src/js/navbar.js"></script>
    <script src="/coffee/src/js/sidebar.js"></script>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div class="h-full">
        <div class="w-full overflow-x-auto " id="root"></div>
    </div>

    <script src="/coffee/src/plugins/daterangepicker/moment.min.js"></script>
    <script src="/coffee/src/plugins/daterangepicker/daterangepicker.js"></script>

    <script src="/coffee/admin/src/js/app.js?t=<?php echo time(); ?>"></script>
</body>
</html>
