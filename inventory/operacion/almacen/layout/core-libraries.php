<!-- Core Libraries -->
<script src="../../src/plugin/jquery/jquery-3.7.0.min.js"></script>

<!-- Bootstrap -->
<script src="../../src/plugin/bootstrap-5/js/bootstrap.min.js"></script>
<script src="../../src/plugin/bootstrap-5/js/bootstrap.bundle.js"></script>

<!-- UI Plugins -->
<script src="../../src/plugin/select2/bootstrap/select2.min.js"></script>
<script src="../../src/plugin/bootbox.min.js"></script>
<script src="../../src/plugin/sweetalert2/sweetalert2.all.min.js"></script>

<!-- Date & Time -->
<script src="../../src/plugin/daterangepicker/moment.min.js"></script>
<script src="../../src/plugin/daterangepicker/daterangepicker.js"></script>

<!-- DataTables -->
<script src="../../src/plugin/datatables/datatables.min.js"></script>
<script src="../../src/plugin/datatables/dataTables.responsive.min.js"></script>
<script src="../../src/plugin/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

<!-- Charts -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels"></script>

<!-- Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<!-- Layout Components -->
<!-- <script src="../../src/js/navbar.js"></script>
<script src="../../src/js/sidebar.js"></script> -->

<style>
    /* Select2 detrás de modales */
    .select2-container,
    .select2-dropdown {
        z-index: 1 !important;
    }
    
    /* Modales siempre encima */
    .modal-backdrop,
    .bootbox-backdrop,
    .swal2-container {
        z-index: 9998 !important;
    }
    
    .modal,
    .bootbox-modal,
    .swal2-popup {
        z-index: 9999 !important;
    }
</style>