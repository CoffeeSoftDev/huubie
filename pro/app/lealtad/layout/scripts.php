    <script src="../../assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="../../assets/plugins/bootstrap-5/js/bootstrap.bundle.min.js"></script>
    <script src="../../assets/plugins/select2/bootstrap/select2.min.js"></script>
    <script src="../../assets/plugins/bootbox.min.js"></script>
    <script src="../../assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="../../assets/plugins/datatables/datatables.min.js"></script>
    <script src="../../assets/plugins/datatables/dataTables.responsive.min.js"></script>
    <script src="../../assets/plugins/datatables/1.13.6/js/dataTables.bootstrap5.min.js"></script>
    <script src="../../assets/plugins/lucide/lucide.min.js"></script>

    <!-- CoffeeSoft: el framework, y alert()/send_ajax() de complementos.js -->
    <script src="<?= $asset('assets/js/coffeeSoft.js') ?>"></script>
    <script src="<?= $asset('assets/js/plugins.js') ?>"></script>
    <script src="<?= $asset('assets/js/complementos.js') ?>"></script>

    <!-- Barra y rail: los de pro, los mismos de todas las paginas. Cada uno trae su propio CSS. -->
    <script src="<?= $asset('auth/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('auth/src/js/sidebar.js') ?>"></script>

    <!-- Modal de pro (csModal y hex6): cuelga de Templates. Va antes de la pagina. -->
    <script src="<?= $asset('assets/components/cs-modal.js') ?>"></script>

    <?php
    // Lo que la pagina pide de mas ($extra: rutas desde pro/), antes de su JS.
    foreach (($extra ?? []) as $file):
    ?>
    <script src="<?= $asset($file) ?>"></script>
    <?php
    endforeach;

    // La pagina: src/js/<$script>.js. Sin el detalle, el turno ni el cobro de Pedidos.
    $page = __DIR__ . '/../src/js/' . $script . '.js';
    if (is_file($page)):
    ?>
    <script src="src/js/<?= $script ?>.js?v=<?= filemtime($page) ?>"></script>
    <?php endif; ?>
</body>

</html>
