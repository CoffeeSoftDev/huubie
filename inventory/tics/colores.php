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
            <nav aria-label='breadcrumb'>
    <ol class='breadcrumb'>
        <li class='breadcrumb-item text-uppercase text-muted'>tics</li>

        <li class='breadcrumb-item fw-bold active'>Colores</li>
    </ol>
</nav>
<div class="mb-3 row">
    <div class="accordion" id="accordionExample">
        <div class="accordion-item">
            <h2 class="accordion-header" id="headingOne">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne"
                    aria-expanded="true" aria-controls="collapseOne">
                    COLORES
                </button>
            </h2>
            <div id="collapseOne" class="accordion-collapse collapse show" aria-labelledby="headingOne"
                data-bs-parent="#accordionExample">
                <div class="accordion-body">
                    <table class="table table-hover table-sm table-bordered">
                        <thead>
                            <tr>
                                <th>Colores</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="text-center bg-primary">.bg-primary</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-secondary">.bg-secondary</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-info">.bg-info</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-success">.bg-success</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-warning">.bg-warning</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-danger">.bg-danger</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-aliceblue">.bg-aliceblue</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-navbar">.bg-navbar</td>
                            </tr>
                            <tr>
                                <td class="text-center bg-disabled">.bg-disabled</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div class="accordion-item">
            <h2 class="accordion-header" id="headingTwo">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                    data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                    BOTONES
                </button>
            </h2>
            <div id="collapseTwo" class="accordion-collapse collapse" aria-labelledby="headingTwo"
                data-bs-parent="#accordionExample">
                <div class="accordion-body row">
                    <h4>BOTONES NORMALES</h4>
                    <div class="col-4 mb-3"><button class="btn btn-primary col-12">.btn-primary</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-secondary col-12">.btn-secondary</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-info col-12">.btn-info</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-success col-12">.btn-success</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-warning col-12">.btn-warning</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-danger col-12">.btn-danger</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-navbar col-12">.btn-navbar</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-disabled col-12">.btn-disabled</button></div>
                    <h4>BOTONES DE TABLAS</h4>
                    <div class="col-4 mb-3"><button class="btn btn-outline-primary col-12">.btn-outline-primary</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-secondary col-12">.btn-outline-secondary</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-info col-12">.btn-outline-info</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-success col-12">.btn-outline-success</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-warning col-12">.btn-outline-warning</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-danger col-12">.btn-outline-danger</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-navbar col-12">.btn-outline-navbar</button></div>
                    <div class="col-4 mb-3"><button class="btn btn-outline-disabled col-12">.btn-outline-disabled</button></div>
                </div>
            </div>
        </div>
        <div class="accordion-item hide">
            <h2 class="accordion-header" id="headingThree">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                    data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                    Accordion Item #3
                </button>
            </h2>
            <div id="collapseThree" class="accordion-collapse collapse" aria-labelledby="headingThree"
                data-bs-parent="#accordionExample">
                <div class="accordion-body">
                    <strong>This is the third item's accordion body.</strong> It is hidden by default, until the
                    collapse plugin adds the appropriate classes that we use to style each element. These classes
                    control the overall appearance, as well as the showing and hiding via CSS transitions. You can
                    modify any of this with custom CSS or overriding our default variables. It's also worth noting that
                    just about any HTML can go within the <code>.accordion-body</code>, though the transition does limit
                    overflow.
                </div>
            </div>
        </div>
    </div>
</div>
<script src='src/js/colores.js?t=1695483491'></script>
        </div>
    </main>
</body>
</html>