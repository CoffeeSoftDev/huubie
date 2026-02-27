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
            <link rel="stylesheet" href="src/css/directorios.css">
            <nav aria-label="breadcrumb">
    <ol class="breadcrumb">
        <li class="breadcrumb-item text-muted">TICS</li>
        <li class="breadcrumb-item fw-bold active">Directorios</li>
    </ol>
</nav>
<div class="row">
    <form class="col-md-4" id="form__directorios" novalidate>
        <div class="col mb-3">
            <label for="cbModulos" class="form-label">Módulo</label>
            <div class="input-group">
                <button type="button" id="newModulo" class="input-group-text btn btn-success">
                    <i class="icon-plus"></i>
                </button>
                <select class="form-select text-uppercase" name="modulo" id="cbModulos" required></select>
            </div>
            <span class="form-text text-danger hide">
                <i class="icon-warning-1"></i>
                Campo requerido.
            </span>
        </div>
        <div class="col mb-3">
            <label for="cbSubModulo" class="form-label">Submódulo</label>
            <div class="input-group">
                <button type="button" id="newSubmodulo" class="input-group-text btn btn-success">
                    <i class="icon-plus"></i>
                </button>
                <select class="form-select text-uppercase" name="submodulo" id="cbSubModulo" disabled ></select>
            </div>
        </div>
        <div class="col mb-3">
            <label for="iptDirectorio" class="form-label">Directorio</label>
            <input type="text" name="directorio" class="form-control text-lowercase" id="iptDirectorio" placeholder="Nombre del directorio"
                autocomplete="off" required />
            <span class="form-text text-danger hide">
                <i class="icon-warning-1"></i>
                Campo requerido.
            </span>
        </div>
        <div class="col mb-3">
            <button type="submit" class="col-12 btn btn-primary">Nuevo directorio</button>
        </div>
    </form>

    <div id="tbDatos" class="col-md-8 table-responsive"></div>
</div>

<script src="src/js/directorios.js?t=<?php echo time();?>"></script>
        </div>
    </main>
</body>

</html>