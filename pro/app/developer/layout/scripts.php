    <script src="../../assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../assets/plugins/bootstrap-5/js/bootstrap.bundle.min.js"></script>
    <script src="../../assets/plugins/select2/bootstrap/select2.min.js"></script>
    <script src="../../assets/plugins/bootbox.min.js"></script>
    <script src="../../assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>
    <script src="../../assets/plugins/datatables/datatables.min.js"></script>
    <script src="../../assets/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="../../assets/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>

    <!-- CoffeeSoft: el framework, y alert()/send_ajax() de complementos.js -->
    <script src="<?= $asset('assets/js/coffeeSoft.js') ?>"></script>
    <script src="<?= $asset('assets/js/plugins.js') ?>"></script>
    <script src="<?= $asset('assets/js/complementos.js') ?>"></script>

    <script src="<?= $asset('auth/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('auth/src/js/sidebar.js') ?>"></script>

    <!-- Selector de iconos y lista agrupada: cuelgan sus metodos de Templates
         y los usa Accesos (Secciones). Van antes del modulo. -->
    <script src="<?= $asset('assets/components/cs-icons.js') ?>"></script>
    <script src="<?= $asset('assets/components/cs-icon-picker.js') ?>"></script>
    <script src="<?= $asset('assets/components/cs-grouped-list.js') ?>"></script>

    <script src="src/js/developer.js?v=<?= filemtime(__DIR__ . '/../src/js/developer.js') ?>"></script>
    <?php if (in_array($script, ['accesos', 'facturacion'], true)): ?>
    <!-- Alta y edición de usuarios: Accesos › Usuarios y el detalle de cada empresa en Facturación. -->
    <script src="src/js/user-form.js?v=<?= filemtime(__DIR__ . '/../src/js/user-form.js') ?>"></script>
    <?php endif; ?>
    <script src="src/js/<?= $script ?>.js?v=<?= filemtime(__DIR__ . '/../src/js/' . $script . '.js') ?>"></script>
</body>

</html>
