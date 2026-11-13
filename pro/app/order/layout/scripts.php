    <script src="../../assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../assets/plugins/bootstrap-5/js/bootstrap.bundle.min.js"></script>
    <script src="../../assets/plugins/select2/bootstrap/select2.min.js"></script>
    <script src="../../assets/plugins/bootbox.min.js"></script>
    <script src="../../assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="../../assets/plugins/datatables/datatables.min.js"></script>
    <script src="../../assets/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="../../assets/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <!-- Calendario de periodo: dataPicker() de plugins.js necesita moment y daterangepicker. -->
    <script src="../../assets/plugins/daterangepicker/moment.min.js"></script>
    <script src="../../assets/plugins/daterangepicker/daterangepicker.js"></script>
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>
    <?php if ($script === 'calendario'): ?>
    <!-- Calendario: FullCalendar 6.1.14, la misma version que alpha, con su idioma español. -->
    <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.14/locales/es.global.min.js"></script>
    <?php endif; ?>

    <!-- CoffeeSoft: el framework, y alert()/send_ajax() de complementos.js -->
    <script src="<?= $asset('assets/js/coffeeSoft.js') ?>"></script>
    <script src="<?= $asset('assets/js/plugins.js') ?>"></script>
    <script src="<?= $asset('assets/js/complementos.js') ?>"></script>

    <!-- Barra: la de Catalogo tal cual (es generica). Rail: el de pro, que pinta
         los submodulos (TPV, Reportes) y las secciones sin pagina como "Próximamente". -->
    <script src="<?= $asset('app/catalogo/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('auth/src/js/sidebar.js') ?>"></script>

    <!-- Componentes compartidos: cuelgan de Templates. Van antes del modulo.
         posCatalog y posTicket/Lines/Totals aprobados el 13/11/2026. -->
    <script src="<?= $asset('assets/components/cs-modal.js') ?>"></script>
    <script src="<?= $asset('assets/components/pos-catalog.js') ?>"></script>
    <script src="<?= $asset('assets/components/pos-ticket.js') ?>"></script>

    <?php
    /*  Primero el detalle (ayudantes esc/money), luego la captura (usa los
        componentes POS), el turno y el cobro, y al final la pagina, que los
        instancia. index.php sin secciones llega con $script vacio: nada. */
    $local = function ($name) {
        $file = __DIR__ . '/../src/js/' . $name . '.js';
        return is_file($file) ? 'src/js/' . $name . '.js?v=' . filemtime($file) : '';
    };

    $files = $script !== '' ? ['pedido-detalle', 'pedido-captura', 'pedido-turno', 'pedido-cobro', 'pedido-cierre', $script] : [];

    foreach ($files as $name):
        $src = $local($name);
        if ($src === '') continue;
    ?>
    <script src="<?= $src ?>"></script>
    <?php endforeach; ?>
</body>

</html>
