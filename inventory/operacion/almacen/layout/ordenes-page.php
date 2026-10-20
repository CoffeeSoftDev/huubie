<?php
// Cuerpo común de Requisiciones (requisiciones.php) y Despacho (despacho.php): mismo JS
// (js/ordenes.js) y mismo ctrl. Quien la incluye define $seccion (sections.code del
// permiso) y $modulo ('requisiciones' | 'despacho'), que el JS lee en ORDENES_MODULO.
require_once __DIR__ . '/../../../conf/_Session.php';

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once(__DIR__ . '/../../../acceso/ctrl/ctrl-logout.php');
    exit();
}

// El rol necesita al menos una acción en la sección; si no, de regreso a Inicio.
require_once __DIR__ . '/../../../conf/_Permissions.php';
Permissions::page($seccion);

require_once(__DIR__ . '/head.php');
require_once(__DIR__ . '/core-libraries.php');
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/complementos.js?t=<?php echo time(); ?>"></script>

<link rel="stylesheet" href="../../src/css/dark-mode.css?v=<?php echo filemtime(__DIR__ . '/../../../src/css/dark-mode.css'); ?>">

<!-- FULL CALENDAR (pestaña Calendario): misma versión que Compras y alpha/pedidos -->
<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.14/index.global.min.js"></script>

<body>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <main>
        <div id="menu-navbar"></div>

        <div id="main__content">
            <!-- Contenedor principal -->
            <div class="" id="root"></div>
        </div>
    </main>

    <!-- Importación navbar y sidebar -->
    <script src="../../acceso/src/js/navbar.js?v=<?php echo filemtime(__DIR__ . '/../../../acceso/src/js/navbar.js'); ?>"></script>
    <script src="../../acceso/src/js/sidebar.js?v=<?php echo filemtime(__DIR__ . '/../../../acceso/src/js/sidebar.js'); ?>"></script>

    <!-- Captura con el formato de Entradas: orden-form extiende entrada-form -->
    <script src="../../src/js/components/entrada-form.js?v=<?php echo filemtime(__DIR__ . '/../../../src/js/components/entrada-form.js'); ?>"></script>
    <script src="../../src/js/components/orden-form.js?v=<?php echo filemtime(__DIR__ . '/../../../src/js/components/orden-form.js'); ?>"></script>

    <!-- Aviso con tarjetas de elección (aprobar con faltante) -->
    <script src="../../src/js/components/cs-choice-cards.js?v=<?php echo filemtime(__DIR__ . '/../../../src/js/components/cs-choice-cards.js'); ?>"></script>

    <!-- Requisiciones en el teléfono: tarjetas y captura a pantalla completa -->
    <script src="../../src/js/components/ordenes-movil.js?v=<?php echo filemtime(__DIR__ . '/../../../src/js/components/ordenes-movil.js'); ?>"></script>

    <!-- CoffeeIA (eliminar pedidos); forja-blob dibuja el muñeco de coffeeIA -->
    <script src="../../src/js/components/forja-blob.js?v=<?php echo filemtime(__DIR__ . '/../../../src/js/components/forja-blob.js'); ?>"></script>
    <script src="../../src/js/components/ia-chat.js?v=<?php echo filemtime(__DIR__ . '/../../../src/js/components/ia-chat.js'); ?>"></script>

    <script>window.ORDENES_MODULO = <?php echo json_encode($modulo); ?>;</script>
    <script src="js/ordenes.js?t=<?php echo time(); ?>"></script>
</body>
</html>
