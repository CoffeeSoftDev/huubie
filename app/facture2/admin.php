<?php require_once(__DIR__ . "/conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Huubie · Terminal Wansoft — Administración</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/layout/wansoft-libraries.php'); ?>

    <!-- El scroll vive dentro de #mainContainer (body overflow-hidden), por lo que el
         gutter global de head.php solo dejaria una franja muerta a la derecha. -->
    <style>
        html { scrollbar-gutter: auto; }
        body { font-family: "Inter", system-ui, sans-serif; }
    </style>
</head>

<!-- En el menu de administracion el rotulo de usuario cede su lugar al nombre de la
     seccion, que es justo lo que hace data-modulo. Sin data-back: el regreso es el
     boton del pie, y va a la pantalla de la que se vino. -->
<body class="h-screen flex flex-col overflow-hidden ws-app" data-bs-theme="light">
    <div id="menu-navbar" data-modulo="Administración"></div>

    <div id="mainContainer" class="flex-1 w-full overflow-hidden flex flex-col min-h-0 ws-app">
        <div class="flex-1 flex flex-col min-h-0" id="root"></div>
    </div>

    <!-- Banda superior propia de la terminal (sin fetch) -->
    <script src="/app/facture2/src/js/navbar-wansoft.js?t=<?php echo time(); ?>"></script>

    <!-- Componentes del modulo -->
    <script src="/app/facture2/src/js/components/moduleCard.js?t=<?php echo time(); ?>"></script>

    <!-- Salidas comunes de la terminal -->
    <script src="/app/facture2/src/js/pos-shell.js?t=<?php echo time(); ?>"></script>

    <!-- Menu de administracion -->
    <script src="/app/facture2/src/js/admin.js?t=<?php echo time(); ?>"></script>
</body>

</html>
