    <script src="../../assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../assets/plugins/bootstrap-5/js/bootstrap.bundle.min.js"></script>
    <script src="../../assets/plugins/select2/bootstrap/select2.min.js"></script>
    <script src="../../assets/plugins/bootbox.min.js"></script>
    <script src="../../assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="../../assets/plugins/datatables/datatables.min.js"></script>
    <script src="../../assets/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="../../assets/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>

    <!-- Periodo de Entradas y Salidas: dataPicker() de plugins.js necesita moment y daterangepicker. -->
    <script src="../../assets/plugins/daterangepicker/moment.min.js"></script>
    <script src="../../assets/plugins/daterangepicker/daterangepicker.js"></script>

    <!-- CoffeeSoft: el framework, y alert()/send_ajax() de complementos.js -->
    <script src="<?= $asset('assets/js/coffeeSoft.js') ?>"></script>
    <script src="<?= $asset('assets/js/plugins.js') ?>"></script>
    <script src="<?= $asset('assets/js/complementos.js') ?>"></script>

    <!-- Barra y rail: los de pro, los mismos de todas las paginas. -->
    <script src="<?= $asset('auth/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('auth/src/js/sidebar.js') ?>"></script>

    <!-- Pestañas y modal de CostSys: cuelgan sus metodos de Templates. Van antes del modulo. -->
    <script src="<?= $asset('assets/components/cs-tabs.js') ?>"></script>
    <script src="<?= $asset('assets/components/cs-modal.js') ?>"></script>
    <?php foreach ($proComponents ?? [] as $name): ?>
    <script src="<?= $asset('assets/components/' . $name . '.js') ?>"></script>
    <?php endforeach; ?>

    <!-- $cdnJs: librerías de fuera (FullCalendar en Requisiciones y Surtir). -->
    <?php foreach ($cdnJs ?? [] as $src): ?>
    <script src="<?= htmlspecialchars($src) ?>"></script>
    <?php endforeach; ?>

    <!-- $pageJs: archivos de otro módulo, desde pro/ (la foto del Catálogo de venta). -->
    <?php foreach ($pageJs ?? [] as $file): ?>
    <script src="<?= $asset($file) ?>"></script>
    <?php endforeach; ?>

    <!-- Lo comun de Inventarios, la captura de inventory que use la pagina, sus pestañas
         ($tabs: una clase por archivo, como el Catálogo de venta) y luego la pagina. -->
    <?php foreach (array_merge(['inventarios'], array_map(function ($c) { return 'components/' . $c; }, $components ?? []), $tabs ?? [], [$script]) as $name): ?>
    <script src="src/js/<?= $name ?>.js?v=<?= filemtime(__DIR__ . '/../src/js/' . $name . '.js') ?>"></script>
    <?php endforeach; ?>
</body>

</html>
