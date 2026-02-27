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
            <div class="d-flex justify-content-center align-items-center" style="height:100vh; background-color:transparent;">
                <h3 class="text-primary">
                    <i class="animate-spin icon-spin4"></i>
                    A N A L I Z A N D O . . .
                </h3>
            </div>
        </div>
    </main>
</body>
</html>