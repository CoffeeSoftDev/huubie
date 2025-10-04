<?php require_once("../conf/_Rutes.php"); ?>

<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="<?=PATH_BASE?>src/img/logo/logo.ico" />
    <title>Alpha</title>
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css">
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/animation.css">
    
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />

    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js"></script>
    <script src="<?=PATH_BASE?>src/js/coffeSoft.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
</head>

<body class="bg-[#111928]">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>
    <div id="mainContainer"
        class="w-full h-[calc(100vh-3rem)]  bg-[#111928] mt-5 pt-5 transition-all duration-500  text-white p-6 flex flex-col md:flex-row gap-x-4">
        <div id="grid-card" class="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"></div>
    </div>
    <script src="<?= PATH_BASE ?>access/src/js/session.js?t=<?= time(); ?>"></script>
    <script src="<?=PATH_MENU?>src/js/navbar.js"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js"></script>
    <script src="<?=PATH_MENU?>src/js/cards.js?t=<?= time() ?>"></script>
    <script src="<?=PATH_MENU?>src/js/configuracion.js?t=<?= time() ?>"></script>
</body>
<script>

</script>

</html>