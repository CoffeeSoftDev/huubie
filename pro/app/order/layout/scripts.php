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

    <!-- CoffeeSoft: el framework, y alert()/send_ajax() de complementos.js -->
    <script src="<?= $asset('assets/js/coffeeSoft.js') ?>"></script>
    <script src="<?= $asset('assets/js/plugins.js') ?>"></script>
    <script src="<?= $asset('assets/js/complementos.js') ?>"></script>

    <!-- Barra y rail: se usan los de Catalogo tal cual (son genericos). No se
         copian para no tener dos versiones que mantener. -->
    <script src="<?= $asset('app/catalogo/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('app/catalogo/src/js/sidebar.js') ?>"></script>

    <!-- Modal de CostSys: cuelga csModal de Templates. Va antes del modulo. -->
    <script src="<?= $asset('assets/components/cs-modal.js') ?>"></script>

    <?php
    /*  Primero el detalle (lo usa la pagina) y al final la pagina, que lo
        instancia. index.php sin secciones llega con $script vacio: nada. */
    $local = function ($name) {
        $file = __DIR__ . '/../src/js/' . $name . '.js';
        return is_file($file) ? 'src/js/' . $name . '.js?v=' . filemtime($file) : '';
    };

    $files = $script !== '' ? ['pedido-detalle', $script] : [];

    foreach ($files as $name):
        $src = $local($name);
        if ($src === '') continue;
    ?>
    <script src="<?= $src ?>"></script>
    <?php endforeach; ?>
</body>

</html>
