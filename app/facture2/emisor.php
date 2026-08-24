<?php require_once(__DIR__ . "/conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Huubie · Terminal Wansoft — Ticket / Emisor</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/layout/wansoft-libraries.php'); ?>

    <!-- CSS del modulo compartido. Se sirve desde facture, no se copia: es el mismo
         archivo que usa el Facturador, y wansoft-theme.css le repinta el azul. -->
    <link rel="stylesheet" href="/app/facture/src/css/facture.css?t=<?php echo time(); ?>">

    <!-- El scroll vive dentro de #mainContainer (body overflow-hidden), por lo que el
         gutter global de head.php solo dejaria una franja muerta a la derecha. -->
    <style>
        html { scrollbar-gutter: auto; }
        body { font-family: "Inter", system-ui, sans-serif; }
    </style>
</head>

<body class="h-screen flex flex-col overflow-hidden ws-app" data-bs-theme="light">
    <!-- La banda se rotula con el modulo y ofrece el regreso al menu. Sin rail: en
         la terminal se navega por el menu de administracion, no por un costado. -->
    <div id="menu-navbar" data-modulo="Ticket / Emisor" data-back="/app/facture2/admin.php"></div>

    <div id="mainContainer" class="flex-1 w-full overflow-hidden flex flex-col min-h-0 ws-app">
        <div class="flex-1 flex flex-col min-h-0" id="root"></div>
    </div>

    <!-- Banda superior propia de la terminal (sin fetch) -->
    <script src="/app/facture2/src/js/navbar-wansoft.js?t=<?php echo time(); ?>"></script>

    <!-- Papel del ticket: compartido con el modulo Tickets del Facturador -->
    <script src="/app/facture2/src/js/components/ticketPaper.js?t=<?php echo time(); ?>"></script>

    <!-- Modulo Ticket / Emisor -->
    <script src="/app/facture2/src/js/emisor.js?t=<?php echo time(); ?>"></script>
</body>

</html>
