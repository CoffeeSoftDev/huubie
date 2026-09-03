<!-- Librerias de app/ una por una, NO /app/layout/core-libraries.php: ese termina
     cargando session.js + navbar.js + sidebar.js de app/, que hacen fetch a
     ctrl-access.php y montan el menu por permisos del ERP. La terminal monta su
     propia banda (navbar-wansoft.js) y no tiene sidebar. -->

<!-- SWEETALERT -->
<script src="/app/src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

<!-- JQUERY + BOOTBOX -->
<script src="/app/src/plugins/jquery/jquery-3.7.0.js"></script>
<script src="/app/src/plugins/bootbox.min.js"></script>

<!-- CORE COFFEESOFT -->
<script src="/app/src/js/complementos.js?t=<?php echo time(); ?>"></script>
<script src="/app/src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="/app/src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

<!-- BOOTSTRAP -->
<script src="/app/src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

<!-- LUCIDE -->
<script src="https://unpkg.com/lucide@latest"></script>

<!-- DATATABLES: los modulos compartidos de facture pintan sus tablas con el -->
<script src="/app/src/plugins/datatables/datatables.min.js"></script>
<script src="/app/src/plugins/datatables/dataTables.responsive.min.js"></script>
<script src="/app/src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

<!-- DATERANGEPICKER (moment debe ir antes) -->
<script src="/app/src/plugins/daterangepicker/moment.min.js"></script>
<script src="/app/src/plugins/daterangepicker/daterangepicker.js"></script>

<!-- TEMA: antes del CSS del modulo para que el primer pintado ya sea el correcto -->
<script src="/app/facture2/src/js/wansoft-theme.js?t=<?php echo time(); ?>"></script>

<!-- Traduccion oscuro -> claro del Facturador. Se reusa entera: wansoft-theme.css
     va despues y solo repinta el azul, no rehace el trabajo. -->
<link rel="stylesheet" href="/app/facture/src/css/facture-theme.css?t=<?php echo time(); ?>">
<link rel="stylesheet" href="/app/facture2/src/css/wansoft-theme.css?t=<?php echo time(); ?>">

<!-- INTER: tipografia de la terminal -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
