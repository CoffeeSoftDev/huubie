<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<!-- Configuración de WhatsApp en página propia: el Admin del servidor sigue en el núcleo
     viejo (coffeSoft.js) y no puede alojar la pestaña, que necesita coffeeSoft.js. -->

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="<?=PATH_BASE?>src/img/logo/logo.ico" />
    <title>WhatsApp · Alpha</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/bootbox.min.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- datatables: el Historial pagina con simple_data_table -->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <script src="<?=PATH_BASE?>src/plugins/datatables/datatables.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <script src="<?=PATH_ADMIN?>src/js/lucide-icons.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>
    <!-- Vista global de la empresa: la navbar no muestra el selector de sucursal. -->
    <script>window.HIDE_SUBSIDIARY_SWITCH = true;</script>
    <script src="<?=PATH_PEDIDOS?>src/js/navbar.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js?t=<?php echo time(); ?>"></script>
</head>

<body class="bg-[#111928] h-screen" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <div class="h-full">
        <div class="h-full p-3" id="root">
            <div class="w-full bg-[#1F2A37] rounded-lg p-3 min-h-screen">
                <h2 class="text-2xl font-semibold text-white px-4 pt-3">💬 WhatsApp de <?= htmlspecialchars($_SESSION['COMPANY'] ?? '') ?></h2>
                <p class="text-gray-400 px-4 pb-3">Avisos automáticos de cierre del día, cierre de turno y pedidos.</p>
                <div id="container-tab-whatsapp" class="w-full p-3"></div>
            </div>
        </div>
    </div>

    <script src="<?=PATH_ADMIN?>src/js/whatsapp.js?t=<?php echo time(); ?>"></script>
    <script>
        // whatsapp.js usa estos globales: nameCompany en la vista previa y en el mensaje
        // de prueba; `whatsapp` en sus onchange/onkeyup escritos como texto.
        let nameCompany = <?= json_encode($_SESSION['COMPANY'] ?? '') ?>;
        let whatsapp;

        $(function () {
            whatsapp = new WhatsApp('<?=PATH_ADMIN?>ctrl/ctrl-wa-config.php', 'root');
            whatsapp.render();
        });
    </script>
</body>
</html>
