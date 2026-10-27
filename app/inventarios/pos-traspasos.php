<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>POS — Visor de Traspasos</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

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

    <script src="/app/inventarios/src/js/sample_traspasos.js?t=<?php echo time(); ?>"></script>
    <script src="/app/inventarios/src/js/components/traspaso-form.js?t=<?php echo time(); ?>"></script>
    <script src="/app/inventarios/src/js/pos-traspasos.js?t=<?php echo time(); ?>"></script>
</body>

</html>
