<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>POS - Inventario</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer"
        class="w-full h-[calc(100vh-3rem)] bg-[#111928] pt-5 transition-all duration-500 text-white p-6"></div>

    <!-- Coffee Component -->
    <script src="/app/src/js/components/moduleCard.js?t=<?php echo time(); ?>"></script>

    <!-- Modulo Scripts -->
    <script src="/app/pos-fake/src/js/menu-hub.js?t=<?php echo time(); ?>"></script>

</body>

</html>
