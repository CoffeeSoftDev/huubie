<?php require_once(__DIR__ . "/conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Huubie · Facturador SAT — Tickets</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/layout/huubie-libraries.php'); ?>

    <link rel="stylesheet" href="/app/facture/src/css/facture.css?t=<?php echo time(); ?>">

    <!-- El scroll vive dentro de #mainContainer (body overflow-hidden), por lo que el
         gutter global de head.php solo dejaria una franja muerta junto al navbar. -->
    <style>
        html { scrollbar-gutter: auto; }
    </style>
</head>

<body class="bg-[#111928] text-white h-screen flex flex-col overflow-hidden" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="flex-1 w-full transition-all duration-500 bg-[#111928] text-white overflow-hidden flex flex-col min-h-0">
        <div class="bg-[#111928] flex-1 flex flex-col min-h-0" id="root"></div>
    </div>

    <!-- Navbar y sidebar propios del Facturador (sin fetch) -->
    <script src="/app/facture/src/js/navbar-huubie.js?t=<?php echo time(); ?>"></script>
    <script src="/app/facture/src/js/sidebar-huubie.js?t=<?php echo time(); ?>"></script>

    <!-- Papel del ticket: compartido con la vista previa del emisor en Catalogos -->
    <script src="/app/facture/src/js/components/ticketPaper.js?t=<?php echo time(); ?>"></script>

    <!-- Modulo Tickets -->
    <script src="/app/facture/src/js/tickets.js?t=<?php echo time(); ?>"></script>
</body>

</html>
