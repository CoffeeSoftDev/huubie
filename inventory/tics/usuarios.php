<?php 
    if( empty($_COOKIE["IDU"]) )  require_once('../acceso/ctrl/ctrl-logout.php');

    require_once('layout/head.php');
    require_once('layout/script.php'); 
?>
<body>
    <?php require_once('../layout/navbar.php'); ?>
    <main>
        <section id="sidebar"></section>
        <div id="main__content">
            <link rel="stylesheet" href="../src/plugin/select2/select2.min.css">
<nav aria-label="breadcrumb">
    <ol class="breadcrumb">
        <li class="breadcrumb-item text-muted">TICS</li>
        <li class="breadcrumb-item fw-bold active">Usuarios</li>
    </ol>
</nav>
<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 justify-content-end mb-3 p-3">
    <div class="col mb-3">
        <label for="btnUsuario"> </label>
        <button type="button" class="btn btn-primary col-12" id="btnUsuario"><i class="icon-plus"></i>
            Usuario</button>
    </div>
</div>
<div class="col-12 table-responsive" id="tbDatos"></div>

<script src="src/js/usuarios.js?t=<?php echo time();?>"></script>
        </div>
    </main>
</body>

</html>