<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Alpha</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">

    <!-- Modulo: dependencias especificas de admin -->
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">
    <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.0.0/animate.compat.css" />
    <script src='https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js'></script>

    <link rel="stylesheet" href="/app/src/plugins/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="/app/src/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css">
    <script src="/app/src/plugins/select2/bootstrap/select2.min.js"></script>

    <!-- Modulo: estilos especificos de admin -->
    <link rel="stylesheet" href="/app/pedidos/src/css/admin.css?t=<?php echo time(); ?>">
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

   <div id="mainContainer" class="w-full h-full transition-all duration-500 bg-[#111928] text-white mt-16">
        <div class="bg-[#111928] " id="root"></div>
    </div>

    <!-- Modulo Scripts -->
    <script src="/app/pedidos/src/js/admin.js?t=<?php echo time(); ?>"></script>
</body>

</html>
