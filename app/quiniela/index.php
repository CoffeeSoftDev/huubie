<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Quiniela IA · Mundial 2026</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto" id="root"></div>
    </div>

    <!-- Modulo Scripts -->
    <script src="src/js/quiniela.js?t=<?php echo time(); ?>"></script>
</body>

</html>
