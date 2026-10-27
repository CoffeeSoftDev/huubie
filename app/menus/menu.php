<?php
    require_once("../conf/_Rutes.php");

    if ($_SESSION['ROL'] !== 1) {
        header('Location: /app/ventas/');
        exit();
    }
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Alpha</title>

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
    <script src="/app/menus/src/js/navbar.js"></script>
    <script src="/app/menus/src/js/sidebar.js"></script>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer"
        class="w-full h-[calc(100vh-3rem)] bg-[#111928] mt-5 pt-5 transition-all duration-500 text-white p-6 flex flex-col md:flex-row gap-x-4">
        <div id="grid-card" class="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div>
    </div>

    <script src="/app/src/plugins/daterangepicker/moment.min.js"></script>
    <script src="/app/src/plugins/daterangepicker/daterangepicker.js"></script>

    <script src="/app/menus/src/js/cards.js?t=<?php echo time(); ?>"></script>
    <script src="/app/menus/src/js/menu.js?t=<?php echo time(); ?>"></script>
</body>

</html>
