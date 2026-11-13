<?php
/*  Cierre de layout/head.php. $scripts son los .js de la pagina, relativos a
    ella ('src/js/home.js'); van despues de la barra y el rail para que la
    sesion y el menu se pidan primero. */
?>
    <script src="<?= $root ?>assets/plugins/jquery/jquery-3.7.0.min.js"></script>
    <script src="<?= $root ?>assets/plugins/sweetalert2/sweetalert2.all.min.js"></script>
    <script src="<?= $root ?>assets/plugins/lucide/lucide.min.js"></script>

    <script src="<?= $asset('auth/src/js/navbar.js') ?>"></script>
    <script src="<?= $asset('auth/src/js/sidebar.js') ?>"></script>
    <script src="<?= $asset('assets/js/page.js') ?>"></script>

    <?php foreach ($scripts as $script): ?>
    <script src="<?= $script ?>?v=<?= filemtime($here . '/' . $script) ?>"></script>
    <?php endforeach; ?>
</body>

</html>
