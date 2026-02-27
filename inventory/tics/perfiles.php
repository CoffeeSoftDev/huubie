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
            <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
        <li class="breadcrumb-item text-muted">TICS</li>
        <li class="breadcrumb-item fw-bold active">Perfiles y permisos</li>
    </ol>
</nav>
<div class="row">
    <div class="col-md-4">
        <form class="col-12" id="form__permisos">
            <div class="col mb-3">
                <label for="iptPerfil" class="form-label">Perfil</label>
                <input list="listPerfiles" class="form-control" id="iptPerfil" placeholder="Nombre del perfil"
                    autocomplete="off" />
                <span class="form-text text-danger hide">
                    <i class="icon-warning-1"></i>
                    Campo requerido.
                </span>
                <datalist id="listPerfiles"></datalist>
            </div>
            <div class="col mb-3">
                <button type="submit" class="col-12 btn btn-primary">Nuevo perfil</button>
            </div>
        </form>
        <div id="tbDatosPerfiles" class="col-12 table-responsive"></div>
    </div>
    <div id="tbDatosDirectorios" class="col-md-8 table-responsive"></div>
</div>
<script src="src/js/perfiles.js?t=<?php echo time();?>"></script>

        </div>
    </main>
</body>

</html>

