<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="<?=PATH_BASE?>src/img/logo/logo.ico" />
    <title>Alpha</title>

    <script src="https://cdn.tailwindcss.com"></script>
    <!-- icons -->
     <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/fontello/css/fontello.css" />
    <link rel="stylesheet" href="<?=PATH_EVENTOS?>src/css/style.css" />

   
    <link rel="stylesheet" href="<?=PATH_BASE?>src/css/colors.css" />

    <!-- <link rel="stylesheet" href="src/css/style.css" /> -->
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.13.2/themes/base/jquery-ui.css">


    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

    <!--BOOTBOX-->
    <script src="<?=PATH_BASE?>src/plugins/jquery/jquery-3.7.0.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/bootbox.min.js"></script>
    <script src="<?=PATH_BASE?>src/js/complementos.js"></script>
    <script src="<?=PATH_BASE?>src/js/plugins.js?t=<?php echo time(); ?>"></script>
    <script src="<?=PATH_BASE?>src/js/coffeSoft.js?t=<?php echo time(); ?>"></script>

    <!-- autocomplete -->

    <script src="https://code.jquery.com/ui/1.13.2/jquery-ui.min.js"></script>

    <!-- datables -->
    <link rel="stylesheet" href="https://15-92.com/ERP3/src/plugin/datatables/1.13.6/css/dataTables.bootstrap5.min.css">
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/datatables/1.13.6/css/dataTables.bootstrap5.min.css">

    <!-- datatables -->

    <script src="<?=PATH_BASE?>src/plugins/datatables/datatables.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

    <!-- datarange picker -->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.css" />

    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/bootstrap-5/css/bootstrap.min.css" />
    <script src="<?=PATH_BASE?>src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>


    <!--ANIMATE-->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.0.0/animate.compat.css" />
    <!-- rule lib -->
    <script src='https://cdn.jsdelivr.net/npm/rrule@2.6.4/dist/es5/rrule.min.js'></script>

    <!--SELECT2-->
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2.min.css">
    <link rel="stylesheet" href="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2-bootstrap-5-theme.min.css">
    <!--SELECT2-->
    <script src="<?=PATH_BASE?>src/plugins/select2/bootstrap/select2.min.js"></script>
    <!-- PRINCIPAL -->
    <script src="<?=PATH_BASE?>access/src/js/session.js"></script>
    <script src="<?=PATH_MENU?>src/js/navbar.js"></script>
    <script src="<?=PATH_MENU?>src/js/sidebar.js"></script>


</head>

<style>
.select2-selection {
    background-color: #1F2A37 !important;
    border-color: rgb(79, 92, 112) !important;
}

.select2-dropdown {
    background-color: #1F2A37 !important;
    color: #ADB5BD !important;
}

.select2-selection__choice {
    color: #ADB5AE !important;
    border: 1px solid rgb(153, 161, 169) !important;
}

.select2-search {
    color: #ADB5BD !important;
}

.select2-results__option.select2-results__option--highlighted {
    background-color: #313D4F !important;
    color: #ADB5BD !important;
}

.ui-autocomplete {
    z-index: 99999 !important;
}

.ui-autocomplete {
    z-index: 99999 !important;
    background: #23262f !important;
    /* Gris-violeta muy oscuro */
    color: #fff !important;
    border: 1.5px solid #23284c !important;
    border-radius: 0.7rem !important;
    /* box-shadow: 0 4px 18px #101828cc; */
    padding: 8px 0;
    font-family: 'Poppins', 'Inter', sans-serif;
    font-size: 15px;
}

.ui-menu-item-wrapper {
    background: transparent !important;
    color: #fff !important;
    padding: 8px 18px;
    border: #2c2f37;
    cursor: pointer;
    border-radius: 0.32rem;
    transition: background 0.13s;
}

.ui-menu-item-wrapper.ui-state-active,
.ui-menu-item-wrapper:hover {
    background: #2c2f37 !important;
    /* Un gris oscuro discreto */
    color: #fff !important;
    font-weight: 500;
    /* Sin sombra ni borde extra */
}

/* 1. Elimina el azul de hover y fondo, pon gris oscuro */
.ui-menu-item-wrapper.ui-state-active,
.ui-menu-item-wrapper:hover {
    background: #2c2f37 !important;
    /* Gris oscuro discreto */
    color: #fff !important;
    border: none !important;
    outline: none !important;
    font-weight: 500;
}

/* 2. Elimina el borde azul del elemento seleccionado/autocomplete */
.ui-menu .ui-state-active {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
}
</style>

<body class="bg-[#111928] " data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>

    <!-- <input type="file" id="file" class="d-none"> -->
    <div id="mainContainer" class="w-full  bg-[#111928] text-white mt-16">
        <div style="background-color:#111827;" class=" v-100" id="root"></div>
    </div>

    <!-- Data range picker -->
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/moment.min.js"></script>
    <script src="<?=PATH_BASE?>src/plugins/daterangepicker/daterangepicker.js"></script>

    <!-- Init -->
    <script src="<?=PATH_PEDIDOS?>src/js/admin.js?t=<?php echo time(); ?>"></script>
</body>

</html>