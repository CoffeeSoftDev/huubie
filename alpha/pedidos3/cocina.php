<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>Panel de Cocina (KDS)</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/buttons.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/colors.css" />

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/moment.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/bootbox.min.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>

    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>

    <style>
        ::-webkit-scrollbar { width: 0px !important; background: transparent !important; }
        * { scrollbar-width: none !important; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .animate-pulse { animation: pulse 2s infinite; }
    </style>
</head>

<body class="bg-[#111928] text-white overflow-hidden" data-bs-theme="dark">
    <div id="root"></div>

    <script src="<?=PATH_PEDIDOS?>src/js/cocina.js?t=<?php echo time(); ?>"></script>
</body>
</html>
