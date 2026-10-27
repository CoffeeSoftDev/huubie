<!-- Core Libraries -->
<script src="/app/facture/src/plugin/jquery/jquery-3.7.0.min.js"></script>

<!-- Bootstrap -->
<script src="/app/facture/src/plugin/bootstrap-5/js/bootstrap.min.js"></script>
<script src="/app/facture/src/plugin/bootstrap-5/js/bootstrap.bundle.js"></script>

<!-- UI Plugins -->
<script src="/app/facture/src/plugin/select2/bootstrap/select2.min.js"></script>
<script src="/app/facture/src/plugin/bootbox.min.js"></script>
<script src="/app/facture/src/plugin/sweetalert2/sweetalert2.all.min.js"></script>

<!-- Date & Time -->
<script src="/app/facture/src/plugin/daterangepicker/moment.min.js"></script>
<script src="/app/facture/src/plugin/daterangepicker/daterangepicker.js"></script>

<!-- DataTables -->
<script src="/app/facture/src/plugin/datatables/datatables.min.js"></script>
<script src="/app/facture/src/plugin/datatables/dataTables.responsive.min.js"></script>
<script src="/app/facture/src/plugin/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>

<!-- Charts -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels"></script>

<!-- Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">

<style>
    /* Las tarjetas usan Poppins (font-[Poppins] en coffeeSoft.js); el CDN de Tailwind
       no genera utilidades arbitrarias de forma fiable, por eso se define como clase propia. */
    .font-poppins { font-family: 'Poppins', sans-serif; }

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
