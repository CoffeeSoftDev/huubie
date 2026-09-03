<?php require_once(__DIR__ . "/conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Huubie · Terminal Wansoft — Reimpresión de Tickets</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/layout/wansoft-libraries.php'); ?>

    <!-- El papel del ticket es el mismo del modulo Tickets: se sirve desde facture,
         no se copia. -->
    <link rel="stylesheet" href="/app/facture/src/css/facture.css?t=<?php echo time(); ?>">

    <!-- El scroll vive dentro de #mainContainer (body overflow-hidden), por lo que el
         gutter global de head.php solo dejaria una franja muerta a la derecha. -->
    <style>
        html { scrollbar-gutter: auto; }
        body { font-family: "Inter", system-ui, sans-serif; }
    </style>
</head>

<body class="h-screen flex flex-col overflow-hidden ws-app" data-bs-theme="light">
    <!-- La banda se rotula con el modulo y ofrece el regreso al menu. -->
    <div id="menu-navbar" data-modulo="Reimpresión de Ticket" data-back="/app/facture2/inicio.php"></div>

    <div id="mainContainer" class="flex-1 w-full overflow-hidden flex flex-col min-h-0 ws-app">
        <div class="flex-1 flex flex-col min-h-0" id="root"></div>
    </div>

    <!-- Banda superior propia de la terminal (sin fetch) -->
    <script src="/app/facture2/src/js/navbar-wansoft.js?t=<?php echo time(); ?>"></script>

    <!-- Teclado numerico tactil -->
    <script src="/app/facture2/src/js/components/keypad.js?t=<?php echo time(); ?>"></script>

    <!-- Papel del ticket: compartido con el modulo Tickets del Facturador -->
    <script src="/app/facture2/src/js/components/ticketPaper.js?t=<?php echo time(); ?>"></script>

    <!-- Salidas comunes de la terminal -->
    <script src="/app/facture2/src/js/pos-shell.js?t=<?php echo time(); ?>"></script>

    <!-- Reimpresion de tickets -->
    <script src="/app/facture2/src/js/reimpresion.js?t=<?php echo time(); ?>"></script>
</body>

</html>
