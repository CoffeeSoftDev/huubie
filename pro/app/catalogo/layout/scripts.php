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

    <!-- Barra y rail copiados de inventory (developer sigue con los de auth/src/js). -->
    <script src="<?= $asset('app/catalogo/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('app/catalogo/src/js/sidebar.js') ?>"></script>

    <!-- Pestañas y modal de CostSys: cuelgan sus metodos de Templates. Van antes del modulo. -->
    <script src="<?= $asset('assets/components/cs-tabs.js') ?>"></script>
    <script src="<?= $asset('assets/components/cs-modal.js') ?>"></script>

    <?php
    /*  Una clase por pestaña y al final la pagina, que las instancia. Una
        pestaña cuyo archivo aun no existe se salta sin romper la pagina. */
    $local = function ($name) {
        $file = __DIR__ . '/../src/js/' . $name . '.js';
        return is_file($file) ? 'src/js/' . $name . '.js?v=' . filemtime($file) : '';
    };

    $tabs = ['productos', 'categorias', 'subcategorias', 'grupos-modificadores', 'modificadores', 'paquetes', 'metodos-pago', 'descuentos', $script];

    foreach ($tabs as $name):
        $src = $local($name);
        if ($src === '') continue;
    ?>
    <script src="<?= $src ?>"></script>
    <?php endforeach; ?>
</body>

</html>
