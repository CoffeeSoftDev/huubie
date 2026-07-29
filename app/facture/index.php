<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Huubie · Facturador SAT</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>

    <?php require_once(__DIR__ . '/layout/huubie-libraries.php'); ?>

    <!-- El hub no abre modales bootbox/Bootstrap, asi que no necesita el gutter
         reservado de head.php. Se desactiva localmente para quitar la franja derecha. -->
    <style>
        html { scrollbar-gutter: auto !important; }
    </style>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>

    <!-- max-w-7xl + mx-auto: el contenedor se reduce y centra el grid en pantallas anchas. -->
    <div id="mainContainer"
        class="w-full max-w-7xl mx-auto h-[calc(100vh-3rem)] bg-[#111928] pt-5 transition-all duration-500 text-white p-6"></div>

    <!-- Navbar propio del Facturador (sin fetch). El hub no lleva sidebar: las
         tarjetas ya son la navegacion. -->
    <script src="/app/facture/src/js/navbar-huubie.js?t=<?php echo time(); ?>"></script>

    <!-- Coffee Component -->
    <script src="/app/src/js/components/moduleCard.js?t=<?php echo time(); ?>"></script>

    <!-- Modulo Scripts -->
    <script src="/app/facture/src/js/sample_facture.js?t=<?php echo time(); ?>"></script>
    <script src="/app/facture/src/js/facture.js?t=<?php echo time(); ?>"></script>
</body>

</html>
