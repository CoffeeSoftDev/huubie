<?php require_once(__DIR__ . "/conf/_Rutes.php"); wansoftExige(); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/png" href="/app/wansoft/src/img/logo.png" />
    <title>Wansoft — Menú</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/layout/wansoft-libraries.php'); ?>

    <!-- El scroll vive dentro de #mainContainer (body overflow-hidden), por lo que el
         gutter global de head.php solo dejaria una franja muerta a la derecha. -->
    <style>
        html { scrollbar-gutter: auto; }
        body { font-family: "Inter", system-ui, sans-serif; }
    </style>
</head>

<!-- Sin data-back: del menu principal no se regresa, se bloquea o se sale, y esas
     dos salidas ya viven en el pie de la rejilla. -->
<body class="h-screen flex flex-col overflow-hidden ws-app" data-bs-theme="light">
    <div id="menu-navbar"></div>

    <div id="mainContainer" class="flex-1 w-full overflow-hidden flex flex-col min-h-0 ws-app">
        <div class="flex-1 flex flex-col min-h-0" id="root"></div>
    </div>

    <!-- Banda superior propia de la terminal (pide el usuario a la base) -->
    <script src="/app/wansoft/src/js/navbar-wansoft.js?t=<?php echo time(); ?>"></script>

    <!-- Componentes del modulo -->
    <script src="/app/wansoft/src/js/components/moduleCard.js?t=<?php echo time(); ?>"></script>

    <!-- Salidas comunes de la terminal -->
    <script src="/app/wansoft/src/js/pos-shell.js?t=<?php echo time(); ?>"></script>

    <!-- Menu principal -->
    <script src="/app/wansoft/src/js/inicio.js?t=<?php echo time(); ?>"></script>
</body>

</html>
