<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html class="bg-[#111928]" lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="../src/img/logo/logo.ico" />
    <title>Complementos POS</title>

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

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <script src="<?=PATH_BASE?>src/plugins/datatables/datatables.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.css" />
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/moment.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.js"></script>

    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>

    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>
    <script src="<?=PATH_MENU?>src/js/navbar.js"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js"></script>

    <style>
        ::-webkit-scrollbar { width: 0px !important; background: transparent !important; }
        * { scrollbar-width: none !important; }
    </style>
</head>

<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>
    <div id="mainContainer" class="w-full min-h-screen flex flex-col text-white mt-12 p-3 overflow-x-hidden">
        <div style="background-color:#111827;" class="w-full max-w-full overflow-x-auto" id="root"></div>
    </div>

    <script src="<?=PATH_PEDIDOS?>src/js/complementos-pos.js?t=<?php echo time(); ?>"></script>
    <script>
        $(async () => {
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (typeof comp !== 'undefined') { clearInterval(check); resolve(); }
                }, 100);
            });

            const compNav = new Templates(apiComp, 'root');
            compNav.primaryLayout({
                parent: 'root',
                id: 'CompNav',
                class: 'flex p-2',
                card: {
                    filterBar: { class: 'w-full mb-3', id: 'filterBarCompNav' },
                    container: { class: 'w-full h-full', id: 'containerCompNav' }
                }
            });

            $('#filterBarCompNav').html(`
                <div class="flex items-center gap-3 mb-3">
                    <button class="bg-[#1F2A37] text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-700 text-sm" onclick="window.location.href='../pedidos/index.php'">
                        <i class="icon-arrow-left"></i> Pedidos
                    </button>
                    <h2 class="text-xl font-bold text-white"><i class="icon-cog"></i> Funcionalidades Complementarias</h2>
                </div>
            `);

            compNav.tabLayout({
                parent: 'containerCompNav',
                id: 'tabsComplementos',
                theme: 'light',
                type: 'short',
                json: [
                    { id: 'mesas', tab: 'Mesas', icon: 'icon-food', onClick: () => comp.renderMesas(), active: true },
                    { id: 'lealtad', tab: 'Lealtad', icon: 'icon-heart', onClick: () => comp.renderLealtad() },
                    { id: 'facturacion', tab: 'Facturacion CFDI', icon: 'icon-doc-text', onClick: () => comp.renderFacturacion() },
                    { id: 'permisos', tab: 'Roles y Permisos', icon: 'icon-lock', onClick: () => comp.renderPermisos() },
                ]
            });

            comp.renderMesas();
        });
    </script>
</body>
</html>
