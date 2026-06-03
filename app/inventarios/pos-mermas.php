<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>POS — Visor de Mermas</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full h-full transition-all duration-500 bg-[#111928] text-white">
        <div class="bg-[#111928]" id="root"></div>
    </div>

    <script src="/app/inventarios/src/js/components/merma-form.js?t=<?php echo time(); ?>"></script>
    <script src="/app/inventarios/src/js/pos-mermas.js?t=<?php echo time(); ?>"></script>
</body>

</html>
