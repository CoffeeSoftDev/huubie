<!-- Librerias de app/ una por una, NO /app/layout/core-libraries.php: ese termina
     cargando session.js + navbar.js + sidebar.js de app/, que hacen fetch a
     ctrl-access.php y montan el menu por permisos del ERP. El Facturador monta
     los suyos (navbar-huubie.js / sidebar-huubie.js) porque vivira en otra BD. -->

<!-- SWEETALERT -->
<script src="/app/src/plugins/sweetalert2/sweetalert2.all.min.js"></script>

<!-- JQUERY + BOOTBOX -->
<script src="/app/src/plugins/jquery/jquery-3.7.0.js"></script>
<script src="/app/src/plugins/bootbox.min.js"></script>

<!-- CORE COFFEESOFT -->
<script src="/app/src/js/complementos.js"></script>
<script src="/app/src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="/app/src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>

<!-- DATATABLES -->
<script src="/app/src/plugins/datatables/datatables.min.js"></script>
<script src="/app/src/plugins/datatables/dataTables.responsive.min.js"></script>
<script src="/app/src/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

<!-- BOOTSTRAP -->
<script src="/app/src/plugins/bootstrap-5/js/bootstrap.bundle.js"></script>

<!-- DATERANGEPICKER (moment debe ir antes) -->
<script src="/app/src/plugins/daterangepicker/moment.min.js"></script>
<script src="/app/src/plugins/daterangepicker/daterangepicker.js"></script>

<!-- LUCIDE -->
<script src="https://unpkg.com/lucide@latest"></script>

<!-- TEMA: antes del CSS del modulo para que el primer pintado ya sea el correcto -->
<script src="/app/facture/src/js/facture-theme.js?t=<?php echo time(); ?>"></script>
<link rel="stylesheet" href="/app/facture/src/css/facture-theme.css?t=<?php echo time(); ?>">

<!-- POPPINS: tipografia de las tarjetas y encabezados Huubie -->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
