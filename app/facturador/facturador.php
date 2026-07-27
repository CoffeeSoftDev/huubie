<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/app/src/img/logo/logo.ico" />
    <title>Facturador SAT</title>

    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/app/facturador/src/css/facturador.css?t=<?php echo time(); ?>" />
    <script src="/app/facturador/src/js/facturador-theme.js?t=<?php echo time(); ?>"></script>
</head>

<body class="bg-ink-100 text-ink-900" data-bs-theme="light">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div id="mainContainer" class="w-full h-full transition-all duration-500 bg-ink-100 text-ink-900 ">
        <div class="bg-ink-100" id="root"></div>
    </div>

    <script src="/app/src/js/components/moduleCard.js?t=<?php echo time(); ?>"></script>
    <script src="/app/facturador/src/js/sample_facturador.js?t=<?php echo time(); ?>"></script>
    <script src="/app/facturador/src/js/facturador.js?t=<?php echo time(); ?>"></script>
</body>

</html>
